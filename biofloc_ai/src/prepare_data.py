"""
Cleaning untuk dataset "Sensor Based Aquaponics Fish Pond" (IoTPond7.csv, Kaggle).

Masalah yang ditangani (ditemukan dari inspeksi data):
  - Kolom sampah Unnamed: 11/12/13 (artefak parsing CSV mentah)
  - Amonia bernilai inf (~34% baris) -> jadi NaN
  - pH di luar rentang fisik 0-14 (~17% baris) -> jadi NaN
  - Suhu ekstrem di luar rentang wajar (mis. -127 C) -> jadi NaN
  - Turbidity negatif -> jadi NaN
  - Rename kolom ke skema standar yang dipakai feature_engineering.py & train_model.py
  - Tambah kolom pond_id (dataset ini cuma 1 kolam: Pond7) & timestamp

Nilai invalid diubah jadi NaN (bukan didrop barisnya), karena tahap bucketing
15-menit di feature_engineering.py sudah aman terhadap NaN (mean/min/max/std
otomatis skip NaN). Baris yang seluruh parameter numeriknya NaN baru didrop
di akhir.

Cara pakai:
    python prepare_data.py --csv ../data/IoTPond7.csv --pond-id Pond7
"""

import argparse
import os

import numpy as np
import pandas as pd

# Rentang fisik wajar -> di luar ini dianggap sensor error, jadi NaN
VALID_RANGES = {
    "temperature_c": (15, 35),
    "ph": (4, 10),
    "turbidity_ntu": (0, None),      # None = tanpa batas atas
    "do_mg_l": (0, 30),
    "ammonia_mg_l": (0, 50),          # >50 mg/L praktis mustahil di kolam nyata -> data glitch
    "nitrate_mg_l": (0, None),
}

RENAME_MAP = {
    "created_at": "timestamp",
    "temperature(C)": "temperature_c",
    "turbidity (NTU)": "turbidity_ntu",
    "Dissolved Oxygen (g/ml)": "do_mg_l",
    "PH": "ph",
    "ammonia(g/ml)": "ammonia_mg_l",
    "nitrate(g/ml)": "nitrate_mg_l",
    "Fish_length(cm)": "fish_length_cm",
    "Fish_weight(g)": "fish_weight_g",
}

DROP_COLS = ["Date", "entry_id", "Unnamed: 11", "Unnamed: 12", "Unnamed: 13"]


def clean(csv_path: str, pond_id: str) -> tuple[pd.DataFrame, dict]:
    df = pd.read_csv(csv_path, low_memory=False)
    report = {"rows_in": len(df)}

    # 1. buang kolom sampah/tidak relevan
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    # 2. rename ke skema standar
    df = df.rename(columns=RENAME_MAP)

    # 3. parse timestamp - dataset ini punya 2 format campur:
    #    "2021-06-29 01:46:09 CET" dan "2021-11-30T12:00:27+01:00"
    df["timestamp"] = pd.to_datetime(
        df["timestamp"].astype(str).str.replace(r"\s*[A-Z]{2,4}$", "", regex=True),
        utc=True,
        format="mixed",
        errors="coerce",
    )
    report["rows_bad_timestamp"] = int(df["timestamp"].isna().sum())
    df = df.dropna(subset=["timestamp"])

    # 4. inf -> NaN di semua kolom numerik
    numeric_cols = [c for c in RENAME_MAP.values() if c in df.columns and c != "timestamp"]
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan)

    # 5. filter rentang fisik wajar -> di luar itu jadi NaN
    range_report = {}
    for col, (low, high) in VALID_RANGES.items():
        if col not in df.columns:
            continue
        mask_invalid = df[col] < low
        if high is not None:
            mask_invalid |= df[col] > high
        range_report[col] = int(mask_invalid.sum())
        df.loc[mask_invalid, col] = np.nan
    report["invalid_per_column"] = range_report

    # 6. tambah pond_id
    df["pond_id"] = pond_id

    # 7. drop baris yang semua parameter numerik-nya NaN (gak berguna sama sekali)
    all_nan_mask = df[numeric_cols].isna().all(axis=1)
    report["rows_all_nan_dropped"] = int(all_nan_mask.sum())
    df = df[~all_nan_mask]

    # 8. urutkan waktu, buang duplikat timestamp exact per pond
    df = df.sort_values("timestamp")
    dup_mask = df.duplicated(subset=["pond_id", "timestamp"])
    report["duplicate_timestamps_dropped"] = int(dup_mask.sum())
    df = df[~dup_mask]

    keep_cols = ["timestamp", "pond_id"] + numeric_cols
    df = df[keep_cols].reset_index(drop=True)

    report["rows_out"] = len(df)
    report["missing_after_cleaning"] = df[numeric_cols].isna().sum().to_dict()

    return df, report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path ke CSV mentah (mis. IoTPond7.csv)")
    parser.add_argument("--pond-id", default="Pond7")
    parser.add_argument(
        "--output",
        default=None,
        help="Path output CSV bersih (default: <nama_file>_cleaned.csv di folder yang sama)",
    )
    args = parser.parse_args()

    if args.output is None:
        base, ext = os.path.splitext(args.csv)
        args.output = f"{base}_cleaned.csv"

    cleaned_df, rpt = clean(args.csv, args.pond_id)
    cleaned_df.to_csv(args.output, index=False)

    print(f"Baris masuk       : {rpt['rows_in']}")
    print(f"Timestamp invalid : {rpt['rows_bad_timestamp']}")
    print(f"Nilai out-of-range diubah jadi NaN per kolom:")
    for col, n in rpt["invalid_per_column"].items():
        print(f"  - {col}: {n}")
    print(f"Baris full-NaN dibuang     : {rpt['rows_all_nan_dropped']}")
    print(f"Duplikat timestamp dibuang : {rpt['duplicate_timestamps_dropped']}")
    print(f"Baris keluar (hasil bersih): {rpt['rows_out']}")
    print(f"Missing value tersisa per kolom (akan di-handle di tahap bucketing):")
    for col, n in rpt["missing_after_cleaning"].items():
        print(f"  - {col}: {n}")
    print(f"\nDisimpan ke: {args.output}")