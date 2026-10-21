from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.errors import ERROR_STATUS, ErrorCode
from app.main import create_app


def assert_envelope(body: dict, code: str) -> None:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details", "request_id"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]


def test_every_code_has_a_status() -> None:
    assert set(ERROR_STATUS) == set(ErrorCode)


def test_health_has_request_id(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "req-123"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["X-Request-ID"] == "req-123"


def test_validation_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/meals/not-a-uuid", headers={"X-Request-ID": "abc"})
    assert response.status_code == 422
    body = response.json()
    assert_envelope(body, "VALIDATION_ERROR")
    assert body["error"]["request_id"] == "abc"
    assert body["error"]["details"][0]["loc"] == ["path", "id"]
    assert set(body["error"]["details"][0]) == {"loc", "msg"}


def test_unknown_route_is_not_found(client: TestClient) -> None:
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert_envelope(response.json(), "NOT_FOUND")


def test_app_error_envelope(client: TestClient, fake_store) -> None:
    response = client.get("/api/v1/meals/00000000-0000-0000-0000-00000000abcd")
    assert response.status_code == 404
    assert_envelope(response.json(), "NOT_FOUND")
    assert response.headers.get("X-Request-ID")


def test_missing_token_is_unauthenticated_in_supabase_mode() -> None:
    app = create_app()
    supabase_settings = Settings(_env_file=None, auth_mode="supabase")  # type: ignore[call-arg]
    app.dependency_overrides[get_settings] = lambda: supabase_settings
    with TestClient(app) as client:
        response = client.get("/api/v1/me")
        assert response.status_code == 401
        assert_envelope(response.json(), "UNAUTHENTICATED")
        response = client.get("/api/v1/me", headers={"Authorization": "Bearer garbage"})
        assert response.status_code == 401
