"""Load the trained U-Net checkpoint and expose an inference adapter."""

import logging
import os
from pathlib import Path
from typing import Callable, Protocol

import numpy as np

from app.schemas.health import ModelStatusResponse


logger = logging.getLogger(__name__)


class SegmentationModel(Protocol):
    name: str
    version: str

    def probability_map(self, image_rgb: np.ndarray) -> np.ndarray: ...


class ModelUnavailable(Exception):
    pass


class InferenceFailure(Exception):
    pass


class UnetResNet34Adapter:
    name = "Unet-ResNet34"

    def __init__(self, checkpoint_path: Path) -> None:
        os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")
        import albumentations as A
        import segmentation_models_pytorch as smp
        import torch
        from albumentations.pytorch import ToTensorV2

        self.version = checkpoint_path.name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.torch = torch
        self.transform = A.Compose([
            A.Resize(256, 256),
            A.Normalize(),
            ToTensorV2(),
        ])
        model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,
            in_channels=3,
            classes=1,
        )
        state = torch.load(checkpoint_path, map_location=self.device, weights_only=True)
        model.load_state_dict(state)
        self.model = model.to(self.device).eval()

    def probability_map(self, image_rgb: np.ndarray) -> np.ndarray:
        tensor = self.transform(image=image_rgb)["image"].unsqueeze(0).to(self.device)
        with self.torch.inference_mode():
            logits = self.model(tensor)
            probabilities = self.torch.sigmoid(logits)[0, 0]
        return probabilities.cpu().numpy()


class ModelService:
    def __init__(
        self,
        configured_path: Path,
        resolved_path: Path,
        loader: Callable[[Path], SegmentationModel] | None = None,
    ) -> None:
        self.configured_path = configured_path
        self.resolved_path = resolved_path
        self.loader = loader or UnetResNet34Adapter
        self.model: SegmentationModel | None = None

    def load(self) -> None:
        self.model = None
        if not self.resolved_path.is_file():
            logger.info("AI model unavailable: no weight file at %s", self.resolved_path)
            return
        try:
            model = self.loader(self.resolved_path)
            if not model.name or not model.version or not callable(model.probability_map):
                raise ValueError("Model adapter has incomplete metadata or inference method")
            self.model = model
            logger.info("AI model loaded: %s (%s) on %s", model.name, model.version, self.device)
        except Exception:
            logger.exception("AI model load failed")

    @property
    def loaded(self) -> bool:
        return self.model is not None

    @property
    def device(self) -> str:
        return getattr(self.model, "device", "cpu")

    def status(self) -> ModelStatusResponse:
        return ModelStatusResponse(
            loaded=self.loaded,
            model_name=self.model.name if self.model else None,
            model_version=self.model.version if self.model else None,
            model_path=self.configured_path.as_posix(),
        )
