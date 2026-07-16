"""
Cek apakah biofloc di kolam SUDAH MATANG (siap ditebar bibit), berdasar histori
data sensor — bukan prediksi ke depan (itu tugasnya predict_health.py), ini
ngecek MASA LALU: udah berapa hari berturut-turut amonia/nitrit stabil aman.

Kriteria "matang" (dari profile['maturity_criteria']):
    - Parameter wajib (params_required, mis. ammonia & nitrite) berstatus
      'safe' selama N hari BERTURUT-TURUT (consecutive_safe_days_required)
    - Nitrate trend naik dipakai sebagai sinyal pendukung (bukan syarat wajib),
      indikasi nitrifikasi aktif jalan.

Cara pakai:
    python maturity_check.py --csv ../data/dataset_cleaned.csv --profile vannamei_marine
"""

import argparse
import json
import os

import pandas as pd

import profiles as profile_loader
from feature_engineering import bucket_15min, daily_rollup
from train_model import load_raw


def build_daily_history(csv_path: str) -> pd.DataFrame:
    raw = load_raw(csv_path)
    bucketed = bucket_15min(raw)
    daily = daily_rollup(bucketed)
    return daily.sort_values("date")


def longest_current_safe_streak(daily_series: pd.Series, profile_thresh: dict) -> int:
    """Hitung streak 'safe' berturut-turut di UJUNG PALING BARU data (bukan streak terpanjang sepanjang histori)."""
    streak = 0
    for value in reversed(daily_series.tolist()):
        status = profile_loader.classify_directional(value, profile_thresh)
        if status == "safe":
            streak += 1
        elif status is None:
            continue  # hari dengan data kosong dilewati, gak motong streak (tapi juga gak nambah)
        else:
            break
    return streak


def check_maturity(daily_df: pd.DataFrame, profile: dict, pond_col: str = "pond_id") -> dict:
    criteria = profile.get("maturity_criteria", {})
    required_days = criteria.get("consecutive_safe_days_required", 3)
    required_params = criteria.get("params_required", ["ammonia_mg_l"])
    thresholds = profile["thresholds"]

    results = {}
    for pond_id, group in daily_df.groupby(pond_col):
        group = group.sort_values("date")
        per_param_streak = {}
        per_param_available = {}

        for p in required_params:
            col = f"{p}_mean"
            if col not in group.columns or p not in thresholds:
                per_param_available[p] = False
                continue
            per_param_available[p] = True
            per_param_streak[p] = longest_current_safe_streak(group[col], thresholds[p])

        available_params = [p for p in required_params if per_param_available.get(p)]
        missing_params = [p for p in required_params if not per_param_available.get(p)]

        if not available_params:
            results[str(pond_id)] = {
                "is_mature": None,
                "reason": f"Data gak punya kolom yang dibutuhkan: {required_params}",
            }
            continue

        min_streak = min(per_param_streak[p] for p in available_params)
        is_mature = min_streak >= required_days

        # sinyal pendukung: nitrate trend naik di beberapa hari terakhir
        nitrate_signal = None
        if "nitrate_mg_l_mean" in group.columns:
            recent = group["nitrate_mg_l_mean"].dropna().tail(5)
            if len(recent) >= 2:
                nitrate_signal = "naik" if recent.iloc[-1] > recent.iloc[0] else "stagnan/turun"

        results[str(pond_id)] = {
            "is_mature": is_mature,
            "consecutive_safe_days": {p: per_param_streak[p] for p in available_params},
            "required_consecutive_days": required_days,
            "params_missing_from_data": missing_params,
            "nitrate_trend_recent": nitrate_signal,
            "last_date_in_data": str(group["date"].max()),
            "message": (
                f"Matang — {min_streak} hari berturut-turut stabil aman (syarat: {required_days} hari). Siap tebar bibit."
                if is_mature else
                f"Belum matang — baru {min_streak} hari berturut-turut stabil aman (syarat: {required_days} hari). "
                f"Terus pantau, jangan tebar bibit dulu."
            ),
        }

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--profile", required=True, help="vannamei_marine | tilapia_freshwater | generic")
    args = parser.parse_args()

    daily = build_daily_history(args.csv)
    profile = profile_loader.load_profile(args.profile, csv_path_for_generic=args.csv)
    result = check_maturity(daily, profile)

    print(f"Profile: {profile['profile_id']} ({profile['species']})")
    print(json.dumps(result, indent=2, default=str))