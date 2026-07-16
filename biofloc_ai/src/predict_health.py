"""
Load model .pkl hasil train_model.py, prediksi kondisi besok per kolam,
kasih health score + rekomendasi rule-based (threshold dari PROFILE tambak
yang dipilih), simpan JSON.

Cara pakai:
    python predict_health.py --csv ../data/dataset.csv --profile vannamei_marine
    python predict_health.py --csv ../data/dataset.csv --profile tilapia_freshwater
    python predict_health.py --csv ../data/dataset.csv --profile generic
"""

import argparse
import json
import os
from datetime import datetime

import joblib
import pandas as pd

import profiles as profile_loader
from feature_engineering import bucket_15min, daily_rollup, add_lag_features
from train_model import load_raw  # reuse mapping kolom yang sama dengan training

DIRECTIONAL_PARAMS = ["ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l"]
RANGE_PARAMS = ["do_mg_l", "ph", "temperature_c"]

PENALTY = {"safe": 0, "warning": 15, "danger": 35, None: 0}


def build_latest_features(csv_path: str) -> pd.DataFrame:
    raw = load_raw(csv_path)
    bucketed = bucket_15min(raw)
    daily = daily_rollup(bucketed)
    daily = add_lag_features(daily)
    return daily


def score_pond(preds: dict, profile: dict) -> dict:
    """Health score 0-100 berdasar threshold di profile."""
    thresholds = profile["thresholds"]
    status = {}

    for p in DIRECTIONAL_PARAMS:
        key = f"{p}_mean"
        if p in thresholds:
            status[p] = profile_loader.classify_directional(preds.get(key), thresholds.get(p))
    for p in RANGE_PARAMS:
        key = f"{p}_mean"
        if p in thresholds:
            status[p] = profile_loader.classify_range(preds.get(key), thresholds.get(p))

    score = 100 - sum(PENALTY[s] for s in status.values())
    score = max(0, score)

    if score >= 85:
        label = "Baik"
    elif score >= 60:
        label = "Waspada"
    else:
        label = "Kritis"

    return {"status": status, "health_score": score, "health_label": label}


def recommend_actions(status: dict, preds: dict, profile: dict) -> list:
    """Rule-based, dari threshold profile — tanpa API/LLM."""
    actions = []
    t = profile["thresholds"]
    cn_ratio = profile.get("management", {}).get("cn_ratio_target")

    amm = preds.get("ammonia_mg_l_mean")
    if status.get("ammonia_mg_l") == "danger":
        cn_note = f" (target rasio C:N {cn_ratio}:1)" if cn_ratio else ""
        actions.append(
            f"URGENT: proyeksi amonia {amm:.2f} mg/L >= batas aman {t['ammonia_mg_l']['danger']} mg/L "
            f"buat {profile['species']}. Tambah karbon organik{cn_note} dan cek aerasi."
        )
    elif status.get("ammonia_mg_l") == "warning":
        actions.append(f"Waspada: amonia {amm:.2f} mg/L trending naik. Siapkan molase, pantau lebih sering.")

    nitrite = preds.get("nitrite_mg_l_mean")
    if status.get("nitrite_mg_l") == "danger":
        actions.append(f"URGENT: proyeksi nitrit {nitrite:.2f} mg/L lewat ambang aman {t['nitrite_mg_l']['danger']} mg/L.")
    elif status.get("nitrite_mg_l") == "warning":
        actions.append(f"Nitrit {nitrite:.2f} mg/L mendekati ambang — pertimbangkan water change.")

    nitrate = preds.get("nitrate_mg_l_mean")
    if status.get("nitrate_mg_l") == "danger":
        actions.append(f"URGENT: proyeksi nitrate {nitrate:.2f} mg/L lewat ambang aman {t.get('nitrate_mg_l', {}).get('danger')} mg/L.")
    elif status.get("nitrate_mg_l") == "warning":
        actions.append(f"Nitrate {nitrate:.2f} mg/L mendekati ambang — pantau tren, pertimbangkan water change parsial.")

    if status.get("do_mg_l") == "danger":
        rng = t.get("do_mg_l", {})
        actions.append(f"DO diproyeksikan jauh dari rentang normal ({rng.get('low')}-{rng.get('high')} mg/L) — cek aerator.")
    if status.get("ph") == "danger":
        actions.append("pH diproyeksikan keluar rentang normal — cek dosis kapur/buffer.")
    if status.get("temperature_c") == "danger":
        actions.append("Suhu diproyeksikan keluar rentang normal — cek shading/heater/aerasi.")

    if not actions:
        actions.append("Kondisi diproyeksikan aman, lanjut monitoring rutin.")

    return actions


def main(csv_path: str, model_path: str, output_path: str, profile_id: str):
    profile = profile_loader.load_profile(profile_id, csv_path_for_generic=csv_path)

    bundle = joblib.load(model_path)
    models, feature_cols_per_target = bundle["models"], bundle["feature_cols_per_target"]

    daily = build_latest_features(csv_path)

    report = {
        "generated_at": datetime.now().isoformat(),
        "profile": {"id": profile["profile_id"], "species": profile["species"], "source": profile["source"]},
        "ponds": {},
    }

    for pond_id, group in daily.groupby("pond_id"):
        group = group.sort_values("date")

        preds = {}
        latest_dates = {}
        for target, model in models.items():
            own_cols = feature_cols_per_target[target]
            latest = group.dropna(subset=own_cols).tail(1)
            if latest.empty:
                continue
            preds[target] = float(model.predict(latest[own_cols])[0])
            latest_dates[target] = latest["date"].values[0]

        if not preds:
            continue

        scored = score_pond(preds, profile)
        actions = recommend_actions(scored["status"], preds, profile)

        based_on = {t: pd.to_datetime(d).strftime("%Y-%m-%d") for t, d in latest_dates.items()}

        report["ponds"][str(pond_id)] = {
            "predictions": {k.replace("_mean", ""): round(v, 3) for k, v in preds.items()},
            "based_on_last_complete_date": based_on,
            "status": scored["status"],
            "health_score": scored["health_score"],
            "health_label": scored["health_label"],
            "recommendations": actions,
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Profile dipakai: {profile['profile_id']} ({profile['species']})")
    print(f"Health report tersimpan di {output_path}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--profile", default="vannamei_marine", help="vannamei_marine | tilapia_freshwater | generic")
    parser.add_argument("--model", default=None)
    parser.add_argument("--output", default=os.path.join(os.path.dirname(__file__), "..", "outputs", "health_report.json"))
    args = parser.parse_args()

    if args.model is None:
        args.model = os.path.join(os.path.dirname(__file__), "..", "models", f"{args.profile}_models.pkl")

    main(args.csv, args.model, args.output, args.profile)