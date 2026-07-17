"""
Cek apakah biofloc di kolam SUDAH MATANG (siap ditebar bibit), berdasar histori
data sensor — bukan prediksi ke depan (itu tugasnya predict_health.py), ini
ngecek MASA LALU: udah berapa hari berturut-turut amonia/nitrit stabil aman.

Kriteria "matang" gabungan (dari profile['maturity_criteria'] + setup_guidance):
    1. STABILITAS (syarat utama, tetap ada):
       - Parameter wajib (params_required, mis. ammonia & nitrite) berstatus
         'safe' selama N hari BERTURUT-TURUT (consecutive_safe_days_required)
       - Nitrate trend naik dipakai sebagai sinyal pendukung (bukan syarat wajib)

    2. TIMELINE JURNAL (baru — konteks, bukan syarat wajib):
       - Dihitung dari kapan kolam mulai jalan (pond_start) sampai tanggal
         data paling baru -> elapsed_days
       - Dibandingkan sama estimasi jurnal di profile['setup_guidance']
         (estimated_maturity_days_with_inoculum / _without_inoculum, mis "7-14"
         atau "16-30+")
       - Hasilnya dipakai buat nge-flag kondisi ganjil: matang jauh lebih
         cepat/lambat dari prediksi jurnal, atau udah lewat prediksi tapi
         belum stabil (indikasi ada masalah)

    Keputusan is_mature TETAP murni dari stabilitas aktual (poin 1) —
    timeline jurnal cuma konteks/sinyal tambahan, bukan pengganti data real.

Cara pakai:
    python maturity_check.py --csv ../data/dataset_cleaned.csv --profile vannamei_marine \
        --pond-start 2026-06-01 --used-inoculum

    # kalau --pond-start gak dikasih, fallback pakai tanggal data paling awal
    # (kurang akurat kalau kolam udah jalan sebelum data mulai kecatat)
    # kalau --used-inoculum / --no-inoculum gak dikasih, perbandingan jurnal
    # di-skip (cuma laporan stabilitas biasa)
"""

import argparse
import json
import os
from datetime import timedelta

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


def parse_day_range(range_str: str) -> dict:
    """Parse ANGKA DI DEPAN string estimasi jurnal aja, sisanya (catatan/sumber) diabaikan.
    Contoh yang harus jalan bener:
        '7-14'                                          -> low=7, high=14
        '16-30+'                                         -> low=16, high=30, open_ended
        '7-14 (estimasi umum, belum ada studi ...)'       -> low=7, high=14
        '49-56 (7-8 minggu, angka umum biofloc ...)'      -> low=49, high=56  (bukan ke-parse jadi 49-56-7-8)
    """
    import re
    match = re.match(r"\s*(\d+)\s*-\s*(\d+)\s*(\+)?", range_str)
    if not match:
        raise ValueError(f"Gak bisa parse rentang hari dari: {range_str!r}")
    low = int(match.group(1))
    high = int(match.group(2))
    open_ended = bool(match.group(3))
    return {"low": low, "high": high, "open_ended": open_ended, "raw": range_str}


def journal_scenario(profile: dict, used_inoculum: bool, elapsed_days: int, start_date, is_mature: bool):
    """Bangun satu skenario (asumsi pakai inokulum ATAU nggak) lengkap sama target tanggal matengnya.
    Return None kalau profile gak punya estimasi buat skenario ini."""
    setup = profile.get("setup_guidance", {})
    key = (
        "estimated_maturity_days_with_inoculum"
        if used_inoculum
        else "estimated_maturity_days_without_inoculum"
    )
    range_str = setup.get(key)
    if not range_str:
        return None
    parsed = parse_day_range(range_str)
    target_low = start_date + timedelta(days=parsed["low"])
    target_high = start_date + timedelta(days=parsed["high"])
    high_label = (">= " if parsed["open_ended"] else "") + str(target_high.date())
    return {
        "assumed_inoculum_used": used_inoculum,
        "journal_estimated_days": parsed["raw"],
        "estimated_target_date_range": [str(target_low.date()), high_label],
        "note": build_journal_message(elapsed_days, parsed, is_mature),
    }


def journal_expected_range(profile: dict, used_inoculum: "bool | None", elapsed_days: int, start_date, is_mature: bool):
    """Kalau used_inoculum diketahui -> satu skenario. Kalau gak diketahui (None) -> dua skenario
    sekaligus (pakai inokulum vs nggak) biar tetap informatif, gak cuma null."""
    if used_inoculum is not None:
        return journal_scenario(profile, used_inoculum, elapsed_days, start_date, is_mature)

    with_scn = journal_scenario(profile, True, elapsed_days, start_date, is_mature)
    without_scn = journal_scenario(profile, False, elapsed_days, start_date, is_mature)
    if not with_scn and not without_scn:
        return None
    return {
        "note": "used_inoculum belum diisi di data pond — ini dua skenario sekaligus, isi field itu buat dapet estimasi yang pasti.",
        "if_used_inoculum": with_scn,
        "if_no_inoculum": without_scn,
    }


def build_journal_message(elapsed_days: int, jrange: dict, is_mature: bool) -> str:
    low, high = jrange["low"], jrange["high"]
    if elapsed_days < low:
        if is_mature:
            return (
                f"Matang lebih cepat dari prediksi jurnal (hari ke-{elapsed_days}, "
                f"jurnal memperkirakan {jrange['raw']} hari). Bagus, tapi pastikan streak stabilnya bener valid."
            )
        return (
            f"Belum matang — masih wajar, baru hari ke-{elapsed_days} dari estimasi jurnal {jrange['raw']} hari."
        )
    if low <= elapsed_days <= high:
        if is_mature:
            return f"Matang sesuai jendela prediksi jurnal (hari ke-{elapsed_days}, estimasi {jrange['raw']} hari)."
        return (
            f"Belum matang, tapi udah masuk jendela prediksi jurnal (hari ke-{elapsed_days} dari {jrange['raw']} hari). "
            f"Terus pantau, wajar kalau butuh beberapa hari lagi."
        )
    # elapsed_days > high
    if is_mature:
        return (
            f"Matang, tapi lebih lambat dari prediksi jurnal (hari ke-{elapsed_days} vs estimasi {jrange['raw']} hari)."
        )
    return (
        f"Belum matang dan udah LEWAT estimasi jurnal (hari ke-{elapsed_days} vs maksimal {high} hari). "
        f"Indikasi ada yang gak beres — cek TSS, C:N ratio, atau kemungkinan overload pakan."
    )


def check_maturity(
    daily_df: pd.DataFrame,
    profile: dict,
    pond_col: str = "pond_id",
    pond_start=None,
    used_inoculum: "bool | None" = None,
) -> dict:
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

        # ---- timeline: kapan kolam mulai vs data paling baru ----
        first_date_in_data = pd.to_datetime(group["date"].min())
        last_date_in_data = pd.to_datetime(group["date"].max())
        start_date = pd.to_datetime(pond_start) if pond_start else first_date_in_data
        elapsed_days = (last_date_in_data - start_date).days + 1
        start_date_is_assumed = pond_start is None

        base_message = (
            f"Matang — {min_streak} hari berturut-turut stabil aman (syarat: {required_days} hari). Siap tebar bibit."
            if is_mature else
            f"Belum matang — baru {min_streak} hari berturut-turut stabil aman (syarat: {required_days} hari). "
            f"Terus pantau, jangan tebar bibit dulu."
        )

        journal_context = journal_expected_range(profile, used_inoculum, elapsed_days, start_date, is_mature)

        results[str(pond_id)] = {
            "is_mature": is_mature,
            "consecutive_safe_days": {p: per_param_streak[p] for p in available_params},
            "required_consecutive_days": required_days,
            "params_missing_from_data": missing_params,
            "nitrate_trend_recent": nitrate_signal,
            "pond_start_date": str(start_date.date()),
            "pond_start_date_is_assumed": start_date_is_assumed,
            "elapsed_days_since_pond_start": elapsed_days,
            "last_date_in_data": str(group["date"].max()),
            # None cuma kalau profile gak punya setup_guidance sama sekali;
            # kalau used_inoculum gak dikasih, ini isinya dua skenario (if_used_inoculum / if_no_inoculum)
            "journal_timeline": journal_context,
            "message": base_message,
        }

        if start_date_is_assumed:
            results[str(pond_id)]["message"] += (
                " (catatan: pond_start gak dikasih, dihitung dari tanggal data paling awal — "
                "kirim pond_start biar timeline akurat kalau kolam udah jalan sebelum data mulai kecatat)"
            )

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--profile", required=True, help="vannamei_marine | tilapia_freshwater | generic")
    parser.add_argument("--pond-start", default=None, help="Tanggal kolam mulai dijalankan, format YYYY-MM-DD. Kalau gak dikasih, fallback ke tanggal data paling awal.")
    inoculum_group = parser.add_mutually_exclusive_group()
    inoculum_group.add_argument("--used-inoculum", dest="used_inoculum", action="store_true", default=None, help="Kolam disetup pakai inokulum biofloc matang")
    inoculum_group.add_argument("--no-inoculum", dest="used_inoculum", action="store_false", help="Kolam disetup TANPA inokulum")
    args = parser.parse_args()

    daily = build_daily_history(args.csv)
    profile = profile_loader.load_profile(args.profile, csv_path_for_generic=args.csv)
    result = check_maturity(
        daily,
        profile,
        pond_start=args.pond_start,
        used_inoculum=args.used_inoculum,
    )

    print(f"Profile: {profile['profile_id']} ({profile['species']})")
    print(json.dumps(result, indent=2, default=str))