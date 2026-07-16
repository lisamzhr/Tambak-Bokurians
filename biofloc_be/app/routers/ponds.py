from fastapi import APIRouter, HTTPException, Depends
from app.database import ponds_col, profiles_col
from app.schemas import PondCreate
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/ponds", tags=["ponds"])


@router.post("")
def create_pond(pond: PondCreate, current_user: dict = Depends(get_current_user)):
    if not profiles_col.find_one({"profile_id": pond.profile_id}):
        raise HTTPException(
            400,
            f"profile_id '{pond.profile_id}' tidak dikenal. "
            "Jalankan seed_profiles.py dulu atau cek nama profil.",
        )
    if ponds_col.find_one({"pond_id": pond.pond_id}):
        raise HTTPException(400, f"pond_id '{pond.pond_id}' sudah terdaftar")

    doc = pond.model_dump()
    doc["owner_username"] = current_user["username"]
    ponds_col.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Kolam terdaftar", "pond": doc}


@router.get("")
def list_ponds(current_user: dict = Depends(get_current_user)):
    """Cuma nampilin kolam milik user yang lagi login."""
    return list(
        ponds_col.find({"owner_username": current_user["username"]}, {"_id": 0})
    )


@router.get("/{pond_id}")
def get_pond(pond_id: str, current_user: dict = Depends(get_current_user)):
    pond = ponds_col.find_one({"pond_id": pond_id}, {"_id": 0})
    if not pond:
        raise HTTPException(404, "Kolam tidak ditemukan")
    if pond["owner_username"] != current_user["username"]:
        raise HTTPException(403, "Kolam ini bukan milik kamu")
    return pond


def assert_owner(pond_id: str, username: str):
    """Helper dipakai router lain (manual.py, data.py) buat cek kepemilikan."""
    pond = ponds_col.find_one({"pond_id": pond_id})
    if not pond:
        raise HTTPException(404, f"Pond '{pond_id}' tidak ditemukan")
    if pond["owner_username"] != username:
        raise HTTPException(403, "Kolam ini bukan milik kamu")
    return pond