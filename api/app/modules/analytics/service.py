"""M4 service: day series from `daily_totals`, with unlogged days as null (ADR-0005).

Owner: Xiaochuan.
TODO(Xiaochuan): refine shapes/aggregations per the M4 design doc (e.g. macro shares,
per-meal-type breakdowns, range bands).
"""

from datetime import date, timedelta
from uuid import UUID

from supabase import Client

from app.modules.analytics.schemas import (
    DailyAnalytics,
    DayPoint,
    HistoryAnalytics,
    MealContribution,
    WeeklyAnalytics,
)
from app.modules.meals import repository
from app.modules.meals.schemas import DailyTotalsRecord
from app.schemas import Goal, MealStatus, Nutrition, NutritionTotals


def _totals(row: DailyTotalsRecord) -> NutritionTotals:
    return NutritionTotals(
        kcal=row.kcal,
        protein_g=row.protein_g,
        carbs_g=row.carbs_g,
        fat_g=row.fat_g,
        kcal_low=row.kcal_low,
        kcal_high=row.kcal_high,
    )


def day_series(
    rows: list[DailyTotalsRecord], goals: list[Goal], date_from: date, date_to: date
) -> list[DayPoint]:
    """One DayPoint per date in [date_from, date_to]. Missing dates are unlogged (null totals)."""
    by_date = {r.local_date: r for r in rows}
    days: list[DayPoint] = []
    current = date_from
    while current <= date_to:
        row = by_date.get(current)
        days.append(
            DayPoint(
                date=current,
                logged=row is not None,
                meal_count=row.meal_count if row else 0,
                totals=_totals(row) if row else None,
                goal=repository.effective_goal(goals, current),
            )
        )
        current += timedelta(days=1)
    return days


def average_over_logged(days: list[DayPoint]) -> Nutrition | None:
    """Averages divide by the number of logged days, not by 7 (ADR-0005)."""
    logged = [d.totals for d in days if d.totals is not None]
    if not logged:
        return None
    n = len(logged)
    return Nutrition(
        kcal=sum(t.kcal for t in logged) / n,
        protein_g=sum(t.protein_g for t in logged) / n,
        carbs_g=sum(t.carbs_g for t in logged) / n,
        fat_g=sum(t.fat_g for t in logged) / n,
    )


def _share(part: float, whole: float) -> float:
    return part / whole if whole > 0 else 0.0


def daily(db: Client, user_id: UUID, day: date | None) -> DailyAnalytics:
    profile = repository.get_profile(db, user_id)
    day = day or repository.today_for(profile.timezone)
    rows = repository.list_daily_totals(db, user_id, day, day)
    goals = repository.list_goals(db, user_id)
    point = day_series(rows, goals, day, day)[0]
    records = repository.list_meals(db, user_id, day, day, MealStatus.confirmed)
    urls = repository.create_photo_urls(db, [r.photo_path for r in records if r.photo_path])
    meals: list[MealContribution] = []
    for record in sorted(records, key=lambda r: r.eaten_at):
        summary = repository.to_summary(
            record, urls.get(record.photo_path) if record.photo_path else None
        )
        t = point.totals
        share = Nutrition(
            kcal=_share(summary.totals.kcal, t.kcal if t else 0),
            protein_g=_share(summary.totals.protein_g, t.protein_g if t else 0),
            carbs_g=_share(summary.totals.carbs_g, t.carbs_g if t else 0),
            fat_g=_share(summary.totals.fat_g, t.fat_g if t else 0),
        )
        meals.append(MealContribution(**summary.model_dump(), share=share))
    return DailyAnalytics(
        date=day, logged=point.logged, goal=point.goal, totals=point.totals, meals=meals
    )


def weekly(db: Client, user_id: UUID, start: date | None) -> WeeklyAnalytics:
    if start is None:
        today = repository.today_for(repository.get_profile(db, user_id).timezone)
        start = today - timedelta(days=today.weekday())  # Monday of the current week
    end = start + timedelta(days=6)
    days = day_series(
        repository.list_daily_totals(db, user_id, start, end),
        repository.list_goals(db, user_id),
        start,
        end,
    )
    return WeeklyAnalytics(
        start=start,
        end=end,
        days=days,
        logged_day_count=sum(1 for d in days if d.logged),
        averages=average_over_logged(days),
    )


def history(db: Client, user_id: UUID, date_from: date, date_to: date) -> HistoryAnalytics:
    days = day_series(
        repository.list_daily_totals(db, user_id, date_from, date_to),
        repository.list_goals(db, user_id),
        date_from,
        date_to,
    )
    return HistoryAnalytics(days=days)
