"""Explicit, conservative image preprocessing for a future segmentation model."""

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.utils.image_validation import decode_and_validate


@dataclass(frozen=True)
class PreparedImage:
    rgb: np.ndarray
    width: int
    height: int


class ImageService:
    def __init__(self, allowed_types: frozenset[str]) -> None:
        self.allowed_types = allowed_types

    def prepare(self, data: bytes, content_type: str | None) -> PreparedImage:
        image = decode_and_validate(data, content_type, self.allowed_types)
        image = ImageOps.exif_transpose(image).convert("RGB")
        rgb = np.ascontiguousarray(np.asarray(image, dtype=np.uint8))
        return PreparedImage(rgb=rgb, width=image.width, height=image.height)

    @staticmethod
    def to_bgr(prepared: PreparedImage) -> np.ndarray:
        return cv2.cvtColor(prepared.rgb, cv2.COLOR_RGB2BGR)

    @staticmethod
    def from_bgr(bgr: np.ndarray) -> Image.Image:
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
