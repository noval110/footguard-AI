import base64
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image
import torch

from app.main import app


client = TestClient(app)


def test_health_reports_loaded_model_and_device():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "footguard-ai",
        "model_loaded": True,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }


def test_analyze_requires_file():
    assert client.post("/analyze").status_code == 422


def test_analyze_rejects_non_image_and_corrupt_image():
    text = client.post("/analyze", files={"file": ("note.txt", b"hello", "text/plain")})
    assert text.status_code == 400
    assert text.json()["detail"] == "File harus berupa gambar"

    corrupt = client.post("/analyze", files={"file": ("bad.png", b"not a picture", "image/png")})
    assert corrupt.status_code == 400
    assert corrupt.json()["detail"] == "Gambar tidak dapat dibaca"


def test_analyze_uses_loaded_model_and_returns_jpeg_overlay():
    image = BytesIO()
    Image.new("RGB", (80, 96), (120, 85, 65)).save(image, format="PNG")
    response = client.post("/analyze", files={"file": ("foot.png", image.getvalue(), "image/png")})
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "success"
    result = payload["result"]
    assert isinstance(result["ulcer_detected"], bool)
    assert 0 <= result["ulcer_area_percent"] <= 100
    assert 0 <= result["confidence"] <= 1
    assert result["threshold"] == 0.5
    prefix = "data:image/jpeg;base64,"
    assert result["overlay_image"].startswith(prefix)
    overlay = Image.open(BytesIO(base64.b64decode(result["overlay_image"][len(prefix):])))
    assert overlay.size == (80, 96)
