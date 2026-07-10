import json
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from cryptography.fernet import Fernet
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db

COOKIE_NAME = "access_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expiry_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _fernet() -> Fernet:
    key = get_settings().fernet_key
    if not key:
        raise RuntimeError("FERNET_KEY is not set")
    return Fernet(key.encode())


def encrypt_config(config: dict) -> str:
    return _fernet().encrypt(json.dumps(config).encode()).decode()


def decrypt_config(token: str) -> dict:
    return json.loads(_fernet().decrypt(token.encode()).decode())


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    from app.models import User

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )
    if not access_token:
        raise credentials_error
    settings = get_settings()
    try:
        payload = jwt.decode(access_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credentials_error
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise credentials_error
    return user
