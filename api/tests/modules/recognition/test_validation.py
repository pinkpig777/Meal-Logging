from app.modules.recognition.validation import check_analysis, check_item
from app.services.llm.schemas import (
    AnalysisResult,
    LLMImageAssessment,
    LLMItem,
    LLMNutrition,
    LLMOption,
    LLMPortion,
    LLMUncertainAttribute,
)


def nut(kcal: float, p: float, c: float, f: float) -> LLMNutrition:
    return LLMNutrition(kcal=kcal, protein_g=p, carbs_g=c, fat_g=f)


GRILLED = nut(250, 46, 0, 6)
FRIED = nut(390, 42, 12, 19)


def attr(
    current: str = "grilled", options: list[LLMOption] | None = None, kind: str = "preparation"
) -> LLMUncertainAttribute:
    return LLMUncertainAttribute(
        attribute=kind,  # type: ignore[arg-type]
        reason="Cooking method is unclear",
        question="How was it cooked?",
        options=options
        or [
            LLMOption(id="grilled", label="Grilled", nutrition=GRILLED, portion=None),
            LLMOption(id="fried", label="Fried", nutrition=FRIED, portion=None),
        ],
        current_option_id=current,
    )


def item(nutrition: LLMNutrition = GRILLED, attrs: list[LLMUncertainAttribute] | None = None):
    return LLMItem(
        name="Chicken",
        kind="dish",
        preparation="grilled",
        portion=LLMPortion(qty=1, unit="piece", grams=170),
        nutrition=nutrition,
        uncertain_attributes=attrs or [],
    )


def test_valid_item_passes() -> None:
    assert check_item(item(attrs=[attr()])).ok


def test_energy_inconsistency_is_an_error() -> None:
    outcome = check_item(item(nutrition=nut(500, 10, 10, 5)))
    assert not outcome.ok
    assert "within 25%" in outcome.errors[0]


def test_low_calorie_vegetable_within_absolute_allowance_passes() -> None:
    # Broccoli: 55 kcal stated, 4*4 + 4*11 + 9*1 = 69 kcal from macros (fiber inflates 4/4/9).
    assert check_item(item(nutrition=nut(55, 4, 11, 1))).ok


def test_energy_check_skipped_below_50_kcal() -> None:
    assert check_item(item(nutrition=nut(40, 0, 0, 0))).ok


def test_negative_values_and_zero_grams_are_errors() -> None:
    bad = item(nutrition=nut(-1, 0, 0, 0))
    assert not check_item(bad).ok
    zero = item()
    zero.portion.grams = 0
    assert not check_item(zero).ok


def test_unknown_current_option_is_an_error() -> None:
    assert "current_option_id" in " ".join(check_item(item(attrs=[attr(current="x")])).errors)


def test_option_count_and_unique_ids() -> None:
    one = [LLMOption(id="a", label="A", nutrition=GRILLED, portion=None)]
    assert not check_item(item(attrs=[attr(current="a", options=one)])).ok
    dupes = [
        LLMOption(id="grilled", label="A", nutrition=GRILLED, portion=None),
        LLMOption(id="grilled", label="B", nutrition=FRIED, portion=None),
    ]
    assert "unique" in " ".join(check_item(item(attrs=[attr(options=dupes)])).errors)


def test_portion_options_need_portion() -> None:
    outcome = check_item(item(attrs=[attr(kind="portion")]))
    assert "portion options must set portion" in " ".join(outcome.errors)


def test_current_option_mismatch_overwrites_item_values() -> None:
    outcome = check_item(item(nutrition=nut(300, 50, 5, 8), attrs=[attr()]))
    assert outcome.ok
    assert outcome.value.nutrition == GRILLED


def test_more_than_three_attributes_keeps_highest_impact() -> None:
    def opts(delta: float) -> list[LLMOption]:
        return [
            LLMOption(id="grilled", label="A", nutrition=GRILLED, portion=None),
            LLMOption(
                id="fried", label="B", nutrition=nut(250 + delta, 46, delta / 4, 6), portion=None
            ),
        ]

    attrs = [attr(options=opts(d)) for d in (40, 200, 80, 120)]
    outcome = check_item(item(attrs=attrs))
    impacts = [o.options[1].nutrition.kcal - 250 for o in outcome.value.uncertain_attributes]
    assert impacts == [200, 120, 80]


def test_food_without_items_is_an_error_but_not_food_is_fine() -> None:
    food = LLMImageAssessment(is_food=True, issues=[], note=None)
    assert not check_analysis(AnalysisResult(image=food, items=[])).ok
    assert not check_analysis(AnalysisResult(image=None, items=[])).ok
    not_food = LLMImageAssessment(is_food=False, issues=[], note="A keyboard")
    assert check_analysis(AnalysisResult(image=not_food, items=[])).ok


def test_too_many_items() -> None:
    result = AnalysisResult(image=None, items=[item() for _ in range(13)])
    assert "at most 12" in " ".join(check_analysis(result).errors)
