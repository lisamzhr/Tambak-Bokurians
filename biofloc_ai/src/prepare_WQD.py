"""
prepare_data.py untuk dataset WQD.csv
"""

import argparse
import os
import numpy as np
import pandas as pd


def clean(csv_path: str, pond_id: str):
    df = pd.read_csv(csv_path)

    # 1. Samakan nama kolom ke format standar di awal proses
    RENAME_MAP = {
        "Temp": "temperature_c",
        "DO(mg/L)": "do_mg_l",
        "pH`": "ph",
        "pH": "ph",
        "Ammonia (mg L-1 )": "ammonia_mg_l",
        "Nitrite (mg L-1 )": "nitrite_mg_l",
    }
    df = df.rename(columns=RENAME_MAP)

    report = {
        "rows_in": len(df)
    }

    # ======================
    # Timestamp
    # ======================
    if "timestamp" not in df.columns:
        raise ValueError("Kolom 'timestamp' tidak ditemukan.")

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce"
    )

    report["rows_bad_timestamp"] = int(df["timestamp"].isna().sum())

    df = df.dropna(subset=["timestamp"])

    # ======================
    # pond id
    # ======================
    df["pond_id"] = pond_id

    # ======================
    # Semua selain timestamp & pond_id dianggap numerik
    # ======================
    numeric_cols = [
        c for c in df.columns
        if c not in ["timestamp", "pond_id"]
    ]

    for c in numeric_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df[numeric_cols] = df[numeric_cols].replace(
        [np.inf, -np.inf],
        np.nan
    )

    # ======================
    # Drop hanya jika SEMUA sensor kosong
    # ======================
    all_nan = df[numeric_cols].isna().all(axis=1)

    report["rows_all_nan_dropped"] = int(all_nan.sum())

    df = df.loc[~all_nan]

    # ======================
    # Sort
    # ======================
    df = df.sort_values("timestamp")

    dup = df.duplicated(
        subset=["pond_id", "timestamp"]
    )

    report["duplicate_timestamps_dropped"] = int(dup.sum())

    df = df.loc[~dup]

    keep_cols = ["timestamp", "pond_id"] + numeric_cols

    df = df[keep_cols].reset_index(drop=True)

    report["rows_out"] = len(df)

    report["missing_after_cleaning"] = (
        df[numeric_cols]
        .isna()
        .sum()
        .to_dict()
    )
    return df, report

if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument("--csv", required=True)

    parser.add_argument("--pond-id", default="Tambak1")

    parser.add_argument("--output", default=None)

    args = parser.parse_args()

    if args.output is None:
        base, ext = os.path.splitext(args.csv)
        args.output = base + "_cleaned.csv"

    cleaned, rpt = clean(args.csv, args.pond_id)

    cleaned.to_csv(args.output, index=False)

    print("Baris masuk       :", rpt["rows_in"])
    print("Timestamp invalid :", rpt["rows_bad_timestamp"])
    print("Baris full-NaN dibuang     :", rpt["rows_all_nan_dropped"])
    print("Duplikat timestamp dibuang :", rpt["duplicate_timestamps_dropped"])
    print("Baris keluar (hasil bersih):", rpt["rows_out"])
    print()

    print("Missing value:")

    for k, v in rpt["missing_after_cleaning"].items():
        print(f"  {k}: {v}")

    print("\nDisimpan ke:", args.output)