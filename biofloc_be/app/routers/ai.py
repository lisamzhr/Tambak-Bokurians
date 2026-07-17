import os
import sys
import json
import subprocess
import tempfile
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from app.database import ponds_col, readings_col
from app.config import settings
from app.auth.dependencies import get_current_user
from app.routers.ponds import assert_owner

router = APIRouter(prefix="/ponds", tags=["AI Engine"])

# Resolve path AI_SRC_DIR agar selalu absolut & aman di OS apa pun
AI_SRC_DIR = os.path.abspath(os.path.join(os.getcwd(), settings.ai_src_dir))

def run_ai_script(script_name: str, args: list) -> dict:
    """Helper untuk menjalankan script python AI dan menangkap output JSON-nya."""
    python_bin = sys.executable  # Menggunakan python env yang sedang berjalan
    cmd = [python_bin, script_name] + args

    if not os.path.exists(os.path.join(AI_SRC_DIR, script_name)):
        raise HTTPException(
            500, f"Script AI '{script_name}' tidak ditemukan di {AI_SRC_DIR}"
        )

    result = subprocess.run(
        cmd,
        cwd=AI_SRC_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        raise HTTPException(
            500, f"AI Engine Error ({script_name}): {result.stderr}"
        )

    stdout = result.stdout
    start = stdout.find("{")
    end = stdout.rfind("}")
    if start == -1 or end == -1:
        raise HTTPException(
            500, f"Format output AI tidak valid (Gagal menemukan JSON): {stdout}"
        )

    return json.loads(stdout[start:end+1])


def export_db_to_temp_csv(pond_id: str) -> str:
    """Mengambil semua data ter-bucket dari MongoDB dan menyusun CSV per detik secara runut waktu untuk AI."""
    # Ambil seluruh dokumen bucket milik kolam ini, urutkan dari bucket terlama ke terbaru
    buckets = list(readings_col.find({"pond_id": pond_id}).sort("first_ts", 1))
    if not buckets:
        raise HTTPException(400, "Belum ada data sensor masuk untuk kolam ini.")

    rows = []
    for b in buckets:
        for r in b.get("readings", []):
            ts_val = r.get("ts")
            # Konversi objek datetime ke string ISO agar bisa dibaca Pandas & AI Script
            if ts_val and hasattr(ts_val, "isoformat"):
                ts_str = ts_val.isoformat()
                date_str = ts_val.strftime("%Y-%m-%d")
            else:
                ts_str = str(ts_val)
                date_str = ts_str[:10] if len(ts_str) >= 10 else "2026-07-16"

            rows.append({
                "timestamp": ts_str,        # Kolom wajib AI
                "pond_id": pond_id,         # Kolom wajib AI
                "date": date_str,           # Kolom penunjang analisis harian AI
                "ph": r.get("ph"),
                "temperature_c": r.get("temperature_c"),
                "do_mg_l": r.get("do_mg_l"),
                "ammonia_mg_l": r.get("ammonia_mg_l"),
                "nitrite_mg_l": r.get("nitrite_mg_l"),
                "nitrate_mg_l": r.get("nitrate_mg_l"),
                "TSS_mg_l": r.get("TSS_mg_l")
            })

    if not rows:
        raise HTTPException(400, "Data sensor kolam kosong / tidak lengkap.")

    df = pd.DataFrame(rows)
    # Urutkan data per detik secara mutlak sebelum di-save jadi CSV
    df = df.sort_values("timestamp")

    fd, path = tempfile.mkstemp(suffix=f"_{pond_id}.csv")
    os.close(fd)
    df.to_csv(path, index=False)
    return path

# ==================== ENDPOINT 1: SETUP RECOMMENDATION ====================
@router.get("/{pond_id}/ai-setup")
def get_ai_setup(pond_id: str, current_user: dict = Depends(get_current_user)):
    pond = assert_owner(pond_id, current_user["username"])
    volume = str(pond.get("volume_liters", 1000.0))
    profile = pond.get("profile_id", "tilapia_freshwater")

    args = ["--volume-liters", volume, "--profile", profile]
    return run_ai_script("setup_recommendation.py", args)


# ==================== ENDPOINT 2: MATURITY CHECK ====================
@router.get("/{pond_id}/ai-maturity")
def get_ai_maturity(pond_id: str, current_user: dict = Depends(get_current_user)):
    pond = assert_owner(pond_id, current_user["username"])
    profile = pond.get("profile_id", "tilapia_freshwater")

    csv_path = export_db_to_temp_csv(pond_id)
    try:
        args = ["--csv", csv_path, "--profile", profile]

        # pond_start: pakai created_at eksplisit kalau ada, fallback ke waktu
        # pembuatan dokumen (ObjectId), fallback terakhir ke tanggal data (script bawaan)
        pond_start = pond.get("created_at")
        if pond_start and hasattr(pond_start, "strftime"):
            args += ["--pond-start", pond_start.strftime("%Y-%m-%d")]
        elif pond.get("_id") is not None:
            args += ["--pond-start", pond["_id"].generation_time.strftime("%Y-%m-%d")]

        used_inoculum = pond.get("used_inoculum")
        if used_inoculum is not None:
            args += ["--used-inoculum"] if used_inoculum else ["--no-inoculum"]

        result = run_ai_script("maturity_check.py", args)
    except Exception as e:
        if os.path.exists(csv_path): os.remove(csv_path)
        raise e

    if os.path.exists(csv_path): os.remove(csv_path)
    return result


# ==================== ENDPOINT 3: HEALTH CHECK (PREDICT) ====================
@router.get("/{pond_id}/ai-health")
def get_ai_health(pond_id: str, current_user: dict = Depends(get_current_user)):
    pond = assert_owner(pond_id, current_user["username"])
    profile = pond.get("profile_id", "tilapia_freshwater")

    # --- PENCEGAHAN AUTOMATIS AGAR TIDAK CRASH ---
    # Cek apakah file model .pkl untuk profil ini sudah ada di folder biofloc_ai/models/
    models_dir = os.path.abspath(os.path.join(AI_SRC_DIR, "..", "models"))
    model_file_name = f"{profile}_models.pkl"
    if profile == "vannamei_marine":
        model_file_name = "vannamei_marine_models.pkl" # Sesuai dengan nama yang dicari script AI
        
    model_path = os.path.join(models_dir, model_file_name)

    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=400,
            detail=f"Model AI (.pkl) untuk profil '{profile}' belum tersedia atau belum dilatih. "
                   f"Silakan gunakan kolam dengan profil 'tilapia_freshwater' yang modelnya sudah siap!"
        )
    # ---------------------------------------------

    csv_path = export_db_to_temp_csv(pond_id)
    try:
        args = ["--csv", csv_path, "--profile", profile]
        result = run_ai_script("predict_health.py", args)
    except Exception as e:
        if os.path.exists(csv_path): os.remove(csv_path)
        raise e

    if os.path.exists(csv_path): os.remove(csv_path)
    return result

# ==================== ENDPOINT 4: DIAGNOSE NOW (kondisi sekarang, gak butuh histori) ====================
@router.get("/{pond_id}/ai-diagnose")
def get_ai_diagnose(pond_id: str, current_user: dict = Depends(get_current_user)):
    pond = assert_owner(pond_id, current_user["username"])
    profile = pond.get("profile_id", "tilapia_freshwater")

    csv_path = export_db_to_temp_csv(pond_id)
    try:
        args = ["--csv", csv_path, "--profile", profile]
        result = run_ai_script("diagnose_now.py", args)
    except Exception as e:
        if os.path.exists(csv_path): os.remove(csv_path)
        raise e

    if os.path.exists(csv_path): os.remove(csv_path)
    return result