"""Medical image upload checks, before inference is attempted."""

from io import BytesIO

from PIL import Image, UnidentifiedImageError


SUPPORTED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MIN_DIMENSION = 64
MAX_DIMENSION = 8192
MAX_PIXELS = 25_000_000


class ImageValidationError(Exception):
    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


def decode_and_validate(data: bytes, declared_type: str | None, allowed_types: frozenset[str]) -> Image.Image:
    if not data:
        raise ImageValidationError("Image is empty")
    if declared_type not in allowed_types:
        raise ImageValidationError("Unsupported image format", 415)
    try:
        with Image.open(BytesIO(data)) as source:
            actual_type = SUPPORTED_FORMATS.get(source.format or "")
            if actual_type not in allowed_types or actual_type != declared_type:
                raise ImageValidationError("Unsupported image format", 415)
            width, height = source.size
            if (
                width < MIN_DIMENSION
                or height < MIN_DIMENSION
                or width > MAX_DIMENSION
                or height > MAX_DIMENSION
                or width * height > MAX_PIXELS
            ):
                raise ImageValidationError("Image dimensions are outside the supported range")
            source.load()
            return source.copy()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageValidationError("Image could not be decoded") from exc
