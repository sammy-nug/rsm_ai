from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import TypedDict

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


CLASS_NAMES = ("cat", "dog", "neither")
IMAGE_SIZE = (224, 224)
SUPPORTED_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


class PredictionResult(TypedDict):
    prediction: str
    scores: dict[str, float]


class InvalidImageError(ValueError):
    """Raised when an uploaded file is not a supported, valid image."""


class ModelService:
    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self.model: tf.keras.Model | None = None
        self._prediction_lock = Lock()

    def load(self) -> None:
        if not self.model_path.is_file():
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        self.model = tf.keras.models.load_model(self.model_path)

    def predict(self, image_bytes: bytes) -> PredictionResult:
        if self.model is None:
            raise RuntimeError("The trained model has not been loaded.")

        image_array = self._prepare_image(image_bytes)
        try:
            with self._prediction_lock:
                probabilities = self.model.predict(
                    np.expand_dims(image_array, axis=0),
                    verbose=0,
                )[0]
        except (OSError, RuntimeError, ValueError, tf.errors.InvalidArgumentError) as exc:
            raise RuntimeError("The model could not analyze this image.") from exc

        if len(probabilities) != len(CLASS_NAMES):
            raise RuntimeError("The model returned an unexpected number of scores.")

        predicted_id = int(np.argmax(probabilities))
        return {
            "prediction": CLASS_NAMES[predicted_id],
            "scores": {
                class_name: float(probabilities[index])
                for index, class_name in enumerate(CLASS_NAMES)
            },
        }

    @staticmethod
    def _prepare_image(image_bytes: bytes) -> np.ndarray:
        try:
            with Image.open(BytesIO(image_bytes)) as image:
                image = image.convert("RGB")
                image = image.resize(IMAGE_SIZE)
                return np.asarray(image, dtype=np.float32)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise InvalidImageError(
                "The uploaded file is not a valid JPG, JPEG, or PNG image."
            ) from exc
