from datetime import date
from uuid import uuid4

from app.modules.analytics.service import average_over_logged, day_series
from app.modules.meals.schemas import DailyTotalsRecord
from app.schemas import Goal


def row(day: date, kcal: float) -> DailyTotalsRecord:
    return DailyTotalsRecord(
        local_date=day,
        meal_count=2,
        kcal=kcal,
        protein_g=100,
        carbs_g=200,
        fat_g=60,
        kcal_low=kcal,
        kcal_high=kcal,
        goal_id=None,
        goal_effective_from=None,
        goal_kcal=None,
        goal_protein_g=None,
        goal_carbs_g=None,
        goal_fat_g=None,
    )


def goal(start: date, kcal: int) -> Goal:
    return Goal(id=uuid4(), effective_from=start, kcal=kcal, protein_g=100, carbs_g=200, fat_g=60)


def test_unlogged_days_are_null_not_zero() -> None:
    days = day_series([row(date(2026, 10, 20), 1800)], [], date(2026, 10, 19), date(2026, 10, 21))
    assert [d.logged for d in days] == [False, True, False]
    assert days[0].totals is None and days[0].meal_count == 0
    assert days[1].totals is not None and days[1].totals.kcal == 1800


def test_each_day_gets_its_effective_goal() -> None:
    goals = [goal(date(2026, 10, 1), 2200), goal(date(2026, 10, 20), 2000)]
    days = day_series([], goals, date(2026, 9, 30), date(2026, 10, 21))
    assert days[0].goal is None  # before the first goal
    assert days[1].goal is not None and days[1].goal.kcal == 2200
    assert days[-2].goal is not None and days[-2].goal.kcal == 2000


def test_averages_divide_by_logged_days() -> None:
    days = day_series(
        [row(date(2026, 10, 19), 1500), row(date(2026, 10, 21), 2500)],
        [],
        date(2026, 10, 19),
        date(2026, 10, 25),
    )
    averages = average_over_logged(days)
    assert len(days) == 7
    assert averages is not None and averages.kcal == 2000
    assert average_over_logged(day_series([], [], date(2026, 10, 19), date(2026, 10, 25))) is None
