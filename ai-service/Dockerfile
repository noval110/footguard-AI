FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir timm

COPY app ./app

RUN mkdir -p weights && \
    curl -fL "https://raw.githubusercontent.com/noval110/footguard-AI/main/ai-service/weights/best_model.pth" \
      -o weights/best_model.pth && \
    curl -fL "https://raw.githubusercontent.com/noval110/footguard-AI/main/ai-service/weights/normal_wound_classifier.pth" \
      -o weights/normal_wound_classifier.pth

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]