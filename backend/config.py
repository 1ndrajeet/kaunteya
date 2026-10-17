from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(v: str | list[str]) -> list[str]:
    if isinstance(v, str):
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    return v


class Settings(BaseSettings):
    app_name: str = "Hackathon API"
    app_env: str = "development"
    debug: bool = False
    cors_origins: Annotated[list[str], BeforeValidator(parse_cors_origins)] = [
        "http://localhost:3000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
