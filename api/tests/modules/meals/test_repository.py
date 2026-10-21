"""Repository helpers that don't need a database."""

from datetime import date, datetime
from uuid import uuid4

import pytest

from app.core.errors import AppError
from app.modules.meals import repository
from app.modules.meals.schemas import MealRecord
from app.schemas import Goal

MEAL_ROW = {
    "id": str(uuid4()),
    "user_id": str(uuid4()),
    "status": "draft",
    "meal_type": "lunch",
    "eaten_at": "2026-10-21T17:30:00+00:00",
    "local_date": "2026-10-21",
    "text_input": None,
    "photo_path": None,
    "image_issues": ["blurry"],
    "model_version": "model-a",
    "prompt_version": "analyze_meal.v1",
    "analysis_raw": {"items": []},
    "failure_reason": None,
    "created_at": "2026-10-21T17:30:00+00:00",
    "updated_at": "2026-10-21T17:30:01+00:00",
    "confirmed_at": None,
    "meal_items": [
        {
            "id": str(uuid4()),
            "meal_id": "x",
            "user_id": "y",
            "position": 0,
            "kind": "dish",
            "name": "White rice",
            "preparation": "steamed",
            "portion_qty": 1,
            "portion_unit": "cup",
            "portion_grams": 158,
            "kcal": 205,
            "protein_g": 4.3,
            "carbs_g": 45,
            "fat_g": 0.4,
            "kcal_low": 102.5,
            "kcal_high": 410,
            "source": "ai",
            "ai_original": None,
            "created_at": "2026-10-21T17:30:00+00:00",
            "updated_at": "2026-10-21T17:30:00+00:00",
            "uncertain_attributes": [],
        }
    ],
}


def test_postgrest_row_maps_to_meal_contract() -> None:
    row = {**MEAL_ROW, "meal_items": [{**MEAL_ROW["meal_items"][0], "meal_id": MEAL_ROW["id"]}]}
    meal = repository.to_meal(MealRecord.model_validate(row), "http://signed")
    assert meal.items[0].portion.grams == 158
    assert meal.items[0].kcal_range is not None and meal.items[0].kcal_range.high == 410
    assert (meal.totals.kcal, meal.totals.kcal_low, meal.totals.kcal_high) == (205, 102.5, 410)
    assert meal.photo_url == "http://signed"


def test_local_date_uses_profile_timezone() -> None:
    eaten = datetime.fromisoformat("2026-10-22T03:30:00+00:00")
    assert repository.local_date_for(eaten, "America/Chicago") == date(2026, 10, 21)
    assert repository.local_date_for(eaten, "Asia/Taipei") == date(2026, 10, 22)
    assert repository.local_date_for(eaten, "Not/AZone") == date(2026, 10, 21)  # default zone


def test_effective_goal_is_latest_on_or_before_date() -> None:
    def g(day: int) -> Goal:
        return Goal(
            id=uuid4(),
            effective_from=date(2026, 10, day),
            kcal=2000,
            protein_g=1,
            carbs_g=1,
            fat_g=1,
        )

    goals = [g(1), g(10), g(20)]
    assert repository.effective_goal(goals, date(2026, 9, 30)) is None
    assert repository.effective_goal(goals, date(2026, 10, 10)) == goals[1]
    assert repository.effective_goal(goals, date(2026, 10, 19)) == goals[1]


def test_date_range_cap() -> None:
    repository.check_date_range(date(2026, 1, 1), date(2026, 4, 2))  # 92 days
    with pytest.raises(AppError):
        repository.check_date_range(date(2026, 1, 1), date(2026, 4, 3))
    with pytest.raises(AppError):
        repository.check_date_range(date(2026, 2, 1), date(2026, 1, 1))
