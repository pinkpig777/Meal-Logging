"""Shared test setup. The default suite needs no network, Docker, or OpenAI.

- Environment is forced to local / dev auth / fixture LLM before the app is imported
  (environment variables take priority over `api/.env`).
- `fake_store` replaces the M3 repository's Supabase calls with an in-memory store, so
  endpoint flows (analyze → clarify → edit → confirm) run end to end.
"""

import os

os.environ.update(
    {
        "APP_ENV": "local",
        "AUTH_MODE": "dev",
        "LLM_MODE": "fixture",
        "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_ANON_KEY": "test-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
        "SUPABASE_JWT_SECRET": "test-jwt-secret-with-at-least-32-characters",
        "OPENAI_API_KEY": "",
        "ANALYSIS_MODELS": "model-a:Faster,model-b:More detailed",
        "ANALYSIS_MODEL_DEFAULT": "model-a",
        "LLM_TIMEOUT_SECONDS": "45",
        "CORS_ORIGINS": "http://localhost:5173",
    }
)

from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import DEV_USER_ID
from app.core.config import get_settings
from app.core.db import get_user_client
from app.core.errors import AppError, ErrorCode
from app.main import create_app
from app.modules.meals import repository
from app.modules.meals.schemas import (
    AttributeRecord,
    DailyTotalsRecord,
    ItemRecord,
    MealRecord,
    NewAttribute,
    NewItem,
    ProfileRecord,
)
from app.schemas import Goal, MealStatus
from app.services.nutrition import sum_totals

get_settings.cache_clear()


class FakeStore:
    """In-memory stand-in for the Supabase-backed repository functions."""

    def __init__(self) -> None:
        self.meals: dict[UUID, MealRecord] = {}
        self.goals: list[Goal] = []
        self.profile = ProfileRecord(
            id=DEV_USER_ID,
            display_name="Dev User",
            timezone="America/Chicago",
            dietary_restrictions=[],
            analysis_model=None,
        )
        self.downloads: list[str] = []

    # profile -------------------------------------------------------------
    def get_profile(self, db: Any, user_id: UUID) -> ProfileRecord:
        return self.profile.model_copy(deep=True)

    def update_profile(self, db: Any, user_id: UUID, fields: dict[str, Any]) -> ProfileRecord:
        self.profile = ProfileRecord.model_validate({**self.profile.model_dump(), **fields})
        return self.get_profile(db, user_id)

    def list_goals(self, db: Any, user_id: UUID) -> list[Goal]:
        return sorted(self.goals, key=lambda g: g.effective_from, reverse=True)

    # meals ---------------------------------------------------------------
    def create_meal(self, db: Any, user_id: UUID, **fields: Any) -> UUID:
        meal_id = uuid4()
        now = datetime.now(UTC)
        self.meals[meal_id] = MealRecord.model_validate(
            {
                "id": meal_id,
                "user_id": user_id,
                "status": fields.pop("status", MealStatus.analyzing),
                "created_at": now,
                "updated_at": now,
                **fields,
            }
        )
        return meal_id

    def update_meal(self, db: Any, meal_id: UUID, fields: dict[str, Any]) -> None:
        current = self.meals[meal_id]
        data = {**current.model_dump(exclude={"items"}), **fields, "items": current.items}
        self.meals[meal_id] = MealRecord.model_validate(data)

    def get_meal(self, db: Any, meal_id: UUID) -> MealRecord:
        if meal_id not in self.meals:
            raise AppError(ErrorCode.NOT_FOUND, "Meal not found.")
        record = self.meals[meal_id].model_copy(deep=True)
        record.items.sort(key=lambda i: i.position)
        return record

    def add_items(self, db: Any, user_id: UUID, meal_id: UUID, items: list[NewItem]) -> list[UUID]:
        ids = []
        for item in items:
            item_id = uuid4()
            ids.append(item_id)
            self.meals[meal_id].items.append(
                ItemRecord(
                    id=item_id,
                    meal_id=meal_id,
                    position=item.position,
                    kind=item.kind,
                    name=item.name,
                    preparation=item.preparation,
                    portion_qty=item.portion.qty,
                    portion_unit=item.portion.unit,
                    portion_grams=item.portion.grams,
                    kcal=item.nutrition.kcal,
                    protein_g=item.nutrition.protein_g,
                    carbs_g=item.nutrition.carbs_g,
                    fat_g=item.nutrition.fat_g,
                    kcal_low=item.kcal_range.low if item.kcal_range else None,
                    kcal_high=item.kcal_range.high if item.kcal_range else None,
                    source=item.source,
                    ai_original=item.ai_original,
                    attributes=[self._attr(item_id, a) for a in item.attributes],
                )
            )
        return ids

    @staticmethod
    def _attr(item_id: UUID, a: NewAttribute) -> AttributeRecord:
        return AttributeRecord(id=uuid4(), meal_item_id=item_id, **a.model_dump())

    def _find_item(self, item_id: UUID) -> tuple[MealRecord, int]:
        for meal in self.meals.values():
            for index, item in enumerate(meal.items):
                if item.id == item_id:
                    return meal, index
        raise KeyError(item_id)

    def update_item(self, db: Any, item_id: UUID, fields: dict[str, Any]) -> None:
        meal, index = self._find_item(item_id)
        item = meal.items[index]
        meal.items[index] = ItemRecord.model_validate(
            {**item.model_dump(), **fields, "attributes": item.attributes}
        )

    def delete_item(self, db: Any, item_id: UUID) -> None:
        meal, index = self._find_item(item_id)
        del meal.items[index]

    def replace_item_attributes(
        self,
        db: Any,
        user_id: UUID,
        item_id: UUID,
        attributes: list[NewAttribute],
        keep_ids: list[UUID] | tuple = (),
    ) -> None:
        meal, index = self._find_item(item_id)
        item = meal.items[index]
        kept = [a for a in item.attributes if a.id in set(keep_ids)]
        item.attributes = kept + [self._attr(item_id, a) for a in attributes]

    def update_attribute(self, db: Any, attribute_id: UUID, fields: dict[str, Any]) -> None:
        for meal in self.meals.values():
            for item in meal.items:
                for index, attr in enumerate(item.attributes):
                    if attr.id == attribute_id:
                        item.attributes[index] = AttributeRecord.model_validate(
                            {**attr.model_dump(), **fields}
                        )
                        return
        raise KeyError(attribute_id)

    def list_meals(
        self, db: Any, user_id: UUID, date_from: date, date_to: date, status: Any = None
    ) -> list[MealRecord]:
        return sorted(
            (
                m
                for m in self.meals.values()
                if date_from <= m.local_date <= date_to and (status is None or m.status == status)
            ),
            key=lambda m: m.eaten_at,
            reverse=True,
        )

    def list_daily_totals(
        self, db: Any, user_id: UUID, date_from: date, date_to: date
    ) -> list[DailyTotalsRecord]:
        """Mimics the `daily_totals` view: confirmed meals only, joined to the effective goal."""
        by_day: dict[date, list[MealRecord]] = {}
        for meal in self.list_meals(db, user_id, date_from, date_to, MealStatus.confirmed):
            by_day.setdefault(meal.local_date, []).append(meal)
        rows = []
        for day in sorted(by_day):
            items = [i for m in by_day[day] for i in m.items]
            totals = sum_totals((i.nutrition, i.kcal_range) for i in items)
            goal = repository.effective_goal(self.goals, day)
            rows.append(
                DailyTotalsRecord(
                    local_date=day,
                    meal_count=len(by_day[day]),
                    **totals.model_dump(),
                    goal_id=goal.id if goal else None,
                    goal_effective_from=goal.effective_from if goal else None,
                    goal_kcal=goal.kcal if goal else None,
                    goal_protein_g=goal.protein_g if goal else None,
                    goal_carbs_g=goal.carbs_g if goal else None,
                    goal_fat_g=goal.fat_g if goal else None,
                )
            )
        return rows

    # storage -------------------------------------------------------------
    def download_photo(self, db: Any, path: str) -> bytes:
        self.downloads.append(path)
        return b"\xff\xd8fake-jpeg"

    def create_photo_url(self, db: Any, path: str | None) -> str | None:
        return f"http://storage.test/{path}" if path else None

    def create_photo_urls(self, db: Any, paths: list[str]) -> dict[str, str]:
        return {p: f"http://storage.test/{p}" for p in paths}


@pytest.fixture
def fake_store(monkeypatch: pytest.MonkeyPatch) -> FakeStore:
    store = FakeStore()
    for name in (
        "get_profile",
        "update_profile",
        "list_goals",
        "create_meal",
        "update_meal",
        "get_meal",
        "add_items",
        "update_item",
        "delete_item",
        "replace_item_attributes",
        "update_attribute",
        "list_meals",
        "list_daily_totals",
        "download_photo",
        "create_photo_url",
        "create_photo_urls",
    ):
        monkeypatch.setattr(repository, name, getattr(store, name))
    return store


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_user_client] = lambda: object()  # no real Supabase
    with TestClient(app) as test_client:
        yield test_client
