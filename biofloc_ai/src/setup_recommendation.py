"""
Kalkulator rekomendasi SETUP AWAL kolam biofloc — dipanggil sekali di awal
(input luas/volume kolam + jenis tambak), BUKAN model ML. Semua angka dari
profile JSON (profiles/*.json), yang bersumber dari jurnal.

Cara pakai:
    python setup_recommendation.py --volume-liters 400 --profile vannamei_marine
"""

import argparse
import json

import profiles as profile_loader


def recommend_setup(volume_liters: float, profile_id: str) -> dict:
    profile = profile_loader.load_profile(profile_id)
    sg = profile.get("setup_guidance", {})
    mgmt = profile.get("management", {})

    result = {
        "profile": profile_id,
        "species": profile["species"],
        "pond_volume_liters": volume_liters,
        "recommendations": {},
    }

    inoc_pct = sg.get("inoculum_percent_of_volume")
    if inoc_pct:
        inoc_liters = round(volume_liters * inoc_pct / 100, 2)
        result["recommendations"]["inoculum"] = {
            "volume_liters": inoc_liters,
            "percent_of_pond": inoc_pct,
            "source_tss_mg_l": sg.get("inoculum_tss_source_mg_l"),
            "target_tss_mg_l": sg.get("inoculum_target_tss_mg_l"),
            "note": f"Ambil {inoc_liters} L air biofloc matang (TSS ~{sg.get('inoculum_tss_source_mg_l')} mg/L) "
                    f"buat inokulasi kolam {volume_liters} L ini.",
        }
        result["recommendations"]["estimated_maturity"] = sg.get("estimated_maturity_days_with_inoculum")
    else:
        result["recommendations"]["inoculum"] = {
            "note": "Belum ada data spesifik dosis inokulum buat spesies ini. "
                    "Kalau ada akses ke air biofloc matang dari kolam lain, tetap disarankan "
                    "pakai (mempercepat stabilisasi), volume ikut takaran umum ~1-2% dari volume kolam."
        }
        result["recommendations"]["estimated_maturity"] = sg.get("estimated_maturity_days_without_inoculum")

    if mgmt.get("cn_ratio_target"):
        result["recommendations"]["carbon_dosing"] = {
            "cn_ratio_target": mgmt["cn_ratio_target"],
            "note": f"Jaga rasio C:N di {mgmt['cn_ratio_target']}:1 pakai sumber karbon (molase/tepung) "
                    f"buat stimulasi bakteri heterotrof. Dosis presisi tergantung total-N dari pakan, "
                    f"perlu dihitung ulang tiap minggu berdasar sisa pakan & biomassa.",
        }

    if mgmt.get("tss_overgrowth_risk_mg_l"):
        result["recommendations"]["solids_management"] = (
            f"Pantau TSS — di atas {mgmt['tss_overgrowth_risk_mg_l']} mg/L pertimbangkan clarifier "
            f"biar gak numpuk solid berlebihan."
        )

    stock = profile.get("stocking_guidance", {})
    if stock.get("density_per_m3"):
        volume_m3 = volume_liters / 1000
        n_individuals = round(stock["density_per_m3"] * volume_m3)
        total_biomass_g = round(n_individuals * stock["initial_weight_g"], 1)
        result["recommendations"]["stocking"] = {
            "jumlah_bibit_ekor": n_individuals,
            "berat_awal_per_ekor_g": stock["initial_weight_g"],
            "total_biomassa_tebar_g": total_biomass_g,
            "densitas_acuan_per_m3": stock["density_per_m3"],
            "source": stock.get("source"),
            "note": f"Buat kolam {volume_liters} L ({volume_m3:.2f} m3), tebar sekitar {n_individuals} ekor bibit "
                    f"(@~{stock['initial_weight_g']} g/ekor) = total biomassa tebar ~{total_biomass_g} g. "
                    f"{stock.get('notes', '')}",
        }
    else:
        result["recommendations"]["stocking"] = {
            "note": "Belum ada data densitas tebar spesifik buat spesies/profile ini."
        }

    result["recommendations"]["next_step"] = (
        "Setelah tebar inokulum, pantau amonia & nitrit harian pakai predict_health.py / maturity_check.py "
        "sampai status 'matang' tercapai sebelum tebar bibit."
    )

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--volume-liters", type=float, required=True)
    parser.add_argument("--profile", required=True, help="vannamei_marine | tilapia_freshwater | nama profile lain")
    args = parser.parse_args()

    out = recommend_setup(args.volume_liters, args.profile)
    print(json.dumps(out, indent=2))