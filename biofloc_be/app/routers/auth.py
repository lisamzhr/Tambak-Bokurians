from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import users_col
from app.schemas import UserRegister, UserLogin, Token
from app.auth.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(user: UserRegister):
    if users_col.find_one({"username": user.username}):
        raise HTTPException(400, "Username sudah dipakai")

    users_col.insert_one(
        {
            "username": user.username,
            "hashed_password": hash_password(user.password),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"message": "Registrasi berhasil, silakan login"}


@router.post("/login", response_model=Token)
def login(user: UserLogin):
    found = users_col.find_one({"username": user.username})
    if not found or not verify_password(user.password, found["hashed_password"]):
        raise HTTPException(401, "Username atau password salah")

    token = create_access_token(found["username"])
    return {"access_token": token, "token_type": "bearer"}