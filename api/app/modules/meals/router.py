"""M3 endpoints: meals CRUD + confirm, goals, profile (api-reference §5). Owner: Yi-Wei."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response, status

from app.core.auth import CurrentUser
from app.core.config import get_settings
from app.core.db import UserDb
from app.core.errors import AppError, ErrorCode
from app.modules.clarification import service as clarification_service
from app.modules.clarification.schemas import MealEditRequest
from app.modules.meals import repository
from app.modules.meals.schemas import (
    GoalCreate,
    GoalsResponse,
    MealListResponse,
    ProfileRecord,
    ProfileUpdate,
)
from app.schemas import Goal, Meal, MealStatus, Profile

logger = logging.getLogger(__name__)

router = APIRouter(tags=["meals"])

# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------


@router.post("/meals/{id}/confirm", response_model=Meal)
def confirm_meal(id: UUID, user: CurrentUser, db: UserDb) -> Meal:
    """Confirm a draft. Confirmed meals count toward analytics and suggestions."""
    meal = repository.get_meal(db, id)
    if meal.status != MealStatus.draft:
        raise AppError(
            ErrorCode.MEAL_INVALID_STATE,
            f"This meal is {meal.status.value} and cannot be confirmed.",
            details={"meal_id": str(id), "status": meal.status.value},
        )
    if not meal.items:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Add at least one item before confirming this meal."
        )
    repository.confirm_meal(db, meal, datetime.now(UTC))
    return repository.load_meal(db, id)


@router.get("/meals", response_model=MealListResponse)
def list_meals(
    user: CurrentUser,
    db: UserDb,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    meal_status: Annotated[MealStatus, Query(alias="status")] = MealStatus.confirmed,
) -> MealListResponse:
    """Meals in a local-date range (default: last 7 days), newest first."""
    profile = repository.get_profile(db, user.id)
    date_to = date_to or repository.today_for(profile.timezone)
    date_from = date_from or date_to - timedelta(days=6)
    repository.check_date_range(date_from, date_to)
    records = repository.list_meals(db, user.id, date_from, date_to, meal_status)
    urls = repository.create_photo_urls(db, [r.photo_path for r in records if r.photo_path])
    return MealListResponse(
        meals=[
            repository.to_summary(r, urls.get(r.photo_path) if r.photo_path else None)
            for r in records
        ]
    )


@router.get("/meals/{id}", response_model=Meal)
def get_meal(id: UUID, _: CurrentUser, db: UserDb) -> Meal:
    return repository.load_meal(db, id)


@router.patch("/meals/{id}", response_model=Meal)
def edit_confirmed_meal(id: UUID, body: MealEditRequest, user: CurrentUser, db: UserDb) -> Meal:
    """Edit a confirmed meal in place (same body as the draft PATCH); it stays confirmed."""
    return clarification_service.edit_meal(db, user, id, body, allowed=(MealStatus.confirmed,))


@router.delete("/meals/{id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_meal(id: UUID, _: CurrentUser, db: UserDb) -> Response:
    """Hard delete; items and attributes cascade; the photo object is removed."""
    meal = repository.get_meal(db, id)
    repository.delete_meal(db, id)
    if meal.photo_path:
        _remove_photo_best_effort(db, meal.photo_path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/meals/{id}/photo", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_meal_photo(id: UUID, _: CurrentUser, db: UserDb) -> Response:
    """Delete only the photo; nutrition records remain."""
    meal = repository.get_meal(db, id)
    if meal.photo_path:
        repository.update_meal(db, id, {"photo_path": None})
        _remove_photo_best_effort(db, meal.photo_path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _remove_photo_best_effort(db: Any, path: str) -> None:
    try:
        repository.remove_photo(db, path)
    except Exception:
        # TODO(Yi-Wei): retry/cleanup job for orphaned photos.
        logger.warning("could not remove photo object", exc_info=True)


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------


@router.get("/goals", response_model=GoalsResponse)
def get_goals(user: CurrentUser, db: UserDb) -> GoalsResponse:
    profile = repository.get_profile(db, user.id)
    history = repository.list_goals(db, user.id)
    current = repository.effective_goal(history, repository.today_for(profile.timezone))
    return GoalsResponse(current=current, history=history)


@router.post("/goals", response_model=Goal, status_code=status.HTTP_201_CREATED)
def create_goal(body: GoalCreate, user: CurrentUser, db: UserDb) -> Goal:
    """Set a new goal from `effective_from` (default today); replaces a same-day goal."""
    effective_from = body.effective_from
    if effective_from is None:
        effective_from = repository.today_for(repository.get_profile(db, user.id).timezone)
    return repository.upsert_goal(db, user.id, body, effective_from)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


def _to_profile(record: ProfileRecord, user: CurrentUser) -> Profile:
    return Profile(
        id=record.id,
        email=user.email or "",
        display_name=record.display_name,
        avatar_url=user.avatar_url,
        timezone=record.timezone,
        dietary_restrictions=record.dietary_restrictions,
        analysis_model=record.analysis_model,
    )


@router.get("/me", response_model=Profile)
def get_me(
    user: CurrentUser,
    db: UserDb,
    x_timezone: Annotated[str | None, Header(description="Browser IANA time zone")] = None,
) -> Profile:
    """Current user's profile. A valid `X-Timezone` header updates `timezone` when it changed."""
    record = repository.get_profile(db, user.id)
    if x_timezone and x_timezone != record.timezone and repository.is_valid_timezone(x_timezone):
        record = repository.update_profile(db, user.id, {"timezone": x_timezone})
    return _to_profile(record, user)


@router.patch("/me", response_model=Profile)
def update_me(body: ProfileUpdate, user: CurrentUser, db: UserDb) -> Profile:
    fields = body.model_dump(exclude_unset=True)
    if "timezone" in fields:
        tz = fields["timezone"]
        if tz is None or not repository.is_valid_timezone(tz):
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "That time zone is not recognized.",
                details=[{"loc": ["body", "timezone"], "msg": "must be an IANA time zone"}],
            )
    for key in ("display_name", "dietary_restrictions"):
        if key in fields and fields[key] is None:
            fields[key] = [] if key == "dietary_restrictions" else None
    model = fields.get("analysis_model")
    if model is not None and not get_settings().is_model_allowed(model):
        raise AppError(ErrorCode.MODEL_NOT_ALLOWED, details={"analysis_model": model})
    return _to_profile(repository.update_profile(db, user.id, fields), user)
