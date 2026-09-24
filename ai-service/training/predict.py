from pathlib import Path

import cv2
import numpy as np
import segmentation_models_pytorch as smp
import torch
import albumentations as A
from albumentations.pytorch import ToTensorV2


BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "weights" / "best_model.pth"

IMAGE_PATH = (
    BASE_DIR
    / "temp-wound-dataset"
    / "data"
    / "Foot Ulcer Segmentation Challenge"
    / "validation"
    / "images"
    / "0001.png"
)

OUTPUT_PATH = BASE_DIR / "prediction_result.png"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

IMAGE_SIZE = 256


model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights=None,
    in_channels=3,
    classes=1,
)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=DEVICE
    )
)

model.to(DEVICE)
model.eval()


transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.Normalize(),
    ToTensorV2(),
])


image = cv2.imread(str(IMAGE_PATH))

if image is None:
    raise RuntimeError(
        f"Gambar tidak ditemukan: {IMAGE_PATH}"
    )

original = image.copy()

rgb = cv2.cvtColor(
    image,
    cv2.COLOR_BGR2RGB
)

transformed = transform(
    image=rgb
)

tensor = (
    transformed["image"]
    .unsqueeze(0)
    .to(DEVICE)
)


with torch.no_grad():

    prediction = model(tensor)

    prediction = torch.sigmoid(
        prediction
    )

    prediction = prediction[0][0]

    mask = (
        prediction.cpu().numpy() > 0.5
    ).astype(np.uint8)


mask = cv2.resize(
    mask,
    (
        original.shape[1],
        original.shape[0]
    )
)


overlay = original.copy()

overlay[mask == 1] = (
    0,
    0,
    255
)


result = cv2.addWeighted(
    original,
    0.7,
    overlay,
    0.3,
    0
)


cv2.imwrite(
    str(OUTPUT_PATH),
    result
)


print("Prediction selesai")
print(f"Input  : {IMAGE_PATH}")
print(f"Output : {OUTPUT_PATH}")
