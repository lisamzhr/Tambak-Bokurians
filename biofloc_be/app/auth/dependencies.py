from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.security import decode_access_token
from app.database import users_col, token_blacklist_col

bearer_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials

    if token_blacklist_col.find_one({"token": token}):
        raise HTTPException(401, "Token sudah logout, silakan login ulang", headers={"WWW-Authenticate": "Bearer"})

    username = decode_access_token(token)
    if not username:
        raise HTTPException(
            401, "Token tidak valid atau sudah expired", headers={"WWW-Authenticate": "Bearer"}
        )

    user = users_col.find_one({"username": username}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(401, "User tidak ditemukan")

    return user