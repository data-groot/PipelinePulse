from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pipelinepulse"
    jwt_secret: str = "dev-secret-do-not-use-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24
    fernet_key: str = ""
    scheduler_secret: str = "dev-scheduler-secret"
    cookie_secure: bool = False

    # Safety caps on extraction, matching v1 behavior
    max_extract_rows: int = 1000
    max_extract_pages: int = 5
    max_csv_bytes: int = 10 * 1024 * 1024

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
