"""Contract: every recorded AnalysisResult parses, passes the semantic checks, and is
internally consistent."""

import pytest

from app.modules.recognition.validation import check_analysis
from app.schemas import Nutrition
from app.services.llm import fixtures
from app.services.nutrition import energy_from_macros, nutrition_matches


@pytest.mark.parametrize("key", fixtures.all_analysis_keys())
def test_fixture_passes_checks_without_normalization(key: str) -> None:
    result = fixtures.load_analysis(key)
    outcome = check_analysis(result)
    assert outcome.ok, outcome.errors
    assert outcome.value == result  # nothing needed overwriting


@pytest.mark.parametrize("key", fixtures.all_analysis_keys())
def test_fixture_items_are_consistent(key: str) -> None:
    for item in fixtures.load_analysis(key).items:
        n = Nutrition(**item.nutrition.model_dump())
        if n.kcal >= 50:
            assert abs(energy_from_macros(n) - n.kcal) <= 0.25 * n.kcal, item.name
        for attr in item.uncertain_attributes:
            current = next(o for o in attr.options if o.id == attr.current_option_id)
            assert nutrition_matches(Nutrition(**current.nutrition.model_dump()), n)
            for option in attr.options:
                on = Nutrition(**option.nutrition.model_dump())
                if on.kcal >= 50:
                    assert abs(energy_from_macros(on) - on.kcal) <= 0.25 * on.kcal, option.id


def test_fixture_selection() -> None:
    assert fixtures.select_analysis_key(None, "Pasta with cream sauce") == "pasta_cream_sauce"
    assert fixtures.select_analysis_key(None, "chicken and rice") == "chicken_rice_broccoli"
    assert fixtures.select_analysis_key(None, "not food") == "not_food"
    assert fixtures.select_analysis_key("u/not_food.jpg", None) == "not_food"
    assert fixtures.select_analysis_key("u/123.jpg", "something else") == "chicken_burrito_bowl"


def test_not_food_fixture_has_no_items() -> None:
    result = fixtures.load_analysis("not_food")
    assert result.image is not None and not result.image.is_food
    assert result.items == []
