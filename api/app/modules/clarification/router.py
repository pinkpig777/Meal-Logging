"""M2 endpoints (api-reference §4). Owner: Clark."""

from uuid import UUID

from fastapi import APIRouter

from app.core.auth import CurrentUser
from app.core.db import UserDb
from app.modules.clarification import service
from app.modules.clarification.schemas import AddItemRequest, ClarifyRequest, MealEditRequest
from app.schemas import Meal

router = APIRouter(tags=["clarification"])


@router.post("/meals/{id}/clarify", response_model=Meal)
def clarify_meal(id: UUID, body: ClarifyRequest, user: CurrentUser, db: UserDb) -> Meal:
    """Answer an uncertain attribute: option (no LLM call), not_sure, or other (re-estimate)."""
    return service.clarify(db, user, id, body)


@router.patch("/meals/{id}/draft", response_model=Meal)
def edit_draft_meal(id: UUID, body: MealEditRequest, user: CurrentUser, db: UserDb) -> Meal:
    """Edit a draft: meal fields, item portions and values, remove items."""
    return service.edit_meal(db, user, id, body)


@router.post("/meals/{id}/items", response_model=Meal)
def add_meal_item(id: UUID, body: AddItemRequest, user: CurrentUser, db: UserDb) -> Meal:
    """Add an item; estimated (text-only) if nutrition is omitted."""
    return service.add_item(db, user, id, body)
