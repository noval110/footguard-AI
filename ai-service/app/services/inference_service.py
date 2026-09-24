"""Run U-Net segmentation and package visual outputs."""

import base64
import logging

import cv2
import numpy as np

from app.schemas.analysis import SegmentationResponse, SegmentationResult
from app.services.image_service import PreparedImage
from app.services.model_service import InferenceFailure, ModelService, ModelUnavailable


logger = logging.getLogger(__name__)
THRESHOLD = 0.5


class InferenceService:
    def __init__(self, models: ModelService) -> None:
        self.models = models

    def analyze(self, image: PreparedImage) -> SegmentationResponse:
        model = self.models.model
        if model is None:
            raise ModelUnavailable("AI model is not available yet")
        try:
            probability = model.probability_map(image.rgb)
            if probability.shape != (256, 256) or not np.isfinite(probability).all():
                raise ValueError("Model returned an invalid probability map")

            mask = (probability > THRESHOLD).astype(np.uint8)
            mask = cv2.resize(mask, (image.width, image.height), interpolation=cv2.INTER_NEAREST)
            probability_resized = cv2.resize(
                probability, (image.width, image.height), interpolation=cv2.INTER_LINEAR
            )
            ulcer_pixels = int(np.count_nonzero(mask))
            total_pixels = image.width * image.height
            detected_probs = probability_resized[mask == 1]
            confidence = float(detected_probs.mean()) if detected_probs.size else 0.0

            original = cv2.cvtColor(image.rgb, cv2.COLOR_RGB2BGR)
            overlay = original.copy()
            overlay[mask == 1] = (0, 0, 255)
            result = cv2.addWeighted(original, 0.7, overlay, 0.3, 0)
            encoded_ok, encoded = cv2.imencode(".jpg", result)
            if not encoded_ok:
                raise ValueError("Could not encode segmentation overlay")

            return SegmentationResponse(result=SegmentationResult(
                ulcer_detected=ulcer_pixels > 0,
                ulcer_area_percent=round(ulcer_pixels / total_pixels * 100, 2),
                confidence=round(confidence, 4),
                threshold=THRESHOLD,
                overlay_image="data:image/jpeg;base64," + base64.b64encode(encoded).decode("utf-8"),
            ))
        except Exception as exc:
            logger.exception("AI inference failed")
            raise InferenceFailure("AI inference failed") from exc
