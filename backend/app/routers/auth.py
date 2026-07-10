from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    COOKIE_NAME,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expiry_minutes * 60,
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=body.email.lower(), hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _set_auth_cookie(response, create_access_token(user.id))
    return user


@router.post("/login", response_model=UserOut)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _set_auth_cookie(response, create_access_token(user.id))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
