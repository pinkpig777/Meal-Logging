"""Pure item math: quick-reply answers and portion scaling."""

from uuid import uuid4

import pytest

from app.modules.clarification.service import choose_option, scale_item_portion
from app.modules.meals.schemas import AttributeRecord, ItemRecord
from app.schemas import (
    AttributeKind,
    AttributeOption,
    ItemKind,
    ItemSource,
    Nutrition,
    Portion,
    ResolutionStatus,
)


def n(kcal: float, p: float, c: float, f: float) -> Nutrition:
    return Nutrition(kcal=kcal, protein_g=p, carbs_g=c, fat_g=f)


def rice_item() -> ItemRecord:
    item_id = uuid4()
    portion = AttributeRecord(
        id=uuid4(),
        meal_item_id=item_id,
        attribute=AttributeKind.portion,
        reason="Scale is unclear",
        question="How much rice?",
        options=[
            AttributeOption(
                id="half",
                label="½ cup",
                nutrition=n(100, 2, 22, 0.2),
                portion=Portion(qty=0.5, unit="cup", grams=79),
            ),
            AttributeOption(
                id="one",
                label="1 cup",
                nutrition=n(200, 4, 44, 0.4),
                portion=Portion(qty=1, unit="cup", grams=158),
            ),
            AttributeOption(
                id="two",
                label="2 cups",
                nutrition=n(400, 8, 88, 0.8),
                portion=Portion(qty=2, unit="cup", grams=316),
            ),
        ],
        current_option_id="one",
        impact_kcal=300,
        asked=True,
        status=ResolutionStatus.unresolved,
    )
    prep = AttributeRecord(
        id=uuid4(),
        meal_item_id=item_id,
        attribute=AttributeKind.preparation,
        reason="Could be fried rice",
        question="Was it fried rice?",
        options=[
            AttributeOption(
                id="steamed", label="Steamed", nutrition=n(200, 4, 44, 0.4), portion=None
            ),
            AttributeOption(id="fried", label="Fried", nutrition=n(330, 6, 46, 13), portion=None),
        ],
        current_option_id="steamed",
        impact_kcal=130,
        asked=True,
        status=ResolutionStatus.unresolved,
    )
    return ItemRecord(
        id=item_id,
        meal_id=uuid4(),
        position=0,
        kind=ItemKind.dish,
        name="White rice",
        preparation="steamed",
        portion_qty=1,
        portion_unit="cup",
        portion_grams=158,
        kcal=200,
        protein_g=4,
        carbs_g=44,
        fat_g=0.4,
        kcal_low=100,
        kcal_high=530,
        source=ItemSource.ai,
        attributes=[portion, prep],
    )


def test_choosing_portion_option_copies_values_and_scales_other_options() -> None:
    item = rice_item()
    portion_attr = item.attributes[0]
    updated = choose_option(item, portion_attr.id, "two")
    assert updated.nutrition == n(400, 8, 88, 0.8)
    assert (updated.portion_qty, updated.portion_grams) == (2, 316)
    assert updated.source == ItemSource.ai_clarified
    answered = updated.attributes[0]
    assert answered.status == ResolutionStatus.answered
    assert answered.current_option_id == "two"
    assert answered.resolution is not None and answered.resolution.option_id == "two"
    fried = updated.attributes[1].options[1]
    assert fried.nutrition.kcal == pytest.approx(660)  # scaled ×2 with the portion
    assert updated.attributes[1].impact_kcal == pytest.approx(260)
    # Only the preparation attribute is still open: range 400 → 660.
    assert (updated.kcal_low, updated.kcal_high) == (pytest.approx(400), pytest.approx(660))
    assert item.kcal == 200  # input untouched


def test_choosing_preparation_rebases_portion_options() -> None:
    item = rice_item()
    updated = choose_option(item, item.attributes[1].id, "fried")
    assert updated.kcal == 330
    two_cups = updated.attributes[0].options[2]
    assert two_cups.nutrition.kcal == pytest.approx(330 * 316 / 158)


def test_unknown_option_is_a_validation_error() -> None:
    item = rice_item()
    with pytest.raises(Exception) as exc:
        choose_option(item, item.attributes[0].id, "nope")
    assert getattr(exc.value, "code", None) == "VALIDATION_ERROR"


def test_portion_edit_scales_nutrition_range_and_options_by_grams() -> None:
    item = rice_item()
    updated = scale_item_portion(item, Portion(qty=1.5, unit="cup", grams=237))
    factor = 237 / 158
    assert updated.kcal == pytest.approx(200 * factor)
    assert updated.protein_g == pytest.approx(4 * factor)
    assert updated.kcal_low == pytest.approx(100 * factor)
    assert updated.kcal_high == pytest.approx(530 * factor)
    assert updated.attributes[1].options[1].nutrition.kcal == pytest.approx(330 * factor)
    assert updated.attributes[0].options[0].nutrition.kcal == 100  # portion options unchanged
