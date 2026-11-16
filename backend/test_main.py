from fastapi.testclient import TestClient

from backend.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_prediction_rejects_unsupported_content_type():
    with TestClient(app) as client:
        response = client.post(
            "/predict",
            files={"file": ("notes.txt", b"not an image", "text/plain")},
        )

    assert response.status_code == 415
