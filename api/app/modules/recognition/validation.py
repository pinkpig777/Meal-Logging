"""Semantic checks and derived values for LLM output (M1 design §3.4–3.5).

`check_analysis` / `check_item` return a normalized copy plus a list of errors. Any error means
"retry once with the errors appended to the prompt". Normalizations (no retry) are:

- current option's nutrition differs from the item's by > 5% → item values overwritten
- more than 3 attributes on an item → keep the 3 with the highest impact_kcal
"""

from dataclasses import dataclass, field

from app.modules.meals.schemas import NewAttribute, NewItem
from app.schemas import (
    AttributeKind,
    AttributeOption,
    ItemKind,
    ItemSource,
    KcalRange,
    Nutrition,
    Portion,
)
from app.services.llm.schemas import (
    AnalysisResult,
    LLMItem,
    LLMNutrition,
    LLMOption,
    LLMUncertainAttribute,
)
from app.services.nutrition import (
    energy_from_macros,
    impact_kcal,
    is_energy_consistent,
    kcal_range,
    nutrition_matches,
)

MAX_ITEMS = 12
MAX_ATTRIBUTES_PER_ITEM = 3
MIN_OPTIONS, MAX_OPTIONS = 2, 4


@dataclass
class CheckOutcome[T]:
    value: T
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def _nutrition(n: LLMNutrition) -> Nutrition:
    return Nutrition(kcal=n.kcal, protein_g=n.protein_g, carbs_g=n.carbs_g, fat_g=n.fat_g)


def _negative(n: LLMNutrition) -> bool:
    return min(n.kcal, n.protein_g, n.carbs_g, n.fat_g) < 0


def attribute_impact(attr: LLMUncertainAttribute) -> float:
    return impact_kcal([o.nutrition.kcal for o in attr.options])


def _check_attribute(label: str, attr: LLMUncertainAttribute) -> list[str]:
    errors: list[str] = []
    ids = [o.id for o in attr.options]
    if not MIN_OPTIONS <= len(ids) <= MAX_OPTIONS:
        errors.append(f"{label}: must have 2-4 options (got {len(ids)}).")
    if len(set(ids)) != len(ids):
        errors.append(f"{label}: option ids must be unique.")
    if attr.current_option_id not in ids:
        errors.append(f"{label}: current_option_id {attr.current_option_id!r} is not an option id.")
    for option in attr.options:
        if _negative(option.nutrition):
            errors.append(f"{label}, option {option.id!r}: nutrition values must be >= 0.")
        if attr.attribute == "portion":
            if option.portion is None:
                errors.append(f"{label}, option {option.id!r}: portion options must set portion.")
            elif option.portion.grams <= 0:
                errors.append(f"{label}, option {option.id!r}: portion grams must be > 0.")
    return errors


def check_item(item: LLMItem, label: str = "item") -> CheckOutcome[LLMItem]:
    """Validate one item; returns a normalized copy."""
    item = item.model_copy(deep=True)
    errors: list[str] = []
    if item.portion.grams <= 0:
        errors.append(f"{label} ({item.name}): portion grams must be > 0.")
    if _negative(item.nutrition):
        errors.append(f"{label} ({item.name}): nutrition values must be >= 0.")
    elif not is_energy_consistent(_nutrition(item.nutrition)):
        macro_kcal = energy_from_macros(_nutrition(item.nutrition))
        errors.append(
            f"{label} ({item.name}): 4*protein + 4*carbs + 9*fat = {macro_kcal:.0f} kcal is not "
            f"within 25% (or 20 kcal) of kcal = {item.nutrition.kcal:.0f}."
        )

    attr_errors: list[str] = []
    for a_index, attr in enumerate(item.uncertain_attributes):
        attr_errors += _check_attribute(f"{label} ({item.name}) attribute {a_index}", attr)
    errors += attr_errors

    if not attr_errors:
        # Keep the 3 most impactful attributes.
        if len(item.uncertain_attributes) > MAX_ATTRIBUTES_PER_ITEM:
            item.uncertain_attributes = sorted(
                item.uncertain_attributes, key=attribute_impact, reverse=True
            )[:MAX_ATTRIBUTES_PER_ITEM]
        # The current option's values win when they disagree with the item's.
        for attr in item.uncertain_attributes:
            current = next(o for o in attr.options if o.id == attr.current_option_id)
            if not nutrition_matches(_nutrition(current.nutrition), _nutrition(item.nutrition)):
                item.nutrition = current.nutrition.model_copy()
            if attr.attribute == "portion" and current.portion is not None:
                item.portion = current.portion.model_copy()
    return CheckOutcome(item, errors)


def check_analysis(result: AnalysisResult) -> CheckOutcome[AnalysisResult]:
    result = result.model_copy(deep=True)
    errors: list[str] = []
    expects_food = result.image is None or result.image.is_food
    if expects_food:
        if not result.items:
            errors.append("The meal shows food but no items were returned (need 1-12 items).")
        elif len(result.items) > MAX_ITEMS:
            errors.append(f"Too many items ({len(result.items)}); return at most {MAX_ITEMS}.")
    normalized: list[LLMItem] = []
    for index, item in enumerate(result.items):
        outcome = check_item(item, f"item {index}")
        errors += outcome.errors
        normalized.append(outcome.value)
    result.items = normalized
    return CheckOutcome(result, errors)


# ---------------------------------------------------------------------------
# Derived values (§3.5) and conversion to repository write models
# ---------------------------------------------------------------------------


def to_option(o: LLMOption) -> AttributeOption:
    return AttributeOption(
        id=o.id,
        label=o.label,
        nutrition=_nutrition(o.nutrition),
        portion=Portion(qty=o.portion.qty, unit=o.portion.unit, grams=o.portion.grams)
        if o.portion
        else None,
    )


def item_kcal_range(current_kcal: float, attributes: list[NewAttribute]) -> KcalRange | None:
    """Range over attributes that are not answered (unresolved or "not sure")."""
    open_attrs = [a for a in attributes if a.status != "answered"]
    return kcal_range(current_kcal, [[o.nutrition.kcal for o in a.options] for a in open_attrs])


def to_new_item(
    item: LLMItem, position: int, source: ItemSource = ItemSource.ai, keep_original: bool = True
) -> NewItem:
    """Convert a validated LLM item to a repository write model with derived values."""
    attributes = [
        NewAttribute(
            attribute=AttributeKind(a.attribute),
            reason=a.reason,
            question=a.question,
            options=[to_option(o) for o in a.options],
            current_option_id=a.current_option_id,
            impact_kcal=attribute_impact(a),
        )
        for a in item.uncertain_attributes
    ]
    nutrition = _nutrition(item.nutrition)
    return NewItem(
        position=position,
        kind=ItemKind(item.kind),
        name=item.name,
        preparation=item.preparation,
        portion=Portion(qty=item.portion.qty, unit=item.portion.unit, grams=item.portion.grams),
        nutrition=nutrition,
        kcal_range=item_kcal_range(nutrition.kcal, attributes),
        source=source,
        ai_original=item.model_dump(mode="json") if keep_original else None,
        attributes=attributes,
    )
