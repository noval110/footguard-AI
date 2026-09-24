from pathlib import Path

import albumentations as A
import cv2
import numpy as np
import segmentation_models_pytorch as smp
import torch
from albumentations.pytorch import ToTensorV2
from torch.utils.data import DataLoader, Dataset, Subset


# =========================
# CONFIG
# =========================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = (
    BASE_DIR
    / "temp-wound-dataset"
    / "data"
    / "Foot Ulcer Segmentation Challenge"
)

TRAIN_IMAGES = DATA_DIR / "train" / "images"
TRAIN_LABELS = DATA_DIR / "train" / "labels"

VAL_IMAGES = DATA_DIR / "validation" / "images"
VAL_LABELS = DATA_DIR / "validation" / "labels"

WEIGHTS_DIR = BASE_DIR / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BATCH_SIZE = 4
EPOCHS = 1
LEARNING_RATE = 1e-4
IMAGE_SIZE = 256


# =========================
# DATASET
# =========================

class FootUlcerDataset(Dataset):
    def __init__(self, image_dir, mask_dir, transform=None):
        self.image_dir = Path(image_dir)
        self.mask_dir = Path(mask_dir)
        self.transform = transform

        self.images = sorted(
            [
                p for p in self.image_dir.iterdir()
                if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
            ]
        )

    def __len__(self):
        return len(self.images)

    def __getitem__(self, index):
        image_path = self.images[index]
        mask_path = self.mask_dir / image_path.name

        image = cv2.imread(str(image_path))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        if image is None:
            raise RuntimeError(f"Gagal membaca image: {image_path}")

        if mask is None:
            raise RuntimeError(f"Gagal membaca mask: {mask_path}")

        # Binary mask: background = 0, ulcer = 1
        mask = (mask > 127).astype(np.float32)

        if self.transform:
            transformed = self.transform(
                image=image,
                mask=mask
            )

            image = transformed["image"]
            mask = transformed["mask"]

        mask = mask.unsqueeze(0).float()

        return image, mask


# =========================
# AUGMENTATION
# =========================

train_transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),

    A.HorizontalFlip(p=0.5),

    A.RandomBrightnessContrast(p=0.3),

    A.Normalize(),

    ToTensorV2(),
])

val_transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),

    A.Normalize(),

    ToTensorV2(),
])


# =========================
# DATA LOADERS
# =========================

train_dataset = FootUlcerDataset(
    TRAIN_IMAGES,
    TRAIN_LABELS,
    train_transform
)

val_dataset = FootUlcerDataset(
    VAL_IMAGES,
    VAL_LABELS,
    val_transform
)

train_dataset = Subset(train_dataset, range(50))
val_dataset = Subset(val_dataset, range(20))

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False
)


# =========================
# MODEL
# =========================

model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights="imagenet",
    in_channels=3,
    classes=1,
)

model = model.to(DEVICE)


# =========================
# LOSS & OPTIMIZER
# =========================

dice_loss = smp.losses.DiceLoss(
    mode="binary",
    from_logits=True
)

bce_loss = torch.nn.BCEWithLogitsLoss()


def loss_function(prediction, target):
    return dice_loss(prediction, target) + bce_loss(
        prediction,
        target
    )


optimizer = torch.optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE
)


# =========================
# METRIC
# =========================

def calculate_dice(prediction, target):
    prediction = torch.sigmoid(prediction)
    prediction = (prediction > 0.5).float()

    intersection = (prediction * target).sum()

    dice = (
        2.0 * intersection + 1e-7
    ) / (
        prediction.sum()
        + target.sum()
        + 1e-7
    )

    return dice.item()


# =========================
# TRAINING
# =========================

print("=" * 50)
print("FootGuard AI Training")
print("=" * 50)

print(f"Device       : {DEVICE}")
print(f"Train images : {len(train_dataset)}")
print(f"Val images   : {len(val_dataset)}")
print(f"Epochs       : {EPOCHS}")
print(f"Batch size   : {BATCH_SIZE}")

best_dice = 0.0

for epoch in range(EPOCHS):

    # -------- TRAIN --------

    model.train()

    train_loss = 0.0

    for images, masks in train_loader:

        images = images.to(DEVICE)
        masks = masks.to(DEVICE)

        optimizer.zero_grad()

        predictions = model(images)

        loss = loss_function(
            predictions,
            masks
        )

        loss.backward()

        optimizer.step()

        train_loss += loss.item()

    train_loss /= len(train_loader)

    # -------- VALIDATION --------

    model.eval()

    val_loss = 0.0
    val_dice = 0.0

    with torch.no_grad():

        for images, masks in val_loader:

            images = images.to(DEVICE)
            masks = masks.to(DEVICE)

            predictions = model(images)

            loss = loss_function(
                predictions,
                masks
            )

            val_loss += loss.item()

            val_dice += calculate_dice(
                predictions,
                masks
            )

    val_loss /= len(val_loader)
    val_dice /= len(val_loader)

    print(
        f"Epoch [{epoch + 1}/{EPOCHS}] "
        f"Train Loss: {train_loss:.4f} | "
        f"Val Loss: {val_loss:.4f} | "
        f"Dice: {val_dice:.4f}"
    )

    # -------- SAVE BEST MODEL --------

    if val_dice > best_dice:

        best_dice = val_dice

        model_path = (
            WEIGHTS_DIR
            / "best_model.pth"
        )

        torch.save(
            model.state_dict(),
            model_path
        )

        print(
            f"✓ Best model saved "
            f"(Dice: {best_dice:.4f})"
        )


print("=" * 50)
print("Training selesai!")
print(f"Best Dice : {best_dice:.4f}")
print(
    f"Model     : "
    f"{WEIGHTS_DIR / 'best_model.pth'}"
)
