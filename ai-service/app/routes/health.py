from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse, ModelStatusResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    return HealthResponse(
        model_loaded=request.app.state.models.loaded,
        device=request.app.state.models.device,
    )


@router.get("/model/status", response_model=ModelStatusResponse)
def model_status(request: Request) -> ModelStatusResponse:
    return request.app.state.models.status()
