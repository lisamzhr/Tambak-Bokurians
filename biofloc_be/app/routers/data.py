from datetime import date, timedelta
from fastapi import APIRouter, Query, Depends
import pandas as pd

from app.services.bucket_service import get_readings
from app.auth.dependencies import get_current_user
from app.routers.ponds import assert_owner
from app.services.feature_engineering import bucket_15min, daily_rollup, add_lag_features

router = APIRouter(prefix="/ponds", tags=["data"])

@router.get("/{pond_id}/readings")
def readings_for_chart(
    pond_id: str,
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    assert_owner(pond_id, current_user["username"])

    if date_to is None:
        date_to = date.today().isoformat()
    if date_from is None:
        date_from = (date.today() - timedelta(days=7)).isoformat()

    readings = get_readings(pond_id, date_from, date_to)
    return {
        "pond_id": pond_id,
        "date_from": date_from,
        "date_to": date_to,
        "count": len(readings),
        "readings": readings,
    }

@router.get("/{pond_id}/features")
def get_ml_features(
    pond_id: str,
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    """Endpoint untuk pipeline ML. Mengubah raw readings jadi daily rollups + lags (Tahan Banting)."""
    assert_owner(pond_id, current_user["username"])
    
    if date_to is None:
        date_to = date.today().isoformat()
    if date_from is None:
        # Kita perkecil defaultnya ke 7 hari saja tidak apa-apa, karena kodenya sudah anti-kosong
        date_from = (date.today() - timedelta(days=7)).isoformat() 

    readings = get_readings(pond_id, date_from, date_to)
    if not readings:
        return {"status": "empty", "message": "Belum ada data mentah sama sekali di database.", "data": []}

    # 1. Convert dictionary list to Pandas DataFrame
    df = pd.DataFrame(readings)
    df = df.rename(columns={"ts": "timestamp"})
    
    # 🔥 PENCEGAHAN 1: Pastikan kolom timestamp bertipe datetime agar resample() tidak error
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["pond_id"] = pond_id
    df = df.sort_values("timestamp").reset_index(drop=True)
    
    try:
        # 2. Jalankan pipeline dari feature_engineering.py
        df_15m = bucket_15min(df)
        df_daily = daily_rollup(df_15m)
        
        # 3. Jalankan lag features
        df_features = add_lag_features(df_daily)
        
        # 🔥 PENCEGAHAN 2: Jika script lag kamu menggunakan .dropna(), matikan atau timpa di sini!
        # Kita isi semua kolom NaN (efek data kurang hari) dengan angka 0 atau rata-rata agar barisnya tidak hilang
        df_features = df_features.fillna(0)
        
        # Jika setelah di-proses ternyata df_features kosong, fallback balik ke data harian saja
        if df_features.empty:
            df_daily = df_daily.fillna(0)
            return df_daily.reset_index().to_dict(orient="records")
            
        return df_features.reset_index().to_dict(orient="records")
        
    except Exception as e:
        # Fallback terakhir: Kalau pipeline internal ML crash, kembalikan saja data mentahnya daripada error 500
        df_fallback = df.fillna(0)
        # Convert datetime kembali ke string agar aman di-JSON-kan
        df_fallback["timestamp"] = df_fallback["timestamp"].astype(str)
        return {
            "status": "fallback_raw",
            "info": f"Pipeline ML disederhanakan karena: {str(e)}",
            "data": df_fallback.to_dict(orient="records")
        }