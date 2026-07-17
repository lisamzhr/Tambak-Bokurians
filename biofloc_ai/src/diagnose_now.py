"""
Judge kondisi kolam SEKARANG dari reading paling baru — beda dari
predict_health.py (butuh histori panjang buat lag features + model .pkl) dan
maturity_check.py (butuh histori beberapa hari buat cek streak). Ini bisa
jalan walau kolam baru punya 1 reading, karena gak prediksi ke depan, cuma
nilai reading terbaru langsung dibandingin ke threshold profile.

Nambahin 2 hal yang belum ada di script lain:
  1. Cek TSS terhadap target management profile (tss_min_inoculum_mg_l /
     tss_overgrowth_risk_mg_l) — parameter ini sama sekali belum dipakai
     di feature_engineering.py/predict_health.py sebelumnya.
  2. Deteksi field yang belum pernah dikirim device sama sekali (sensor gap).

Cara pakai:
    python diagnose_now.py --csv ../data/dataset.csv --profile tilapia_freshwater
"""

import argparse
import json

import pandas as pd

import profiles as profile_loader

CORE_PARAMS = ["temperature_c", "do_mg_l", "ph", "ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l"]
DIRECTIONAL = ("ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l")
ALL_EXPECTED_FIELDS = ["ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l", "do_mg_l", "ph", "temperature_c", "TSS_mg_l"]


def get_latest_reading(csv_path: str, pond_col: str = "pond_id") -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    idx = df.groupby(pond_col)["timestamp"].idxmax()
    return df.loc[idx]


def _is_missing(row: pd.Series, field: str) -> bool:
    if field not in row.index:
        return True
    v = row[field]
    return v is None or (isinstance(v, float) and pd.isna(v))


def diagnose_pond(row: pd.Series, profile: dict) -> dict:
    thresholds = profile["thresholds"]
    mgmt = profile.get("management", {})

    status = {}
    values = {}
    for p in CORE_PARAMS:
        if _is_missing(row, p):
            continue
        val = float(row[p])
        values[p] = val
        if p in thresholds:
            if p in DIRECTIONAL:
                status[p] = profile_loader.classify_directional(val, thresholds[p])
            else:
                status[p] = profile_loader.classify_range(val, thresholds[p])

    # --- Cek TSS ---
    # Sumber utama: thresholds.TSS_mg_l (format low/high, sama kayak DO/pH/suhu)
    # Sumber tambahan: management.tss_min_inoculum_mg_l / tss_overgrowth_risk_mg_l
    #   (dipakai khusus buat cek "kolam baru belum matang" -- ini konteks setup awal,
    #   bukan monitoring rutin, jadi sifatnya informasi tambahan, bukan pengganti thresholds).
    tss_status = None
    tss_note = None
    tss_thresh = thresholds.get("TSS_mg_l")

    if not _is_missing(row, "TSS_mg_l"):
        tss_val = float(row["TSS_mg_l"])
        values["TSS_mg_l"] = tss_val

        if tss_thresh:
            tss_status = profile_loader.classify_range(tss_val, tss_thresh)
            status["TSS_mg_l"] = tss_status
            if tss_status == "safe":
                tss_note = f"TSS {tss_val} mg/L dalam rentang wajar ({tss_thresh['low']}-{tss_thresh['high']} mg/L)."
            else:
                tss_note = (
                    f"TSS {tss_val} mg/L di luar rentang wajar ({tss_thresh['low']}-{tss_thresh['high']} mg/L) "
                    f"— status: {tss_status}."
                )
        else:
            tss_note = f"TSS {tss_val} mg/L tercatat, tapi profile ini belum punya angka acuan (thresholds.TSS_mg_l kosong)."

        # Info tambahan khusus buat kolam yang baru mulai (belum matang)
        min_tss = mgmt.get("tss_min_inoculum_mg_l")
        if min_tss and tss_val < min_tss:
            tss_note += f" Catatan startup: masih di bawah minimum inokulum {min_tss} mg/L, floc kemungkinan belum matang."
        max_tss_risk = mgmt.get("tss_overgrowth_risk_mg_l")
        if max_tss_risk and tss_val > max_tss_risk:
            tss_note += f" Catatan: di atas ambang overgrowth {max_tss_risk} mg/L, pertimbangkan clarifier."
    else:
        tss_note = "Data TSS belum pernah dikirim buat kolam ini — penting buat tau kematangan biofloc, coba lengkapi."

    # --- Field yang belum pernah kekirim sama sekali ---
    missing_fields = [f for f in ALL_EXPECTED_FIELDS if _is_missing(row, f)]

    # --- Rekomendasi rule-based, berbasis kondisi SEKARANG (bukan proyeksi) ---
    recs = []
    cn = mgmt.get("cn_ratio_target")

    if status.get("ammonia_mg_l") == "danger":
        cn_note = f" (target rasio C:N {cn}:1)" if cn else ""
        recs.append(f"Amonia SEKARANG di level bahaya ({values.get('ammonia_mg_l')} mg/L) — tambah karbon organik/molase{cn_note} segera.")
    elif status.get("ammonia_mg_l") == "warning":
        recs.append(f"Amonia mulai naik ({values.get('ammonia_mg_l')} mg/L) — siapkan molase, pantau lebih sering.")

    if status.get("nitrite_mg_l") == "danger":
        recs.append(f"Nitrit SEKARANG di level bahaya ({values.get('nitrite_mg_l')} mg/L) — pertimbangkan water change.")

    if status.get("nitrate_mg_l") == "danger":
        recs.append(f"Nitrate SEKARANG di level bahaya ({values.get('nitrate_mg_l')} mg/L).")

    if status.get("do_mg_l") == "danger":
        recs.append("DO SEKARANG jauh dari rentang normal — cek aerator sekarang juga.")

    if status.get("ph") == "danger":
        recs.append("pH SEKARANG keluar rentang normal — cek dosis kapur/buffer.")

    if tss_status in ("warning", "danger"):
        recs.append(tss_note)

    if missing_fields:
        recs.append(f"Data yang belum pernah dikirim device: {', '.join(missing_fields)} — lengkapi biar diagnosis makin akurat.")

    if not recs:
        recs.append("Kondisi sekarang aman, gak ada yang perlu segera ditindaklanjuti.")

    return {
        "as_of": str(row["timestamp"]),
        "values": values,
        "status": status,
        "tss_status": tss_status,
        "tss_note": tss_note,
        "missing_fields": missing_fields,
        "recommendations": recs,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--profile", required=True, help="vannamei_marine | tilapia_freshwater | generic")
    args = parser.parse_args()

    latest = get_latest_reading(args.csv)
    profile = profile_loader.load_profile(args.profile, csv_path_for_generic=args.csv)

    result = {}
    for _, row in latest.iterrows():
        result[str(row["pond_id"])] = diagnose_pond(row, profile)

    print(f"Profile: {profile['profile_id']} ({profile['species']})")
    print(json.dumps(result, indent=2, default=str))