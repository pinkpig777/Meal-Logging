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


def test_each_pattern_requires_three_days_with_a_positive_goal() -> None:
    assert build_suggestions([row(15, 10), row(16, 10)], {}) == []
    rows = [row(15, 10), row(16, 10), row(17, 10)]
    rows[0].goal_protein_g = None
    assert build_suggestions(rows, {}) == []
    rows[0].goal_protein_g = 0
    assert build_suggestions(rows, {}) == []


def test_three_goal_days_are_enough_even_with_other_goalless_days() -> None:
    rows = [row(15, 80), row(16, 80), row(17, 120), row(18, 0)]
    rows[-1].goal_protein_g = None
    (suggestion,) = build_suggestions(rows, {})
    assert "2 of your 3 logged days with a protein goal" in suggestion.pattern.summary
    assert date(2026, 10, 18) not in suggestion.evidence.dates


def test_historical_goals_and_relative_threshold_are_used() -> None:
    rows = [row(15, 100), row(16, 100), row(17, 100)]
    assert len(build_suggestions(rows, {})) == 1  # inclusive 30 g threshold
    for r in rows:
        r.goal_protein_g = 110
    assert build_suggestions(rows, {}) == []
    for r in rows:
        r.goal_protein_g = 300
        r.protein_g = 260  # 40 g, but less than 20% of this target
    assert build_suggestions(rows, {}) == []
    rows[0].goal_protein_g = 130
    rows[0].protein_g = 100
    rows[1].protein_g = 200
    assert build_suggestions(rows, {})[0].evidence.dates == [date(2026, 10, 15), date(2026, 10, 16)]


def test_carbs_fat_and_calorie_patterns_are_detected() -> None:
    rows = [row(15, 130), row(16, 130), row(17, 130)]
    for r in rows:
        r.carbs_g = 100
        r.fat_g = 100
        r.kcal = 2500
    suggestions = build_suggestions(rows, {})
    assert {s.pattern.metric for s in suggestions} == {"carbs_g", "fat_g", "kcal"}
    assert "below" in next(s for s in suggestions if s.pattern.metric == "carbs_g").pattern.summary
    assert all("above" in s.pattern.summary for s in suggestions if s.pattern.metric != "carbs_g")


def test_ranking_and_identity_are_stable_and_evidence_changes_invalidate_id() -> None:
    rows = [row(15, 80), row(16, 90), row(17, 125)]
    rows[0].carbs_g = rows[1].carbs_g = rows[2].carbs_g = 100
    first = build_suggestions(rows, {})
    assert first[0].pattern.metric == "carbs_g"  # 3/3 beats 2/3
    assert first == build_suggestions(list(reversed(rows)), {})
    rows[0].carbs_g = 110
    assert first[0].id != build_suggestions(rows, {})[0].id


def test_no_under_eating_claims_from_a_single_day_or_missing_dates() -> None:
    assert build_suggestions([row(1, 0)], {}) == []
    rows = [row(1, 0), row(15, 130), row(30, 130)]
    assert build_suggestions(rows, {}) == []  # missing calendar dates do not become zero
