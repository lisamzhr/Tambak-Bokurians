"""
Loader profile tambak. Satu profile = 1 file JSON di folder profiles/
berisi threshold khusus spesies/sistem (lihat vannamei_marine.json,
tilapia_freshwater.json).

Kalau spesiesnya belum ada profile jurnalnya, pakai profile_id="generic" ->
threshold dihitung otomatis dari histori data kolam itu sendiri (percentile
5/25/75/95, lihat _build_generic_profile di bawah), bukan dari literatur.
"""

import json
import os

import pandas as pd

PROFILES_DIR = os.path.join(os.path.dirname(__file__), "..", "profiles")


def list_profiles() -> list:
    if not os.path.isdir(PROFILES_DIR):
        return []
    return [f.replace(".json", "") for f in os.listdir(PROFILES_DIR) if f.endswith(".json")]


def load_profile(profile_id: str, csv_path_for_generic: str = None) -> dict:
    """Return dict profile. Kalau profile_id == 'generic', threshold dihitung
    live dari csv_path_for_generic (percentile 5/25/75/95 per parameter)."""

    if profile_id == "generic":
        if csv_path_for_generic is None:
            raise ValueError("Profile 'generic' butuh csv_path_for_generic buat hitung threshold.")
        return _build_generic_profile(csv_path_for_generic)

    path = os.path.join(PROFILES_DIR, f"{profile_id}.json")
    if not os.path.exists(path):
        available = list_profiles()
        raise FileNotFoundError(
            f"Profile '{profile_id}' gak ketemu di {PROFILES_DIR}. "
            f"Profile tersedia: {available + ['generic']}"
        )
    with open(path) as f:
        return json.load(f)


def _build_generic_profile(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    params = ["temperature_c", "do_mg_l", "ph", "ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l"]

    thresholds = {}
    for p in params:
        if p not in df.columns:
            continue
        series = df[p].dropna()
        if len(series) < 30:
            continue
        q = series.quantile([0.05, 0.25, 0.75, 0.95])

        # parameter dengan "arah bahaya" jelas (makin tinggi makin toxic) -> pakai warning/danger
        if p in ("ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l"):
            thresholds[p] = {"warning": round(float(q[0.75]), 4), "danger": round(float(q[0.95]), 4)}
        else:
            # parameter dengan rentang normal dua sisi (DO, pH, suhu) -> pakai low/high dari p25-p75
            thresholds[p] = {
                "low": round(float(q[0.25]), 4),
                "high": round(float(q[0.75]), 4),
                "tolerance": 0.15,
            }

    return {
        "profile_id": "generic",
        "species": "Tidak diketahui / belum ada profile literatur",
        "system": "Data-driven (dihitung dari histori data sendiri)",
        "source": f"Percentile historis dari {csv_path}",
        "notes": "Threshold ini relatif ke kebiasaan kolam itu sendiri (anomaly-detection), bukan batas toksikologi biologis.",
        "thresholds": thresholds,
        "management": {"cn_ratio_target": None, "tss_min_inoculum_mg_l": None, "tss_overgrowth_risk_mg_l": None},
    }


def classify_directional(value, thresh: dict) -> str:
    """Buat parameter yang 'makin tinggi makin bahaya' (ammonia, nitrit, nitrat)."""
    if value is None or value != value or thresh is None:
        return None
    if value >= thresh["danger"]:
        return "danger"
    if value >= thresh["warning"]:
        return "warning"
    return "safe"


def classify_range(value, thresh: dict) -> str:
    """Buat parameter dengan rentang normal dua sisi (DO, pH, suhu)."""
    if value is None or value != value or thresh is None:
        return None
    low, high = thresh["low"], thresh["high"]
    tolerance = thresh.get("tolerance", 0.15)
    if low <= value <= high:
        return "safe"
    span = high - low
    if low - span * tolerance <= value <= high + span * tolerance:
        return "warning"
    return "danger"


if __name__ == "__main__":
    print("Profile tersedia:", list_profiles() + ["generic"])