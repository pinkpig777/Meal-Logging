"""M2 service: answer clarifications, edit drafts (and confirmed meals for M3), add items.

Answering a quick reply copies the option's precomputed values (no LLM call, ADR-0003).
"Something else" answers and adds without nutrition go through M1 estimation.
Owner: Clark.
"""

from collections.abc import Collection
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.auth import AuthenticatedUser
from app.core.errors import AppError, ErrorCode
from app.modules.clarification.schemas import (
    AddItemRequest,
    ClarifyRequest,
    ItemRemoveOp,
    MealEditRequest,
    NotSureAnswer,
    OptionAnswer,
)
from app.modules.meals import repository
from app.modules.meals.schemas import AttributeRecord, ItemRecord, MealRecord, NewItem
from app.modules.recognition import service as recognition_service
from app.schemas import (
    AttributeKind,
    AttributeResolution,
    ItemKind,
    ItemSource,
    Meal,
    MealStatus,
    Nutrition,
    Portion,
    ResolutionStatus,
)
from app.services.nutrition import impact_kcal, kcal_range, scale_nutrition

# ---------------------------------------------------------------------------
# Pure item math (unit-tested)
# ---------------------------------------------------------------------------


def _shift(n: Nutrition, delta: Nutrition) -> Nutrition:
    return Nutrition(
        kcal=max(0.0, n.kcal + delta.kcal),
        protein_g=max(0.0, n.protein_g + delta.protein_g),
        carbs_g=max(0.0, n.carbs_g + delta.carbs_g),
        fat_g=max(0.0, n.fat_g + delta.fat_g),
    )


def _set_nutrition(item: ItemRecord, n: Nutrition) -> None:
    item.kcal, item.protein_g, item.carbs_g, item.fat_g = n.kcal, n.protein_g, n.carbs_g, n.fat_g


def _refresh_impact(attr: AttributeRecord) -> None:
    attr.impact_kcal = impact_kcal([o.nutrition.kcal for o in attr.options])


def recompute_range(item: ItemRecord) -> None:
    """Range over attributes that are not answered (M1 §3.5; "not sure" stays open)."""
    open_attrs = [a for a in item.attributes if a.status != ResolutionStatus.answered]
    rng = kcal_range(item.kcal, [[o.nutrition.kcal for o in a.options] for a in open_attrs])
    item.kcal_low, item.kcal_high = (rng.low, rng.high) if rng else (None, None)


def choose_option(item: ItemRecord, attribute_id: UUID, option_id: str) -> ItemRecord:
    """Apply a quick-reply answer: copy the option's nutrition (and portion) into the item."""
    item = item.model_copy(deep=True)
    attr = next((a for a in item.attributes if a.id == attribute_id), None)
    if attr is None:
        raise AppError(ErrorCode.NOT_FOUND, "Question not found.")
    option = next((o for o in attr.options if o.id == option_id), None)
    if option is None:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "That answer is not one of the options.",
            details=[{"loc": ["body", "answer", "option_id"], "msg": "unknown option"}],
        )

    old = item.nutrition
    old_grams = item.portion_grams
    _set_nutrition(item, option.nutrition)
    if option.portion is not None:
        item.portion_qty, item.portion_unit = option.portion.qty, option.portion.unit
        item.portion_grams = option.portion.grams
    factor = item.portion_grams / old_grams
    delta = Nutrition.model_construct(
        kcal=item.kcal - old.kcal,
        protein_g=item.protein_g - old.protein_g,
        carbs_g=item.carbs_g - old.carbs_g,
        fat_g=item.fat_g - old.fat_g,
    )

    # Keep the other attributes' options "at the item's current state".
    # TODO(Clark): this is a linear approximation; decide whether some answers should
    # invalidate other questions instead.
    for other in item.attributes:
        if other.id == attr.id:
            continue
        for o in other.options:
            if other.attribute == AttributeKind.portion and o.portion is not None:
                o.nutrition = scale_nutrition(item.nutrition, o.portion.grams / item.portion_grams)
            elif attr.attribute == AttributeKind.portion:
                o.nutrition = scale_nutrition(o.nutrition, factor)
            else:
                o.nutrition = _shift(o.nutrition, delta)
        _refresh_impact(other)

    attr.current_option_id = option.id
    attr.status = ResolutionStatus.answered
    attr.resolution = AttributeResolution(option_id=option.id, text=None)
    item.source = ItemSource.ai_clarified
    recompute_range(item)
    return item


def scale_item_portion(item: ItemRecord, portion: Portion) -> ItemRecord:
    """Portion-only edit: scale nutrition, the range, and option nutrition by grams."""
    item = item.model_copy(deep=True)
    factor = portion.grams / item.portion_grams
    _set_nutrition(item, scale_nutrition(item.nutrition, factor))
    if item.kcal_low is not None and item.kcal_high is not None:
        item.kcal_low, item.kcal_high = item.kcal_low * factor, item.kcal_high * factor
    item.portion_qty, item.portion_unit, item.portion_grams = (
        portion.qty,
        portion.unit,
        portion.grams,
    )
    for attr in item.attributes:
        # TODO(Clark): decide whether a manual portion edit resolves an open portion question.
        if attr.attribute == AttributeKind.portion:
            continue
        for o in attr.options:
            o.nutrition = scale_nutrition(o.nutrition, factor)
        _refresh_impact(attr)
    return item


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _item_fields(item: ItemRecord) -> dict[str, Any]:
    return {
        "name": item.name,
        "preparation": item.preparation,
        "portion_qty": item.portion_qty,
        "portion_unit": item.portion_unit,
        "portion_grams": item.portion_grams,
        "kcal": item.kcal,
        "protein_g": item.protein_g,
        "carbs_g": item.carbs_g,
        "fat_g": item.fat_g,
        "kcal_low": item.kcal_low,
        "kcal_high": item.kcal_high,
        "source": item.source.value,
    }


def _save_item(db: Client, before: ItemRecord, after: ItemRecord) -> None:
    repository.update_item(db, after.id, _item_fields(after))
    old = {a.id: a for a in before.attributes}
    for attr in after.attributes:
        if old.get(attr.id) == attr:
            continue
        repository.update_attribute(
            db,
            attr.id,
            {
                "options": [o.model_dump(mode="json") for o in attr.options],
                "current_option_id": attr.current_option_id,
                "impact_kcal": attr.impact_kcal,
                "status": attr.status.value,
                "resolution": attr.resolution.model_dump() if attr.resolution else None,
            },
        )


def _require_status(meal: MealRecord, allowed: Collection[MealStatus], action: str) -> None:
    if meal.status not in allowed:
        raise AppError(
            ErrorCode.MEAL_INVALID_STATE,
            f"This meal is {meal.status.value} and cannot be {action}.",
            details={"meal_id": str(meal.id), "status": meal.status.value},
        )


def _require_item(meal: MealRecord, item_id: UUID) -> ItemRecord:
    item = meal.item(item_id)
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "Item not found.", details={"item_id": str(item_id)})
    return item


# ---------------------------------------------------------------------------
# POST /meals/{id}/clarify
# ---------------------------------------------------------------------------


def clarify(db: Client, user: AuthenticatedUser, meal_id: UUID, body: ClarifyRequest) -> Meal:
    meal = repository.get_meal(db, meal_id)
    _require_status(meal, {MealStatus.draft}, "clarified")
    item = next(
        (i for i in meal.items if any(a.id == body.attribute_id for a in i.attributes)), None
    )
    if item is None:
        raise AppError(
            ErrorCode.NOT_FOUND,
            "Question not found.",
            details={"attribute_id": str(body.attribute_id)},
        )
    attr = next(a for a in item.attributes if a.id == body.attribute_id)
    answer = body.answer

    if isinstance(answer, OptionAnswer):
        _save_item(db, item, choose_option(item, attr.id, answer.option_id))
    elif isinstance(answer, NotSureAnswer):
        # "Not sure" is not a confirmation: values unchanged, the review cue stays.
        repository.update_attribute(
            db, attr.id, {"status": ResolutionStatus.not_sure.value, "resolution": None}
        )
    else:
        repository.update_attribute(
            db,
            attr.id,
            {
                "status": ResolutionStatus.answered.value,
                "resolution": {"option_id": None, "text": answer.text},
            },
        )
        kwargs: dict[str, str] = {}
        if attr.attribute == AttributeKind.identity:
            kwargs["name"] = answer.text
        elif attr.attribute == AttributeKind.preparation:
            kwargs["preparation"] = answer.text
        else:
            kwargs["note"] = f"{attr.question} {answer.text}"
        recognition_service.reestimate_item(
            db,
            user,
            meal,
            item,
            source=ItemSource.ai_clarified,
            keep_attribute_ids=[attr.id],
            **kwargs,
        )
    return repository.load_meal(db, meal_id)


# ---------------------------------------------------------------------------
# PATCH /meals/{id}/draft  (and PATCH /meals/{id} for confirmed meals, via M3)
# ---------------------------------------------------------------------------


def edit_meal(
    db: Client,
    user: AuthenticatedUser,
    meal_id: UUID,
    body: MealEditRequest,
    allowed: Collection[MealStatus] = (MealStatus.draft,),
) -> Meal:
    meal = repository.get_meal(db, meal_id)
    _require_status(meal, allowed, "edited this way")

    meal_fields: dict[str, Any] = {}
    if body.meal_type is not None:
        meal_fields["meal_type"] = body.meal_type.value
    if body.eaten_at is not None:
        profile = repository.get_profile(db, user.id)
        meal_fields["eaten_at"] = body.eaten_at
        meal_fields["local_date"] = repository.local_date_for(body.eaten_at, profile.timezone)

    # Validate every op before writing anything.
    for op in body.items:
        _require_item(meal, op.id)

    for op in body.items:
        item = _require_item(meal, op.id)
        if isinstance(op, ItemRemoveOp):
            repository.delete_item(db, item.id)
            continue
        updated = item
        if op.nutrition is not None:
            # Nutrition provided: used as-is. The old range no longer applies.
            updated = item.model_copy(deep=True)
            _set_nutrition(updated, op.nutrition)
            updated.kcal_low = updated.kcal_high = None
            if op.portion is not None:
                updated.portion_qty, updated.portion_unit = op.portion.qty, op.portion.unit
                updated.portion_grams = op.portion.grams
        elif op.portion is not None:
            updated = scale_item_portion(item, op.portion)
        else:
            updated = item.model_copy(deep=True)
        # Name / preparation changes keep the values; the client offers a re-estimate.
        if op.name is not None:
            updated.name = op.name
        if op.preparation is not None:
            updated.preparation = op.preparation
        updated.source = ItemSource.user_edited
        _save_item(db, item, updated)

    repository.update_meal(db, meal.id, meal_fields)
    return repository.load_meal(db, meal_id)


# ---------------------------------------------------------------------------
# POST /meals/{id}/items
# ---------------------------------------------------------------------------


def add_item(db: Client, user: AuthenticatedUser, meal_id: UUID, body: AddItemRequest) -> Meal:
    meal = repository.get_meal(db, meal_id)
    _require_status(meal, {MealStatus.draft, MealStatus.confirmed}, "changed")
    position = max((i.position for i in meal.items), default=-1) + 1

    if body.nutrition is not None:
        if body.portion is None:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Add a portion when you enter nutrition values.",
                details=[{"loc": ["body", "portion"], "msg": "required when nutrition is set"}],
            )
        new_item = NewItem(
            position=position,
            kind=ItemKind.dish,
            name=body.name,
            preparation=None,
            portion=body.portion,
            nutrition=body.nutrition,
            kcal_range=None,
            source=ItemSource.user_added,
            ai_original=None,
        )
    else:
        new_item = recognition_service.estimate_new_item(
            db, meal, name=body.name, portion=body.portion, position=position
        )
    repository.add_items(db, user.id, meal.id, [new_item])
    return repository.load_meal(db, meal_id)
