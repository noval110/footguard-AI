"""Centralized environment configuration."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")

    app_host: str = "127.0.0.1"
    app_port: int = Field(default=8000, ge=1, le=65535)
    model_path: Path = Path("weights/best_model.pth")
    max_image_size_mb: int = Field(default=10, ge=1, le=100)
    allowed_image_types: str = "image/jpeg,image/png,image/webp"
    backend_origin: str = ""

    @property
    def allowed_mime_types(self) -> frozenset[str]:
        return frozenset(item.strip().lower() for item in self.allowed_image_types.split(",") if item.strip())

    @property
    def resolved_model_path(self) -> Path:
        return self.model_path if self.model_path.is_absolute() else PROJECT_ROOT / self.model_path

    @property
    def max_image_bytes(self) -> int:
        return self.max_image_size_mb * 1024 * 1024
