from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.schemas.analysis import ErrorResponse, FootSide, SegmentationResponse
from app.utils.image_validation import ImageValidationError


router = APIRouter()


@router.post(
    "/analyze",
    response_model=SegmentationResponse,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def analyze(
    request: Request,
    image: Annotated[UploadFile | None, File()] = None,
    file: Annotated[UploadFile | None, File()] = None,
    foot_side: Annotated[FootSide | None, Form()] = None,
) -> SegmentationResponse:
    settings = request.app.state.settings
    upload = image or file
    if upload is None:
        raise ImageValidationError("Image is required")
    if upload.content_type not in settings.allowed_mime_types:
        raise ImageValidationError("Unsupported image format", 415)
    data = await upload.read(settings.max_image_bytes + 1)
    if len(data) > settings.max_image_bytes:
        raise ImageValidationError("Image is too large", 413)
    prepared = request.app.state.images.prepare(data, upload.content_type)
    return request.app.state.inference.analyze(prepared)
