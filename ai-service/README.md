# FootGuard AI service

This FastAPI service loads `weights/best_model.pth` once per server process and exposes image segmentation. It does not diagnose diabetes or calculate clinical risk. The current U-Net/ResNet34 checkpoint is experimental and has not been clinically validated.

## Run

From `C:\footguard\ai-service` with Python 3.11 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The checkpoint must exist at `weights/best_model.pth` before startup. The service selects CUDA when available and otherwise uses CPU. The image size is 256 × 256 and the segmentation threshold is 0.5. A missing or incompatible checkpoint prevents startup, so `/health` reports `model_loaded: true` only after the model has loaded successfully. This version uses fixed settings in `app/main.py`; `.env.example` is retained from the earlier scaffold but is not read by this entrypoint.

## Endpoints

- `GET /health` returns service status, model load status, and device.
- `POST /analyze` accepts a multipart `file` containing an image. It returns a JPEG overlay as a base64 data URL, whether any pixels crossed the threshold, percentage of image pixels selected, and the mean model probability for selected pixels.

The returned `confidence` is a model pixel probability summary, not a clinical risk score or calibrated certainty. The Go backend and frontend are not connected to this service yet.

## Test

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
