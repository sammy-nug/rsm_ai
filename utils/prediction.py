from io import BytesIO
from pathlib import Path
from typing import TypedDict

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


CLASS_NAMES = ("cat", "dog", "neither")
IMAGE_SIZE = (224, 224)


class Prediction(TypedDict):
    prediction: str
    confidence: float
    class_scores: dict[str, float]


class PredictionError(ValueError):
    """Raised when an uploaded image cannot be prepared for prediction."""


def load_saved_model(model_path: Path) -> tf.keras.Model:
    return tf.keras.models.load_model(model_path)


def predict_image_bytes(image_bytes: bytes, model: tf.keras.Model) -> Prediction:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image = image.resize(IMAGE_SIZE)
            image_array = np.asarray(image, dtype=np.float32)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise PredictionError(
            "This file is not a valid JPG, JPEG, or PNG image."
        ) from exc

    try:
        probabilities = model.predict(
            np.expand_dims(image_array, axis=0),
            verbose=0,
        )[0]
    except (OSError, RuntimeError, ValueError, tf.errors.InvalidArgumentError) as exc:
        raise PredictionError("The model could not analyze this image.") from exc

    if len(probabilities) != len(CLASS_NAMES):
        raise PredictionError(
            "The loaded model does not return the expected three class scores."
        )

    predicted_id = int(np.argmax(probabilities))
    return {
        "prediction": CLASS_NAMES[predicted_id],
        "confidence": float(probabilities[predicted_id]),
        "class_scores": {
            class_name: float(probabilities[index])
            for index, class_name in enumerate(CLASS_NAMES)
        },
    }
