import json
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.modules.meals import repository
from app.modules.recommendations.chat_service import GeneratedChat, generate_chat
from app.modules.recommendations.meal_drafts import MealDraft, remaining_today, render_draft
from app.services.llm import client as llm
from tests.conftest import FakeStore
from tests.modules.recommendations.test_chat import seed_chat
from tests.modules.recommendations.test_service import row


def draft_data() -> dict[str, Any]:
    return {
        "ingredients": [
            {
                "name": "Lean ground beef",
                "portion": "150 g cooked",
                "estimated_nutrition": {"kcal": 300, "protein_g": 39, "carbs_g": 0, "fat_g": 16},
            },
            {
                "name": "White rice",
                "portion": "1 cup cooked",
                "estimated_nutrition": {"kcal": 205, "protein_g": 4, "carbs_g": 45, "fat_g": 0.4},
            },
            {
                "name": "Avocado",
                "portion": "50 g flesh",
                "estimated_nutrition": {"kcal": 80, "protein_g": 1, "carbs_g": 4, "fat_g": 7.5},
            },
        ],
        "assumptions": ["Beef is lean; weights are cooked. No added oil or sauces."],
    }


def test_draft_totals_and_projection_use_code_arithmetic() -> None:
    draft = MealDraft.model_validate(draft_data())
    assert draft.totals()["protein_g"] == 44
    gaps = {"kcal": 700.0, "protein_g": 50.0, "carbs_g": 40.0, "fat_g": -5.0}
    rendered = render_draft(draft, gaps)
    assert "Estimated draft total: 585 kcal, 44 g protein, 49 g carbs, 24 g fat" in rendered
    assert "115 kcal below goal; 6 g protein below goal; 9 g carbs above goal" in rendered
    assert "29 g fat above goal" in rendered
    assert "not saved" in rendered and "AI nutrition estimates" in rendered
    assert "150 g cooked" in rendered and "No added oil" in rendered


@pytest.mark.parametrize("mode", ["missing_day", "missing_goal", "incomplete_goal"])
def test_missing_today_or_goal_never_becomes_zero(mode: str) -> None:
    r = row(30, 80)
    today = r.local_date
    if mode == "missing_day":
        today = date(2026, 10, 31)
    elif mode == "missing_goal":
        r.goal_id = None
    else:
        r.goal_fat_g = None
    gaps = remaining_today([r], today)
    assert gaps is None
    text = render_draft(MealDraft.model_validate(draft_data()), gaps)
    assert "comparison is unavailable" in text
    assert "If eaten" not in text


def test_remaining_keeps_negative_gaps_and_uses_todays_historical_goal() -> None:
    r = row(30, 150)
    r.goal_protein_g = 140
    assert remaining_today([r], r.local_date) == {
        "kcal": 0,
        "protein_g": -10,
        "carbs_g": -30,
        "fat_g": -5,
    }


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), 3000])
def test_invalid_draft_estimates_are_rejected(value: float) -> None:
    data = draft_data()
    data["ingredients"][0]["estimated_nutrition"]["kcal"] = value
    with pytest.raises(ValidationError):
        MealDraft.model_validate(data)


def test_draft_total_is_bounded_even_with_individually_plausible_ingredients() -> None:
    data = draft_data()
    data["ingredients"] = [data["ingredients"][0]] * 5
    for ingredient in data["ingredients"]:
        ingredient["estimated_nutrition"] = {
            "kcal": 800,
            "protein_g": 100,
            "carbs_g": 100,
            "fat_g": 0,
        }
    with pytest.raises(ValidationError):
        MealDraft.model_validate(data)


def test_draft_is_separate_from_records_and_today_projection_is_cited(
    client: TestClient, fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    seed_chat(client, fake_store, monkeypatch)
    monkeypatch.setattr(repository, "today_for", lambda _: date(2026, 10, 30))
    before = {str(k): m.model_dump(mode="json") for k, m in fake_store.meals.items()}
    captured: dict[str, Any] = {}

    def generate(**kwargs: Any) -> GeneratedChat:
        captured.update(json.loads(kwargs["user"]))
        return GeneratedChat(
            answer="Here is an optional dinner draft using your ingredients.",
            fact_ids=[],
            meal_ids=[],
            meal_draft=MealDraft.model_validate(draft_data()),
        )

    monkeypatch.setattr(llm, "structured", generate)
    response = client.post(
        "/api/v1/chat",
        json={
            "period": "today",
            "messages": [{"role": "user", "content": "Draft beef, rice, avocado for dinner."}],
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert captured["today_remaining"] is not None
    assert "Estimated draft total: 585 kcal" in result["message"]["content"]
    assert "goal minus today's confirmed intake" in result["message"]["content"]
    assert result["references"] == {"dates": ["2026-10-30"], "meal_ids": []}
    assert len(result["message"]["content"]) <= 4000
    assert before == {str(k): m.model_dump(mode="json") for k, m in fake_store.meals.items()}


def test_substitution_receives_previous_draft_and_retains_unchanged_portions(
    client: TestClient, fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    seed_chat(client, fake_store, monkeypatch)
    data = draft_data()
    previous = render_draft(MealDraft.model_validate(data), None)
    turns = [
        {"role": "user", "content": "Estimate 150 g cooked beef, 1 cup cooked rice, 50 g avocado."},
        {"role": "assistant", "content": previous},
        {"role": "user", "content": "Replace avocado with 1/2 cup raspberries; keep the rest."},
    ]
    data["ingredients"][2] = {
        "name": "Raspberries",
        "portion": "1/2 cup",
        "estimated_nutrition": {"kcal": 32, "protein_g": 0.7, "carbs_g": 7.3, "fat_g": 0.4},
    }

    def generate(**kwargs: Any) -> GeneratedChat:
        assert json.loads(kwargs["user"])["conversation"] == turns
        assert "replace only that ingredient" in kwargs["system"]
        assert "Never ask for known portions again" in kwargs["system"]
        return GeneratedChat(
            answer="Here is the updated hypothetical dinner with the other portions unchanged.",
            fact_ids=[],
            meal_ids=[],
            meal_draft=MealDraft.model_validate(data),
        )

    monkeypatch.setattr(llm, "structured", generate)
    response = client.post("/api/v1/chat", json={"messages": turns})
    assert response.status_code == 200
    text = response.json()["message"]["content"]
    assert "150 g cooked" in text and "1 cup cooked" in text
    assert "Raspberries: 1/2 cup" in text and "Avocado:" not in text
    assert "Estimated draft total: 537 kcal" in text
    # With no logged today, the hypothetical meal must not become today's intake.
    assert "remaining-goal comparison is unavailable" in text


def test_numeric_draft_prose_does_not_discard_valid_portions() -> None:
    result = GeneratedChat(
        answer="Estimate for 1 lb of beef, 1 cup rice, and 1/4 avocado.",
        fact_ids=[],
        meal_ids=[],
        meal_draft=MealDraft.model_validate(draft_data()),
    )
    assert result.meal_draft is not None
    assert result.meal_draft.ingredients[0].portion == "150 g cooked"
    assert result.answer == "Here is the hypothetical meal estimate, with preparation assumptions."


def test_explicit_large_portion_can_be_estimated_even_if_it_exceeds_remaining_fat() -> None:
    data = draft_data()
    data["ingredients"][0]["portion"] = "1 lb raw"
    data["ingredients"][0]["estimated_nutrition"] = {
        "kcal": 970,
        "protein_g": 90,
        "carbs_g": 0,
        "fat_g": 68,
    }
    text = render_draft(
        MealDraft.model_validate(data),
        {"kcal": 1055, "protein_g": 86, "carbs_g": 147, "fat_g": 10},
    )
    assert "1 lb raw" in text
    assert "Estimated draft total: 1255 kcal" in text
    assert "200 kcal above goal" in text
    assert "66 g fat above goal" in text


def test_assumption_length_limit_is_in_the_model_schema() -> None:
    schema = MealDraft.model_json_schema()
    assert schema["properties"]["assumptions"]["items"]["maxLength"] == 120


def test_invalid_output_gets_one_correction_without_logging_conversation(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    calls: list[dict[str, Any]] = []

    def generate(**kwargs: Any) -> GeneratedChat:
        calls.append(kwargs)
        if len(calls) == 1:
            try:
                GeneratedChat(answer="PRIVATE meal 999 kcal", fact_ids=[], meal_ids=[])
            except ValidationError as error:
                raise llm.LLMInvalidOutputError(details=str(error)) from error
        return GeneratedChat(
            answer="Here is the estimate.",
            fact_ids=[],
            meal_ids=[],
            meal_draft=MealDraft.model_validate(draft_data()),
        )

    monkeypatch.setattr(llm, "structured", generate)
    result = generate_chat(model="test-model", payload='{"conversation":"PRIVATE"}')
    assert result.meal_draft is not None
    assert len(calls) == 2
    assert calls[0]["user"] == calls[1]["user"]
    assert "previous response failed validation" in calls[1]["system"]
    assert calls[0]["prompt_version"] == "m5-chat.v3"
    assert "PRIVATE" not in caplog.text
    record = next(r for r in caplog.records if r.message == "chat output validation failed")
    assert record.__dict__["fields"]["validation_issues"] == [{"path": [], "type": "numeric_prose"}]


def test_repeated_invalid_output_is_bounded_and_returns_safe_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    def fail(**_: Any) -> GeneratedChat:
        nonlocal attempts
        attempts += 1
        try:
            data = draft_data()
            data["assumptions"] = ["PRIVATE" * 30]
            MealDraft.model_validate(data)
        except ValidationError as error:
            raise llm.LLMInvalidOutputError(details=str(error)) from error
        pytest.fail("Expected validation failure")

    monkeypatch.setattr(llm, "structured", fail)
    with pytest.raises(llm.LLMInvalidOutputError) as error:
        generate_chat(model="test-model", payload="PRIVATE")
    assert attempts == 2
    assert "PRIVATE" not in str(error.value.details)
    assert error.value.details == {
        "validation_issues": [{"path": ["assumptions", 0], "type": "string_too_long"}]
    }


@pytest.mark.parametrize("failure", [llm.LLMTimeoutError, llm.LLMUnavailableError])
def test_chat_correction_does_not_retry_timeout_or_quota_errors(
    monkeypatch: pytest.MonkeyPatch, failure: type[llm.LLMError]
) -> None:
    attempts = 0

    def fail(**_: Any) -> GeneratedChat:
        nonlocal attempts
        attempts += 1
        raise failure()

    monkeypatch.setattr(llm, "structured", fail)
    with pytest.raises(failure):
        generate_chat(model="test-model", payload="{}")
    assert attempts == 1
