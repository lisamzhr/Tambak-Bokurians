from fastapi import APIRouter, Depends
from app.schemas import ReadingIn
from app.services.bucket_service import push_reading
from app.auth.dependencies import get_current_user
from app.routers.ponds import assert_owner

router = APIRouter(prefix="/manual", tags=["manual"])


@router.post("/data")
def receive_manual_data(reading: ReadingIn, current_user: dict = Depends(get_current_user)):
    """Endpoint buat user input manual (misal 2-3x sehari lewat app/web).
    Butuh login -- kolam yang diisi harus milik user yang bersangkutan."""
    assert_owner(reading.pond_id, current_user["username"])
    doc = push_reading(reading.pond_id, reading.model_dump(), source="manual")
    return {"message": "Data manual tersimpan", "reading": doc}