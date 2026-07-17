from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import users_col, token_blacklist_col
from app.schemas import UserRegister, UserLogin, Token
from app.auth.security import hash_password, verify_password, create_access_token, get_token_expiry
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()   # <- ini yang ilang


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


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: dict = Depends(get_current_user),
):
    token = credentials.credentials
    expiry = get_token_expiry(token)
    token_blacklist_col.insert_one(
        {
            "token": token,
            "username": current_user["username"],
            "logged_out_at": datetime.now(timezone.utc),
            "expires_at": expiry,
        }
    )
    return {"message": f"Logout berhasil, sampai jumpa {current_user['username']}"}