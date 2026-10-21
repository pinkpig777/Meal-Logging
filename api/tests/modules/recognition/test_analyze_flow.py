"""POST /meals/analyze end to end (fixture LLM + in-memory repository)."""

import pytest
from fastapi.testclient import TestClient

from app.core.auth import DEV_USER_ID
from app.schemas import MealStatus
from app.services.llm import client as llm
from app.services.llm import fixtures
from tests.conftest import FakeStore

ANALYZE = "/api/v1/meals/analyze"


def test_text_analysis_returns_draft(client: TestClient, fake_store: FakeStore) -> None:
    response = client.post(
        ANALYZE,
        json={"text_input": "chicken burrito bowl", "eaten_at": "2026-10-21T12:30:00-05:00"},
    )
    assert response.status_code == 201, response.text
    meal = response.json()
    assert meal["status"] == "draft"
    assert meal["meal_type"] == "lunch"
    assert meal["local_date"] == "2026-10-21"
    assert meal["model_version"] == "model-a"
    assert [i["name"] for i in meal["items"]] == ["Chicken burrito bowl", "Sour cream", "Salsa"]
    asked = [a for i in meal["items"] for a in i["uncertain_attributes"] if a["asked"]]
    assert len(asked) == 2
    bowl = meal["items"][0]
    assert bowl["kcal_range"] == {"low": 510.0, "high": 990.0}
    assert bowl["ai_original"]["name"] == "Chicken burrito bowl"
    assert meal["totals"]["kcal"] == pytest.approx(750)
    assert meal["totals"]["kcal_low"] < meal["totals"]["kcal"] < meal["totals"]["kcal_high"]


def test_photo_analysis_uses_callers_folder(client: TestClient, fake_store: FakeStore) -> None:
    path = f"{DEV_USER_ID}/pasta_cream_sauce.jpg"
    response = client.post(ANALYZE, json={"photo_path": path})
    assert response.status_code == 201, response.text
    meal = response.json()
    assert meal["image_issues"] == ["blurry"]
    assert meal["photo_url"] == f"http://storage.test/{path}"
    assert fake_store.downloads == []  # fixture mode never downloads the photo


def test_photo_outside_callers_folder_is_rejected(client: TestClient, fake_store) -> None:
    response = client.post(ANALYZE, json={"photo_path": "someone-else/x.jpg"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert fake_store.meals == {}


def test_input_required(client: TestClient, fake_store: FakeStore) -> None:
    response = client.post(ANALYZE, json={"text_input": "   "})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INPUT_REQUIRED"


def test_not_food_marks_meal_failed(client: TestClient, fake_store: FakeStore) -> None:
    response = client.post(ANALYZE, json={"photo_path": f"{DEV_USER_ID}/not_food.jpg"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "IMAGE_NOT_FOOD"
    (meal,) = fake_store.meals.values()
    assert str(meal.id) == error["details"]["meal_id"]
    assert meal.status == MealStatus.failed
    assert meal.failure_reason


def test_semantic_failure_is_retried_once(
    client: TestClient, fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    good = fixtures.load_analysis("chicken_rice_broccoli")
    bad = good.model_copy(deep=True)
    bad.items[0].nutrition.kcal = 1000  # energy check fails
    calls: list[list[str] | None] = []

    def fake_analyze(**kwargs):
        calls.append(kwargs["feedback"])
        return bad if len(calls) == 1 else good

    monkeypatch.setattr(llm, "analyze_meal", fake_analyze)
    response = client.post(ANALYZE, json={"text_input": "chicken and rice"})
    assert response.status_code == 201, response.text
    assert calls[0] is None
    assert calls[1] and "within 25%" in calls[1][0]


def test_second_failure_is_invalid_output(
    client: TestClient, fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    bad = fixtures.load_analysis("chicken_rice_broccoli")
    bad.items[0].nutrition.kcal = 1000
    monkeypatch.setattr(llm, "analyze_meal", lambda **_: bad)
    response = client.post(ANALYZE, json={"text_input": "chicken and rice"})
    assert response.status_code == 502
    error = response.json()["error"]
    assert error["code"] == "LLM_INVALID_OUTPUT"
    (meal,) = fake_store.meals.values()
    assert meal.status == MealStatus.failed
    assert error["details"]["meal_id"] == str(meal.id)


def test_llm_timeout_keeps_failed_meal(
    client: TestClient, fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    def timeout(**_):
        raise llm.LLMTimeoutError()

    monkeypatch.setattr(llm, "analyze_meal", timeout)
    response = client.post(ANALYZE, json={"text_input": "burrito"})
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "LLM_TIMEOUT"
    assert next(iter(fake_store.meals.values())).status == MealStatus.failed


def test_profile_model_is_used_when_allowlisted(client: TestClient, fake_store: FakeStore) -> None:
    fake_store.profile.analysis_model = "model-b"
    assert client.post(ANALYZE, json={"text_input": "x"}).json()["model_version"] == "model-b"
    fake_store.profile.analysis_model = "retired-model"
    assert client.post(ANALYZE, json={"text_input": "x"}).json()["model_version"] == "model-a"


def test_config_models(client: TestClient) -> None:
    body = client.get("/api/v1/config/models").json()
    assert body["default"] == "model-a"
    assert body["models"][1] == {"id": "model-b", "label": "More detailed", "description": None}
