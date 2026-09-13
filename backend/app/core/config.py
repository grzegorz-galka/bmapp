"""Application configuration, read from the environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for the backend, overridable by BMAPP_-prefixed variables."""

    model_config = SettingsConfigDict(env_prefix="BMAPP_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://bmapp:bmapp@localhost:5432/bmapp"
    # Localhost only by default. Nothing here is authenticated, so binding to
    # 0.0.0.0 would expose board material to the network.
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    """Return the settings, read once per process."""
    return Settings()
