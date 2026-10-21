"""M1 service: photo/text → draft meal (M1 design §3.1), and single-item (re-)estimation (§3.6).

Persistence goes through the M3 repository; question selection through the M2 policy.
Owner: Charlie.
"""

import logging
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.auth import AuthenticatedUser
from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.modules.clarification import policy
from app.modules.meals import repository
from app.modules.meals.schemas import ItemRecord, MealRecord, NewItem
from app.modules.recognition.schemas import (
    AnalysisModelInfo,
    AnalysisModelsResponse,
    AnalyzeMealRequest,
    ReestimateItemRequest,
)
from app.modules.recognition.validation import (
    CheckOutcome,
    check_analysis,
    check_item,
    item_kcal_range,
    to_new_item,
)
from app.schemas import AttributeKind, ItemSource, Meal, MealStatus, MealType, Portion
from app.services.llm import client as llm
from app.services.llm.schemas import AnalysisResult, LLMItem
from app.services.nutrition import scale_nutrition

logger = logging.getLogger(__name__)

NOT_FOOD_MESSAGE = "This photo doesn't seem to show food. Try another photo or describe your meal."


# ---------------------------------------------------------------------------
# GET /config/models
# ---------------------------------------------------------------------------


def list_models() -> AnalysisModelsResponse:
    settings = get_settings()
    return AnalysisModelsResponse(
        default=settings.analysis_model_default,
        models=[
            AnalysisModelInfo(id=m.id, label=m.label, description=m.description)
            for m in settings.analysis_models
        ],
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def infer_meal_type(local_time: datetime) -> MealType:
    """Suggest a meal type from the local time of day; the user can change it."""
    minutes = local_time.hour * 60 + local_time.minute
    if 4 * 60 <= minutes < 10 * 60 + 30:
        return MealType.breakfast
    if 10 * 60 + 30 <= minutes < 15 * 60:
        return MealType.lunch
    if 17 * 60 <= minutes < 22 * 60:
        return MealType.dinner
    return MealType.snack


def _validate_photo_path(user: AuthenticatedUser, photo_path: str) -> str:
    path = photo_path.strip().lstrip("/")
    parts = path.split("/")
    if len(parts) != 2 or parts[0] != str(user.id) or not parts[1] or ".." in path:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "The photo must be uploaded to your own folder.",
            details=[{"loc": ["body", "photo_path"], "msg": "must be {user_id}/{photo_id}.jpg"}],
        )
    return path


def _photo_input(db: Client, path: str | None) -> llm.PhotoInput | None:
    if not path:
        return None
    return llm.PhotoInput(path=path, load_bytes=lambda: repository.download_photo(db, path))


def _context(
    meal: MealRecord | None,
    eaten_at: datetime,
    tz: str,
    meal_type: MealType | None,
    restrictions: Sequence[str],
) -> llm.MealContext:
    local = eaten_at.astimezone(repository.zone(tz))
    return llm.MealContext(
        local_time=local.strftime("%Y-%m-%d %H:%M (%A)"),
        meal_type_hint=(meal_type or (meal.meal_type if meal else None)),
        dietary_restrictions=list(restrictions),
    )


def with_semantic_retry[T](
    call: Callable[[list[str] | None], T], check: Callable[[T], CheckOutcome[T]]
) -> T:
    """Call the LLM, run the semantic checks, and retry once with the errors as feedback.

    Raises LLM_INVALID_OUTPUT when the second attempt also fails (M1 §3.4).
    """
    feedback: list[str] | None = None
    for attempt in (1, 2):
        try:
            outcome = check(call(feedback))
        except llm.LLMInvalidOutputError as exc:
            # Schema-level failure (unparseable / refusal): also worth one retry.
            feedback = [f"The response did not match the schema: {exc.details or exc.message}"]
            if attempt == 2:
                raise
            continue
        if outcome.ok:
            return outcome.value
        feedback = outcome.errors
        logger.info(
            "llm output failed semantic checks",
            extra={"fields": {"attempt": attempt, "error_count": len(outcome.errors)}},
        )
    raise llm.LLMInvalidOutputError(details={"errors": feedback})


def build_draft_items(result: AnalysisResult) -> list[NewItem]:
    """Derived values (§3.5) + clarification policy (§3.1 step 9) for a validated result."""
    items = [to_new_item(item, position) for position, item in enumerate(result.items)]
    return policy.select(items)


# ---------------------------------------------------------------------------
# POST /meals/analyze
# ---------------------------------------------------------------------------


def analyze(db: Client, user: AuthenticatedUser, body: AnalyzeMealRequest) -> Meal:
    settings = get_settings()
    text = (body.text_input or "").strip() or None
    photo_path = _validate_photo_path(user, body.photo_path) if body.photo_path else None
    if not text and not photo_path:
        raise AppError(ErrorCode.INPUT_REQUIRED)

    profile = repository.get_profile(db, user.id)
    eaten_at = body.eaten_at or datetime.now(UTC)
    local_dt = eaten_at.astimezone(repository.zone(profile.timezone))
    meal_type = body.meal_type or infer_meal_type(local_dt)
    model = settings.resolve_model(profile.analysis_model)

    meal_id = repository.create_meal(
        db,
        user.id,
        meal_type=meal_type.value,
        eaten_at=eaten_at,
        local_date=local_dt.date(),
        text_input=text,
        photo_path=photo_path,
        model_version=model,
        prompt_version=llm.ANALYZE_PROMPT_VERSION,
    )
    photo = _photo_input(db, photo_path)
    context = _context(None, eaten_at, profile.timezone, meal_type, profile.dietary_restrictions)

    try:
        result = with_semantic_retry(
            lambda feedback: llm.analyze_meal(
                model=model, photo=photo, text=text, context=context, feedback=feedback
            ),
            check_analysis,
        )
    except AppError as exc:
        _fail(db, meal_id, exc.message)
        exc.details = {
            **(exc.details if isinstance(exc.details, dict) else {}),
            "meal_id": str(meal_id),
        }
        raise

    if result.image is not None and not result.image.is_food:
        reason = result.image.note or NOT_FOOD_MESSAGE
        repository.update_meal(
            db,
            meal_id,
            {
                "status": MealStatus.failed.value,
                "failure_reason": reason,
                "analysis_raw": result.model_dump(mode="json"),
            },
        )
        raise AppError(ErrorCode.IMAGE_NOT_FOOD, reason, details={"meal_id": str(meal_id)})

    try:
        items = build_draft_items(result)
        repository.add_items(db, user.id, meal_id, items)
        repository.update_meal(
            db,
            meal_id,
            {
                "status": MealStatus.draft.value,
                "image_issues": list(result.image.issues) if result.image else [],
                "analysis_raw": result.model_dump(mode="json"),
            },
        )
    except Exception:
        _fail(db, meal_id, "The analysis could not be saved.")
        raise
    return repository.load_meal(db, meal_id)


def _fail(db: Client, meal_id: UUID, reason: str) -> None:
    try:
        repository.update_meal(
            db, meal_id, {"status": MealStatus.failed.value, "failure_reason": reason}
        )
    except Exception:  # never hide the original error
        logger.exception("could not mark meal as failed")


# ---------------------------------------------------------------------------
# Single-item estimation (§3.6) — also used by M2
# ---------------------------------------------------------------------------


def _current_item_snapshot(item: ItemRecord) -> dict[str, Any]:
    return {
        "name": item.name,
        "kind": item.kind.value,
        "preparation": item.preparation,
        "portion": item.portion.model_dump(),
        "nutrition": item.nutrition.model_dump(),
    }


def _estimate(
    db: Client,
    meal: MealRecord,
    *,
    name: str | None,
    preparation: str | None,
    note: str | None,
    current: ItemRecord | None,
    portion: Portion | None,
    use_photo: bool,
) -> LLMItem:
    settings = get_settings()
    profile = repository.get_profile(db, meal.user_id)
    model = settings.resolve_model(meal.model_version)  # the meal's original model (ADR-0006)
    photo = _photo_input(db, meal.photo_path) if use_photo else None
    context = _context(meal, meal.eaten_at, profile.timezone, None, profile.dietary_restrictions)
    return with_semantic_retry(
        lambda feedback: llm.estimate_item(
            model=model,
            name=name,
            preparation=preparation,
            note=note,
            current_item=_current_item_snapshot(current) if current else None,
            portion=portion.model_dump() if portion else None,
            photo=photo,
            context=context,
            feedback=feedback,
        ),
        lambda item: check_item(item),
    )


def reestimate_item(
    db: Client,
    user: AuthenticatedUser,
    meal: MealRecord,
    item: ItemRecord,
    *,
    name: str | None = None,
    preparation: str | None = None,
    note: str | None = None,
    source: ItemSource = ItemSource.user_edited,
    keep_attribute_ids: Sequence[UUID] = (),
) -> None:
    """Replace one item's values and uncertain attributes with a fresh estimate.

    `ai_original` is kept. Attributes in `keep_attribute_ids` (e.g. the one the user just
    answered with "Something else") are kept, and new attributes of the same kind are dropped.
    New attributes are review cues only (`asked = false`).
    """
    llm_item = _estimate(
        db,
        meal,
        name=name,
        preparation=preparation,
        note=note,
        current=item,
        portion=None,
        use_photo=True,
    )
    kept = [a for a in item.attributes if a.id in set(keep_attribute_ids)]
    kept_kinds = {a.attribute for a in kept}
    new_item = to_new_item(llm_item, item.position, source=source, keep_original=False)
    new_attributes = [a for a in new_item.attributes if a.attribute not in kept_kinds]
    rng = item_kcal_range(new_item.nutrition.kcal, new_attributes)

    repository.update_item(
        db,
        item.id,
        {
            "name": new_item.name,
            "kind": new_item.kind.value,
            "preparation": new_item.preparation,
            "portion_qty": new_item.portion.qty,
            "portion_unit": new_item.portion.unit,
            "portion_grams": new_item.portion.grams,
            "kcal": new_item.nutrition.kcal,
            "protein_g": new_item.nutrition.protein_g,
            "carbs_g": new_item.nutrition.carbs_g,
            "fat_g": new_item.nutrition.fat_g,
            "kcal_low": rng.low if rng else None,
            "kcal_high": rng.high if rng else None,
            "source": source.value,
        },
    )
    repository.replace_item_attributes(
        db, user.id, item.id, new_attributes, keep_ids=[a.id for a in kept]
    )


def estimate_new_item(
    db: Client, meal: MealRecord, *, name: str, portion: Portion | None, position: int
) -> NewItem:
    """Text-only estimate for a manually added item (M2 add item without nutrition)."""
    llm_item = _estimate(
        db,
        meal,
        name=name,
        preparation=None,
        note=None,
        current=None,
        portion=portion,
        use_photo=False,
    )
    new_item = to_new_item(llm_item, position, source=ItemSource.user_added, keep_original=False)
    new_item.name = name
    if portion is not None:
        new_item = _apply_stated_portion(new_item, portion)
    return new_item


def _apply_stated_portion(item: NewItem, portion: Portion) -> NewItem:
    """Keep the portion the user stated: scale the estimate linearly by grams and drop portion
    questions (the user already answered them)."""
    factor = portion.grams / item.portion.grams
    item = item.model_copy(deep=True)
    item.portion = portion
    item.nutrition = scale_nutrition(item.nutrition, factor)
    item.attributes = [a for a in item.attributes if a.attribute != AttributeKind.portion]
    for attr in item.attributes:
        for option in attr.options:
            option.nutrition = scale_nutrition(option.nutrition, factor)
        attr.impact_kcal = attr.impact_kcal * factor
    item.kcal_range = item_kcal_range(item.nutrition.kcal, item.attributes)
    return item


# ---------------------------------------------------------------------------
# POST /meals/{id}/items/{item_id}/reestimate
# ---------------------------------------------------------------------------


def reestimate(
    db: Client, user: AuthenticatedUser, meal_id: UUID, item_id: UUID, body: ReestimateItemRequest
) -> Meal:
    meal = repository.get_meal(db, meal_id)
    if meal.status not in (MealStatus.draft, MealStatus.confirmed):
        raise AppError(
            ErrorCode.MEAL_INVALID_STATE,
            "Only draft or confirmed meals can be re-estimated.",
            details={"meal_id": str(meal_id), "status": meal.status.value},
        )
    item = meal.item(item_id)
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "Item not found.", details={"item_id": str(item_id)})
    reestimate_item(
        db, user, meal, item, name=body.name, preparation=body.preparation, note=body.note
    )
    return repository.load_meal(db, meal_id)
