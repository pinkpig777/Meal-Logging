from datetime import date
from uuid import uuid4

from app.modules.meals.schemas import DailyTotalsRecord
from app.modules.recommendations.service import build_suggestions


def row(day: int, protein: float) -> DailyTotalsRecord:
    return DailyTotalsRecord(
        local_date=date(2026, 10, day),
        meal_count=3,
        kcal=2000,
        protein_g=protein,
        carbs_g=250,
        fat_g=70,
        kcal_low=2000,
        kcal_high=2000,
        goal_id=uuid4(),
        goal_effective_from=date(2026, 10, 1),
        goal_kcal=2000,
        goal_protein_g=130,
        goal_carbs_g=220,
        goal_fat_g=65,
    )


def test_protein_gap_suggestion_has_evidence() -> None:
    meal_id = uuid4()
    rows = [row(15, 80), row(16, 90), row(17, 125)]
    (suggestion,) = build_suggestions(rows, {"2026-10-15": [meal_id]})
    assert suggestion.pattern.metric == "protein_g"
    assert "2 of your 3 logged days" in suggestion.pattern.summary
    assert suggestion.evidence.dates == [date(2026, 10, 15), date(2026, 10, 16)]
    assert suggestion.evidence.meal_ids == [meal_id]
    assert "Based only on days you logged." in suggestion.caveats


def test_no_suggestion_when_protein_is_on_track() -> None:
    assert build_suggestions([row(15, 125), row(16, 128), row(17, 80)], {}) == []
