from functools import lru_cache
from typing import Annotated

from pydantic import AliasChoices, BeforeValidator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(v: str | list[str]) -> list[str]:
    if isinstance(v, str):
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    return v


class Settings(BaseSettings):
    app_name: str = "TaskPilot API"
    app_env: str = "development"
    debug: bool = False
    cors_origins: Annotated[list[str], BeforeValidator(parse_cors_origins)] = [
        "http://localhost:3000"
    ]

    # Supabase credentials (reads from .env or frontend/.env.local)
    supabase_url: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    )
    supabase_service_role_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"),
    )

    # Slack credentials
    slack_bot_token: str = Field(
        default="",
        validation_alias=AliasChoices("SLACK_BOT_TOKEN", "SLACK_TOKEN"),
    )
    slack_signing_secret: str = Field(
        default="",
        validation_alias=AliasChoices("SLACK_SIGNING_SECRET"),
    )
    slack_app_token: str = Field(
        default="",
        validation_alias=AliasChoices("SLACK_APP_TOKEN"),
    )

    # GitHub credentials
    github_token: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_TOKEN", "GITHUB_PERSONAL_ACCESS_TOKEN"),
    )
    github_app_id: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_APP_ID"),
    )
    github_app_private_key: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_APP_PRIVATE_KEY"),
    )

    model_config = SettingsConfigDict(
        env_file=(".env", "../frontend/.env.local", "../frontend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
