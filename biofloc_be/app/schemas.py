from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PondCreate(BaseModel):
    pond_id: str
    profile_id: str  # "tilapia_freshwater" atau "vannamei_marine"
    name: Optional[str] = None
    volume_liters: float


class ReadingIn(BaseModel):
    """Body yang dikirim sensor ATAU form manual. Semua parameter optional
    karena tiap profil (nila vs vaname) punya parameter yang beda-beda."""
    pond_id: str
    timestamp: Optional[datetime] = None  # kalau kosong, dipakai waktu server
    ammonia_mg_l: Optional[float] = None
    nitrite_mg_l: Optional[float] = None
    nitrate_mg_l: Optional[float] = None
    do_mg_l: Optional[float] = None
    ph: Optional[float] = None
    temperature_c: Optional[float] = None
    alkalinity_mg_l: Optional[float] = None
    TSS_mg_l: Optional[float] = None


class ReadingOut(ReadingIn):
    source: str  # "sensor" | "manual"