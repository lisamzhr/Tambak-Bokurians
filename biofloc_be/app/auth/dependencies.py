from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.security import decode_access_token
from app.database import users_col

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    username = decode_access_token(credentials.credentials)
    if not username:
        raise HTTPException(
            401, "Token tidak valid atau sudah expired", headers={"WWW-Authenticate": "Bearer"}
        )

    user = users_col.find_one({"username": username}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(401, "User tidak ditemukan")

    return user