"""Checked vs AI-only kcal split on NutritionTotals (meal, summary, and day totals)."""

from datetime import UTC, date, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.auth import DEV_USER_ID
from app.modules.meals import repository
from app.modules.meals.schemas import NewItem
from app.schemas import (
    ItemKind,
    ItemSource,
    KcalRange,
    MealStatus,
    MealType,
    Nutrition,
    NutritionTotals,
    Portion,
)
from app.services.nutrition import sum_totals
from tests.conftest import FakeStore

DAY = date(2026, 10, 21)


def n(kcal: float) -> Nutrition:
    # Roughly 25% protein / 45% carbs / 30% fat.
    return Nutrition(kcal=kcal, protein_g=kcal * 0.0625, carbs_g=kcal * 0.1125, fat_g=kcal / 30)


def assert_invariant(t: NutritionTotals) -> None:
    assert t.kcal_checked + t.kcal_ai_only == pytest.approx(t.kcal)


def test_all_ai_meal_is_entirely_ai_only() -> None:
    totals = sum_totals(
        [(n(300), KcalRange(low=250, high=400), ItemSource.ai), (n(120), None, ItemSource.ai)]
    )
    assert totals.kcal_ai_only == pytest.approx(420)
    assert totals.kcal_checked == 0
    assert_invariant(totals)


def test_mixed_meal_splits_by_source() -> None:
    totals = sum_totals(
        [
            (n(400), KcalRange(low=300, high=520), ItemSource.ai),
            (n(250), None, ItemSource.ai_clarified),
            (n(90), None, ItemSource.user_edited),
            (n(60), None, ItemSource.user_added),
        ]
    )
    assert totals.kcal_ai_only == pytest.approx(400)
    assert totals.kcal_checked == pytest.approx(400)
    assert_invariant(totals)


def test_user_added_item_counts_as_checked() -> None:
    totals = sum_totals([(n(150), None, ItemSource.user_added)])
    assert (totals.kcal_checked, totals.kcal_ai_only) == (150, 0)


def test_empty_meal_has_zero_split() -> None:
    totals = sum_totals([])
    assert (totals.kcal, totals.kcal_checked, totals.kcal_ai_only) == (0, 0, 0)


def _item(position: int, kcal: float, source: ItemSource) -> NewItem:
    return NewItem(
        position=position,
        kind=ItemKind.dish,
        name=f"item {position}",
        preparation=None,
        portion=Portion(qty=1, unit="serving", grams=100),
        nutrition=n(kcal),
        kcal_range=None,
        source=source,
        ai_original=None,
    )


def _confirmed_meal(store: FakeStore, hour: int, meal_type: MealType, items: list[NewItem]) -> UUID:
    meal_id = store.create_meal(
        None,
        DEV_USER_ID,
        status=MealStatus.confirmed,
        meal_type=meal_type,
        eaten_at=datetime(2026, 10, 21, hour, tzinfo=UTC),
        local_date=DAY,
        text_input=None,
        photo_path=None,
        confirmed_at=datetime(2026, 10, 21, hour, tzinfo=UTC),
    )
    store.add_items(None, DEV_USER_ID, meal_id, items)
    return meal_id


def test_meal_and_summary_carry_split(fake_store: FakeStore) -> None:
    meal_id = _confirmed_meal(
        fake_store,
        17,
        MealType.lunch,
        [_item(0, 500, ItemSource.ai), _item(1, 200, ItemSource.user_added)],
    )
    record = fake_store.get_meal(None, meal_id)
    for totals in (
        repository.to_meal(record, None).totals,
        repository.to_summary(record, None).totals,
    ):
        assert (totals.kcal_checked, totals.kcal_ai_only) == (200, 500)
        assert_invariant(totals)


def test_day_totals_aggregate_split_across_meals(client: TestClient, fake_store: FakeStore) -> None:
    _confirmed_meal(fake_store, 13, MealType.breakfast, [_item(0, 400, ItemSource.ai)])
    _confirmed_meal(
        fake_store,
        18,
        MealType.lunch,
        [_item(0, 600, ItemSource.ai_clarified), _item(1, 100, ItemSource.user_edited)],
    )

    history = client.get(
        "/api/v1/analytics/history", params={"from": "2026-10-20", "to": "2026-10-21"}
    ).json()
    unlogged, logged = history["days"]
    assert unlogged["totals"] is None
    totals = logged["totals"]
    assert (totals["kcal"], totals["kcal_checked"], totals["kcal_ai_only"]) == (1100, 700, 400)

    daily = client.get("/api/v1/analytics/daily", params={"date": "2026-10-21"}).json()
    assert daily["totals"]["kcal_checked"] == 700
    assert [m["totals"]["kcal_ai_only"] for m in daily["meals"]] == [400, 0]

    weekly = client.get("/api/v1/analytics/weekly", params={"start": "2026-10-19"}).json()
    day = next(d for d in weekly["days"] if d["date"] == "2026-10-21")
    assert day["totals"]["kcal_ai_only"] == 400
    assert "kcal_checked" not in weekly["averages"]


def test_analyzed_draft_is_ai_only(client: TestClient, fake_store: FakeStore) -> None:
    meal = client.post(
        "/api/v1/meals/analyze",
        json={"text_input": "chicken and rice", "eaten_at": "2026-10-21T12:30:00-05:00"},
    ).json()
    totals = meal["totals"]
    assert totals["kcal_checked"] == 0
    assert totals["kcal_ai_only"] == pytest.approx(totals["kcal"])
