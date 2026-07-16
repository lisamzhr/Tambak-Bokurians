"""
Training model forecasting per parameter (amonia, nitrit, nitrate, DO, pH).
Rekomendasi/decision-layer sekarang ada di predict_health.py (berbasis profile
tambak), bukan di sini — file ini fokus training & simpan .pkl saja.

Cara pakai:
    python train_model.py --csv path/ke/dataset.csv --profile vannamei_marine

Kolom CSV yang diharapkan (sesuaikan mapping di RENAME_MAP kalau beda):
    timestamp, pond_id, temperature_c, do_mg_l, ph, ammonia_mg_l, nitrite_mg_l
"""

import argparse
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

from feature_engineering import bucket_15min, daily_rollup, add_lag_features

# Sesuaikan ini kalau nama kolom dataset Kaggle/jurnal beda
RENAME_MAP = {
    "Temperature": "temperature_c",
    "DO": "do_mg_l",
    "pH": "ph",
    "Ammonia": "ammonia_mg_l",
    "Nitrite": "nitrite_mg_l",
    "Pond ID": "pond_id",
    "Timestamp": "timestamp",
}

TARGETS = ["ammonia_mg_l_mean", "nitrite_mg_l_mean", "nitrate_mg_l_mean", "do_mg_l_mean", "ph_mean"]


def load_raw(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = df.rename(columns=RENAME_MAP)
    missing = [c for c in ["timestamp", "pond_id"] if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib hilang: {missing}. Cek RENAME_MAP di train_model.py")
    return df


def build_features(raw_df: pd.DataFrame) -> pd.DataFrame:
    bucketed = bucket_15min(raw_df)
    daily = daily_rollup(bucketed)
    daily = add_lag_features(daily)
    return daily


def train_forecast_models(daily_df: pd.DataFrame, pond_col: str = "pond_id"):
    """Train satu RandomForest per target parameter.

    PENTING: tiap target pakai lag/roll features dari PARAMETER-NYA SENDIRI SAJA
    (bukan gabungan semua parameter). Ini supaya parameter yang datanya bolong
    parah (mis. amonia) tidak ikut menjatuhkan jumlah data training parameter lain
    yang datanya lebih lengkap (DO, pH, nitrate).
    """
    df = daily_df.sort_values("date")

    models = {}
    metrics = {}
    feature_cols_per_target = {}

    for target in TARGETS:
        if target not in df.columns:
            continue

        own_feature_cols = [
            c for c in df.columns
            if c.startswith(f"{target}_lag") or c == f"{target}_roll3"
        ]
        if not own_feature_cols:
            continue

        subset = df.dropna(subset=own_feature_cols + [target])
        if len(subset) < 20:
            print(f"[{target}] dilewati — cuma {len(subset)} hari data lengkap (butuh >=20).")
            continue

        split_idx = int(len(subset) * 0.8)
        train_df, test_df = subset.iloc[:split_idx], subset.iloc[split_idx:]

        model = RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=1)
        model.fit(train_df[own_feature_cols], train_df[target])

        preds = model.predict(test_df[own_feature_cols])
        mae = mean_absolute_error(test_df[target], preds)
        rmse = np.sqrt(mean_squared_error(test_df[target], preds))

        models[target] = model
        feature_cols_per_target[target] = own_feature_cols
        metrics[target] = {"MAE": round(mae, 4), "RMSE": round(rmse, 4), "n_days_used": len(subset)}
        print(f"[{target}] MAE={mae:.4f}  RMSE={rmse:.4f}  (n_days_used={len(subset)})")

    return models, feature_cols_per_target, metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path ke dataset CSV")
    parser.add_argument("--profile", default="vannamei_marine", help="Nama profile, dipakai buat nama file .pkl (mis. vannamei_marine, tilapia_freshwater)")
    args = parser.parse_args()

    raw = load_raw(args.csv)
    daily = build_features(raw)
    models, feature_cols_per_target, metrics = train_forecast_models(daily)

    out_path = os.path.join(os.path.dirname(__file__), "..", "models", f"{args.profile}_models.pkl")
    joblib.dump({"models": models, "feature_cols_per_target": feature_cols_per_target, "metrics": metrics, "profile": args.profile}, out_path)
    print(f"\nModel tersimpan di {out_path}")
    print("Metrics:", metrics)