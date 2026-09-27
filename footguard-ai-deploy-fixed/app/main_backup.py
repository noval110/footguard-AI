"""FootGuard image segmentation API."""

import base64
import os
from pathlib import Path

os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")

import albumentations as A
import cv2
import numpy as np
import segmentation_models_pytorch as smp
import torch
from albumentations.pytorch import ToTensorV2
from fastapi import FastAPI, File, HTTPException, UploadFile


app = FastAPI(title="FootGuard AI Service", version="1.0.0")


# Configuration
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "weights" / "best_model.pth"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
IMAGE_SIZE = 256
THRESHOLD = 0.5


# Load the trained model once for this service process.
model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights=None,
    in_channels=3,
    classes=1,
)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True))
model = model.to(DEVICE)
model.eval()

transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.Normalize(),
    ToTensorV2(),
])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "footguard-ai",
        "model_loaded": True,
        "device": DEVICE,
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")

    contents = await file.read()
    image_array = np.frombuffer(contents, dtype=np.uint8)
    try:
        original = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    except cv2.error:
        original = None
    if original is None:
        raise HTTPException(status_code=400, detail="Gambar tidak dapat dibaca")

    rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
    transformed = transform(image=rgb)
    tensor = transformed["image"].unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)
        probability = torch.sigmoid(logits)[0][0].cpu().numpy()

    predicted_mask = (probability >= THRESHOLD).astype(np.uint8)
    predicted_mask = cv2.resize(
        predicted_mask,
        (original.shape[1], original.shape[0]),
        interpolation=cv2.INTER_NEAREST,
    )
    probability_map = cv2.resize(
        probability,
        (original.shape[1], original.shape[0]),
    )

    ulcer_pixels = int(predicted_mask.sum())
    total_pixels = int(predicted_mask.size)
    ulcer_area_percent = ulcer_pixels / total_pixels * 100
    confidence = (
        float(probability_map[predicted_mask == 1].mean())
        if ulcer_pixels > 0
        else 0.0
    )

    overlay = original.copy()
    overlay[predicted_mask == 1] = (0, 0, 255)
    result_image = cv2.addWeighted(original, 0.7, overlay, 0.3, 0)
    success, buffer = cv2.imencode(".jpg", result_image)
    if not success:
        raise HTTPException(status_code=500, detail="Gagal membuat hasil visual")
    overlay_base64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "status": "success",
        "result": {
            "ulcer_detected": ulcer_pixels > 0,
            "ulcer_area_percent": round(ulcer_area_percent, 2),
            "confidence": round(confidence, 4),
            "threshold": THRESHOLD,
            "overlay_image": "data:image/jpeg;base64," + overlay_base64,
        },
    }
