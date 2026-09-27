"""FootGuard AI service: Normal/Wound classification + wound segmentation."""

import base64
import os
from pathlib import Path

os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")

import albumentations as A
import cv2
import numpy as np
import segmentation_models_pytorch as smp
import torch
import torch.nn as nn
from albumentations.pytorch import ToTensorV2
from fastapi import FastAPI, File, HTTPException, UploadFile
from torchvision.models import efficientnet_b0


app = FastAPI(
    title="FootGuard AI Service",
    version="2.0.0",
)


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / "weights"

SEGMENTATION_MODEL_PATH = (
    WEIGHTS_DIR / "best_model.pth"
)

CLASSIFIER_MODEL_PATH = (
    WEIGHTS_DIR / "normal_wound_classifier.pth"
)

DEVICE = (
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)

SEGMENTATION_IMAGE_SIZE = 256
CLASSIFIER_IMAGE_SIZE = 224

SEGMENTATION_THRESHOLD = 0.5

CLASS_NAMES = [
    "Normal",
    "Wound",
]


# ============================================================
# LOAD NORMAL / WOUND CLASSIFIER
# ============================================================

classifier = efficientnet_b0(
    weights=None
)

in_features = (
    classifier.classifier[1].in_features
)

classifier.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(in_features, 2),
)

classifier_checkpoint = torch.load(
    CLASSIFIER_MODEL_PATH,
    map_location=DEVICE,
    weights_only=True,
)

classifier.load_state_dict(
    classifier_checkpoint["model_state_dict"]
)

classifier = classifier.to(DEVICE)
classifier.eval()


classifier_transform = A.Compose([
    A.Resize(
        CLASSIFIER_IMAGE_SIZE,
        CLASSIFIER_IMAGE_SIZE,
    ),
    A.Normalize(
        mean=(0.485, 0.456, 0.406),
        std=(0.229, 0.224, 0.225),
        max_pixel_value=255.0,
    ),
    ToTensorV2(),
])


# ============================================================
# LOAD WOUND SEGMENTATION MODEL
# ============================================================

segmentation_model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights=None,
    in_channels=3,
    classes=1,
)

segmentation_model.load_state_dict(
    torch.load(
        SEGMENTATION_MODEL_PATH,
        map_location=DEVICE,
        weights_only=True,
    )
)

segmentation_model = (
    segmentation_model.to(DEVICE)
)

segmentation_model.eval()


segmentation_transform = A.Compose([
    A.Resize(
        SEGMENTATION_IMAGE_SIZE,
        SEGMENTATION_IMAGE_SIZE,
    ),
    A.Normalize(),
    ToTensorV2(),
])


# ============================================================
# HELPERS
# ============================================================

def image_to_base64(image):
    success, buffer = cv2.imencode(
        ".jpg",
        image,
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Gagal membuat hasil visual",
        )

    return base64.b64encode(
        buffer
    ).decode("utf-8")


def classify_image(rgb_image):
    transformed = classifier_transform(
        image=rgb_image
    )

    tensor = (
        transformed["image"]
        .unsqueeze(0)
        .to(DEVICE)
    )

    with torch.no_grad():
        logits = classifier(tensor)

        probabilities = torch.softmax(
            logits,
            dim=1,
        )[0]

    predicted_index = int(
        torch.argmax(probabilities).item()
    )

    predicted_class = CLASS_NAMES[
        predicted_index
    ]

    confidence = float(
        probabilities[
            predicted_index
        ].item()
    )

    return (
        predicted_class,
        confidence,
    )


def segment_wound(original):
    # ========================================================
    # PREPROCESS IMAGE
    # ========================================================

    rgb = cv2.cvtColor(
        original,
        cv2.COLOR_BGR2RGB,
    )

    transformed = segmentation_transform(
        image=rgb
    )

    tensor = (
        transformed["image"]
        .unsqueeze(0)
        .to(DEVICE)
    )

    # ========================================================
    # SEGMENTATION INFERENCE
    # ========================================================

    with torch.no_grad():
        logits = segmentation_model(
            tensor
        )

        probability = (
            torch.sigmoid(logits)[0][0]
            .cpu()
            .numpy()
        )

    # ========================================================
    # CREATE MASK
    # ========================================================

    predicted_mask = (
        probability >= SEGMENTATION_THRESHOLD
    ).astype(np.uint8)

    predicted_mask = cv2.resize(
        predicted_mask,
        (
            original.shape[1],
            original.shape[0],
        ),
        interpolation=cv2.INTER_NEAREST,
    )

    probability_map = cv2.resize(
        probability,
        (
            original.shape[1],
            original.shape[0],
        ),
    )

    # ========================================================
    # AREA CALCULATION
    # ========================================================

    ulcer_pixels = int(
        predicted_mask.sum()
    )

    total_pixels = int(
        predicted_mask.size
    )

    ulcer_area_percent = (
        ulcer_pixels /
        total_pixels *
        100
    )

    if ulcer_pixels > 0:
        segmentation_confidence = float(
            probability_map[
                predicted_mask == 1
            ].mean()
        )
    else:
        segmentation_confidence = 0.0

    # ========================================================
    # VISUALIZATION
    # ========================================================

    mask_bool = (
        predicted_mask.astype(bool)
    )

    # ------------------------------------
    # Strong red overlay
    # ------------------------------------

    red_overlay = original.copy()

    red_overlay[
        mask_bool
    ] = (0, 0, 255)

    result_image = cv2.addWeighted(
        original,
        0.55,
        red_overlay,
        0.45,
        0,
    )

    # ------------------------------------
    # Yellow contour / boundary
    # ------------------------------------

    contours, _ = cv2.findContours(
        predicted_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if contours:
        cv2.drawContours(
            result_image,
            contours,
            -1,
            (0, 255, 255),
            2,
        )

    # ========================================================
    # RETURN RESULT
    # ========================================================

    return {
        "ulcer_detected": (
            ulcer_pixels > 0
        ),
        "ulcer_area_percent": round(
            ulcer_area_percent,
            2,
        ),
        "segmentation_confidence": round(
            segmentation_confidence,
            4,
        ),
        "overlay_image": (
            "data:image/jpeg;base64,"
            + image_to_base64(
                result_image
            )
        ),
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "footguard-ai",
        "device": DEVICE,
        "classifier_loaded": True,
        "segmentation_model_loaded": True,
        "classifier_classes": CLASS_NAMES,
    }


# ============================================================
# ANALYZE
# ============================================================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...)
):
    # ========================================================
    # VALIDATE FILE TYPE
    # ========================================================

    if (
        file.content_type is None
        or not file.content_type.startswith(
            "image/"
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="File harus berupa gambar",
        )

    contents = await file.read()

    image_array = np.frombuffer(
        contents,
        dtype=np.uint8,
    )

    try:
        original = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR,
        )
    except cv2.error:
        original = None

    if original is None:
        raise HTTPException(
            status_code=400,
            detail="Gambar tidak dapat dibaca",
        )

    # ========================================================
    # STEP 1: NORMAL / WOUND CLASSIFICATION
    # ========================================================

    rgb = cv2.cvtColor(
        original,
        cv2.COLOR_BGR2RGB,
    )

    (
        predicted_class,
        classifier_confidence,
    ) = classify_image(rgb)

    # ========================================================
    # STEP 2: NORMAL
    # ========================================================

    if predicted_class == "Normal":
        return {
            "status": "success",
            "result": {
                "classification": "Normal",
                "classification_confidence": round(
                    classifier_confidence,
                    4,
                ),
                "ulcer_detected": False,
                "ulcer_area_percent": 0.0,
                "confidence": 0.0,
                "segmentation_confidence": 0.0,
                "threshold": (
                    SEGMENTATION_THRESHOLD
                ),
                "overlay_image": (
                    "data:image/jpeg;base64,"
                    + image_to_base64(
                        original
                    )
                ),
                "segmentation_applied": False,
            },
        }

    # ========================================================
    # STEP 3: WOUND → SEGMENTATION
    # ========================================================

    segmentation_result = (
        segment_wound(original)
    )

    return {
        "status": "success",
        "result": {
            "classification": "Wound",
            "classification_confidence": round(
                classifier_confidence,
                4,
            ),

            **segmentation_result,

            # Compatibility dengan backend lama
            "confidence": (
                segmentation_result[
                    "segmentation_confidence"
                ]
            ),

            "threshold": (
                SEGMENTATION_THRESHOLD
            ),

            "segmentation_applied": True,
        },
    }