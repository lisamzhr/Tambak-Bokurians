from datetime import datetime, timezone
from app.database import readings_col, ponds_col
from app.config import settings

def push_reading(pond_id: str, payload: dict, source: str):
    """Memasukkan data sensor ke dalam bucket berbasis kapasitas (Maks 300 data)."""
    pond = ponds_col.find_one({"pond_id": pond_id})
    if not pond:
        raise ValueError(f"Pond '{pond_id}' belum terdaftar. Daftarkan dulu lewat POST /ponds")

    ts = payload.get("timestamp") or datetime.now(timezone.utc)
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))

    reading_doc = {"ts": ts, "source": source}
    for field in settings.allowed_fields:
        value = payload.get(field)
        if value is not None:
            reading_doc[field] = value

    readings_col.update_one(
        {
            "pond_id": pond_id, 
            "count": {"$lt": 300}
        },
        {
            "$push": {"readings": reading_doc},
            "$inc": {"count": 1},
            "$set": {"last_ts": ts},
            "$setOnInsert": {
                "profile_id": pond["profile_id"],
                "first_ts": ts,
            },
        },
        upsert=True,
    )
    return reading_doc


def get_readings(pond_id: str, date_from: str, date_to: str):
    """Mengambil data sensor ter-bucket tanpa kendala perbandingan datetime."""
    start_dt = datetime.strptime(f"{date_from} 00:00:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    end_dt = datetime.strptime(f"{date_to} 23:59:59", "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

    cursor = readings_col.find(
        {
            "pond_id": pond_id,
            "last_ts": {"$gte": start_dt},
            "first_ts": {"$lte": end_dt}
        },
        {"_id": 0, "readings": 1},
    ).sort("first_ts", 1)

    flat = []
    for bucket in cursor:
        for r in bucket.get("readings", []):
            r_ts = r["ts"]
            if isinstance(r_ts, str):
                r_ts = datetime.fromisoformat(r_ts.replace("Z", "+00:00"))
            
            # 🔥 FIX TYPEERROR: Paksa r_ts memiliki tzinfo UTC agar setara dengan start_dt & end_dt
            if r_ts.tzinfo is None:
                r_ts = r_ts.replace(tzinfo=timezone.utc)
            
            # Simpan kembali objek yang sudah aware ke dalam dict agar sorting di bawah tidak error
            r["ts"] = r_ts 

            if start_dt <= r_ts <= end_dt:
                flat.append(r)

    # Urutkan secara kronologis per detik
    flat.sort(key=lambda r: r["ts"])
    return flat