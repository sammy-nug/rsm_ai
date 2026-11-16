from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.model_service import (
    MAX_IMAGE_BYTES,
    SUPPORTED_CONTENT_TYPES,
    InvalidImageError,
    ModelService,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "model" / "cat_dog_neither_model.keras"
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
] + [
    origin.strip().rstrip("/")
    for origin in os.environ.get("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_service = ModelService(MODEL_PATH)
    model_service.load()
    app.state.model_service = model_service
    yield


app = FastAPI(
    title="Cat, Dog, or Neither API",
    description="Image prediction API backed by the trained Keras classifier.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPG, JPEG, and PNG images are supported.",
        )

    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image files must be 10 MB or smaller.",
        )

    try:
        return app.state.model_service.predict(image_bytes)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
