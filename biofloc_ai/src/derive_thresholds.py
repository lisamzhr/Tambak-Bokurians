"""
Hitung threshold "safe / warning / danger" dari HISTORI DATA KOLAM ITU SENDIRI,
bukan dari jurnal (yang sistem/spesiesnya beda -> gak nyambung, lihat diskusi
sebelumnya soal DO & pH aquaponics vs BFT udang laut).

Logika: anggap kondisi kolam selama ini (yang gak bikin ikan mati) sebagai
baseline "normal". Rentang persentil 25-75 = safe (kondisi umum/khas),
5-95 = warning (agak di luar kebiasaan), di luar 5-95 = danger (anomali).

Ini pendekatan anomaly-detection, bukan pendekatan toksikologi biologis kayak
threshold jurnal. Kalau nanti kamu punya data dari sistem biofloc udang
beneran, threshold jurnal (config.py) tetap yang harus dipakai, bukan ini.

Cara pakai:
    python derive_thresholds.py --csv ../data/IoTPond7_cleaned.csv
"""

import argparse
import json
import os

import pandas as pd

PARAMS = ["temperature_c", "do_mg_l", "ph", "ammonia_mg_l", "nitrate_mg_l", "turbidity_ntu"]


def derive(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    thresholds = {}

    for p in PARAMS:
        if p not in df.columns:
            continue
        series = df[p].dropna()
        if len(series) < 30:
            continue

        q = series.quantile([0.05, 0.25, 0.50, 0.75, 0.95])
        thresholds[p] = {
            "p05": round(float(q[0.05]), 4),
            "p25": round(float(q[0.25]), 4),
            "p50_median": round(float(q[0.50]), 4),
            "p75": round(float(q[0.75]), 4),
            "p95": round(float(q[0.95]), 4),
            "n_samples": int(len(series)),
        }

    return thresholds


def classify_data_driven(value, param_thresholds: dict) -> str:
    """safe = dalam p25-p75, warning = dalam p05-p95, danger = di luar itu."""
    if value is None or value != value or param_thresholds is None:
        return None
    if param_thresholds["p25"] <= value <= param_thresholds["p75"]:
        return "safe"
    if param_thresholds["p05"] <= value <= param_thresholds["p95"]:
        return "warning"
    return "danger"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument(
        "--output",
        default=os.path.join(os.path.dirname(__file__), "..", "models", "data_driven_thresholds.json"),
    )
    args = parser.parse_args()

    result = derive(args.csv)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    print("Threshold data-driven per parameter (dari histori kolam ini):")
    for p, t in result.items():
        print(f"  {p}: safe={t['p25']}-{t['p75']}  warning-range={t['p05']}-{t['p95']}  (n={t['n_samples']})")
    print(f"\nDisimpan ke: {args.output}")