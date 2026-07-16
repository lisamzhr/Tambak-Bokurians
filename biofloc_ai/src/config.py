"""
Threshold & referensi dari jurnal:
Wasielesky et al. 2026, "Determining the Minimum Mature Inoculum Requirement
for Nitrification Efficiency and Enhanced Zootechnical Performance of
Penaeus vannamei in BFT System", Aquaculture Journal 6(1):6.

Semua angka di bawah dikutip langsung dari jurnal (bukan asumsi).
Kalau nanti kolam kamu beda spesies/salinitas, angka ini perlu disesuaikan.
"""

# --- Safety thresholds (mg/L) ---
# Ammonia total (TAN) - di atas ini, survival shrimp anjlok drastis (control/2.5
# treatment kena 48-66% survival vs 95% di treatment ber-inokulum)
AMMONIA_SAFE_MAX = 3.95        # Lin & Chen 2001, dikutip di jurnal
AMMONIA_WARNING = 2.0          # ambang mulai waspada (treatment 5 mg/L jaga di bawah ini)

# Nitrit
NITRITE_SAFE_MAX = 25.7        # safety level pada salinitas 30
NITRITE_WATER_CHANGE_TRIGGER = 20.0  # SOP jurnal: ganti 30% air kalau nitrit lewat ini

# Nitrat
NITRATE_SAFE_MAX = 300.0       # tidak pernah terlampaui di eksperimen ini

# --- Rasio & dosis ---
CN_RATIO_TARGET = 15           # rasio karbon:nitrogen buat stimulasi bakteri heterotrof
                                # (dosis molase disesuaikan biar rasio ini tercapai)

# --- Rentang normal harian (dari Table 3, treatment yang berhasil) ---
NORMAL_RANGES = {
    "temperature_c": (25.0, 27.0),
    "do_mg_l": (6.2, 6.9),
    "ph": (7.3, 8.0),           # koreksi Ca(OH)2 dilakukan kalau pH < 7.3
    "alkalinity_mg_l": (150.0, 225.0),  # koreksi dilakukan kalau < 150
}

# --- Inokulum (relevan kalau kamu juga mau model startup/seeding, bukan cuma harian) ---
TSS_MIN_INOCULUM_MG_L = 5.0    # minimum TSS inokulum yang cukup buat stabilisasi cepat
                                # tanpa overgrowth solid berlebihan (temuan utama jurnal)
TSS_OVERGROWTH_RISK_MG_L = 20.0  # di atas ini, solids numpuk cepat & butuh clarifier

# --- Level klasifikasi risiko (dipakai feature_engineering.flag_risk) ---
def classify(value, warn, danger):
    """Return 'safe' | 'warning' | 'danger' berdasar satu ambang warning + satu ambang danger."""
    if value is None or value != value:  # NaN check
        return None
    if value >= danger:
        return "danger"
    if value >= warn:
        return "warning"
    return "safe"


def classify_range(value, low, high, tolerance=0.15):
    """Return 'safe' | 'warning' | 'danger' untuk parameter dengan rentang normal (mis. DO, pH).
    tolerance = persentase toleransi di luar rentang sebelum dianggap 'danger'."""
    if value is None or value != value:
        return None
    if low <= value <= high:
        return "safe"
    span = high - low
    if low - span * tolerance <= value <= high + span * tolerance:
        return "warning"
    return "danger"