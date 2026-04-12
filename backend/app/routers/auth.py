"""Auth router — /auth/signup, /auth/login, /auth/me, /auth/logout, /auth/register"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    TokenOut,
    UserCreate,
    UserOut,
    SignupRequest,
    EmailLoginRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "access_token"
_COOKIE_OPTS = dict(httponly=True, samesite="lax", secure=False)


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(key=_COOKIE_NAME, value=token, **_COOKIE_OPTS)


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=_COOKIE_NAME, httponly=True, samesite="lax")


async def create_user_schemas(user_id: int, db: AsyncSession) -> None:
    """Create bronze/silver/gold schemas for a new user."""
    for layer in ("bronze", "silver", "gold"):
        schema_name = f"user_{user_id}_{layer}"
        await db.execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        )


# ---------------------------------------------------------------------------
# POST /auth/signup
# Accepts: {email, password}
# Returns: UserOut JSON + sets httpOnly access_token cookie
# ---------------------------------------------------------------------------
@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Derive a username from the email local-part; ensure uniqueness
    base_username = payload.email.split("@")[0][:60]
    username = base_username
    suffix = 1
    while True:
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none() is None:
            break
        username = f"{base_username}{suffix}"
        suffix += 1

    user = User(
        username=username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()  # obtain user.id before creating schemas

    await create_user_schemas(user.id, db)

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return user


# ---------------------------------------------------------------------------
# POST /auth/login
# Accepts: {email, password} JSON
# Returns: {access_token, token_type} JSON + sets httpOnly access_token cookie
# The JSON body is kept so the existing frontend (which reads data.access_token
# from localStorage) continues to work without change.
# ---------------------------------------------------------------------------
@router.post("/login", response_model=TokenOut)
async def login(
    payload: EmailLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# GET /auth/me
# Returns: {id, username, email, is_active, is_admin, created_at}
# Already correct — kept as-is.
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


# ---------------------------------------------------------------------------
# POST /auth/logout
# Clears the httpOnly cookie.
# ---------------------------------------------------------------------------
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    _clear_auth_cookie(response)


# ---------------------------------------------------------------------------
# POST /auth/register  (legacy — username+email+password; kept for compat)
# Accepts: {username, email, password}
# Returns: UserOut JSON + sets httpOnly access_token cookie
# ---------------------------------------------------------------------------
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    email_check = await db.execute(select(User).where(User.email == payload.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    await create_user_schemas(user.id, db)

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return user


# ---------------------------------------------------------------------------
# POST /auth/login/username  (legacy — username+password; kept for compat)
# Accepts: {username, password} JSON
# Returns: {access_token, token_type} JSON + sets httpOnly cookie
# ---------------------------------------------------------------------------
@router.post("/login/username", response_model=TokenOut)
async def login_username(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(User).where(User.username == payload.username))
    user: User | None = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return {"access_token": token, "token_type": "bearer"}
