from typing import Literal

from pydantic import BaseModel, Field


FootSide = Literal["left", "right"]


class ModelMetadata(BaseModel):
    name: str
    version: str


class ImageMetadata(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    foot_side: FootSide | None = None


class BoundingBox(BaseModel):
    x1: int = Field(ge=0)
    y1: int = Field(ge=0)
    x2: int = Field(ge=0)
    y2: int = Field(ge=0)


class Finding(BaseModel):
    finding_type: str
    confidence: float = Field(ge=0, le=1)
    bbox: BoundingBox | None = None
    mask: str | None = None


class AnalysisResponse(BaseModel):
    success: Literal[True] = True
    model: ModelMetadata
    image: ImageMetadata
    findings: list[Finding]


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    message: str


class SegmentationResult(BaseModel):
    ulcer_detected: bool
    ulcer_area_percent: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    threshold: float = Field(ge=0, le=1)
    overlay_image: str


class SegmentationResponse(BaseModel):
    status: Literal["success"] = "success"
    result: SegmentationResult
