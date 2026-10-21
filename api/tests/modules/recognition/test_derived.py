from datetime import datetime

import pytest

from app.modules.recognition.service import build_draft_items, infer_meal_type
from app.modules.recognition.validation import to_new_item
from app.schemas import KcalRange, MealType, Nutrition
from app.services.llm import fixtures
from app.services.nutrition import impact_kcal, kcal_range, sum_totals


def test_impact_is_max_minus_min() -> None:
    assert impact_kcal([250, 390, 300]) == 140
    assert impact_kcal([]) == 0


def test_range_adds_most_negative_and_most_positive_deltas() -> None:
    rng = kcal_range(205, [[102.5, 205, 307.5, 410], [205, 260]])
    assert rng == KcalRange(low=102.5, high=465)


@pytest.mark.parametrize(
    ("current", "options", "expected_none"),
    [
        (200, [[200, 229]], True),  # spread 29 < 30 kcal
        (200, [[200, 230]], False),  # spread 30 = threshold
        (1000, [[1000, 1099]], True),  # spread 99 < 10% of 1000
        (1000, [[1000, 1100]], False),  # spread 100 = 10%
        (500, [], True),  # no unresolved attributes
    ],
)
def test_range_threshold(current: float, options: list[list[float]], expected_none: bool) -> None:
    assert (kcal_range(current, options) is None) is expected_none


def test_range_never_below_zero() -> None:
    rng = kcal_range(60, [[0, 60, 100]])
    assert rng is not None and rng.low == 0


def test_totals_use_kcal_for_items_without_range() -> None:
    totals = sum_totals(
        [
            (Nutrition(kcal=100, protein_g=1, carbs_g=2, fat_g=3), KcalRange(low=80, high=150)),
            (Nutrition(kcal=50, protein_g=1, carbs_g=1, fat_g=1), None),
        ]
    )
    assert (totals.kcal, totals.kcal_low, totals.kcal_high) == (150, 130, 200)
    assert totals.protein_g == 2


def test_new_item_derives_impact_and_range_from_fixture() -> None:
    rice = fixtures.load_analysis("chicken_rice_broccoli").items[1]
    new = to_new_item(rice, position=1)
    assert new.attributes[0].impact_kcal == pytest.approx(307.5)
    assert new.kcal_range == KcalRange(low=102.5, high=410)
    assert new.ai_original is not None and new.ai_original["name"] == "White rice"


def test_policy_asks_top_two_meaningful_attributes() -> None:
    items = build_draft_items(fixtures.load_analysis("chicken_burrito_bowl"))
    asked = [(i.name, a.attribute.value) for i in items for a in i.attributes if a.asked]
    assert asked == [("Chicken burrito bowl", "portion"), ("Chicken burrito bowl", "preparation")]
    sour_cream = items[1].attributes[0]
    assert sour_cream.asked is False  # stays a review cue


@pytest.mark.parametrize(
    ("hour", "minute", "expected"),
    [
        (7, 0, MealType.breakfast),
        (10, 29, MealType.breakfast),
        (12, 30, MealType.lunch),
        (15, 30, MealType.snack),
        (19, 0, MealType.dinner),
        (23, 0, MealType.snack),
    ],
)
def test_infer_meal_type(hour: int, minute: int, expected: MealType) -> None:
    assert infer_meal_type(datetime(2026, 10, 21, hour, minute)) == expected
