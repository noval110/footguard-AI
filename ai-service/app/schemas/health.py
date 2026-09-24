from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "footguard-ai"
    model_loaded: bool
    device: str


class ModelStatusResponse(BaseModel):
    loaded: bool
    model_name: str | None
    model_version: str | None
    model_path: str
