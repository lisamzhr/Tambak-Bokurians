from fastapi import APIRouter, Header, HTTPException
from app.schemas import ReadingIn
from app.services.bucket_service import push_reading
from app.config import settings

router = APIRouter(prefix="/sensor", tags=["sensor"])

@router.post("/data")
def receive_sensor_data(reading: ReadingIn, x_api_key: str = Header(...)):
    """Endpoint yang dipanggil device IoT tiap 15 menit.
    Device wajib ngirim header X-API-Key sebagai "password" biar gak sembarang post."""
    if x_api_key != settings.sensor_api_key:
        raise HTTPException(401, "API key device tidak valid/ditolak")

    try:
        doc = push_reading(reading.pond_id, reading.model_dump(), source="sensor")
    except ValueError as e:
        raise HTTPException(404, str(e))

    return {"message": "Data sensor diterima & tersimpan", "reading": doc}