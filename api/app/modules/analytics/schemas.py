"""M4 response bodies (api-reference §6). The M4 owner may change these in the M4 design doc."""

from datetime import date

from pydantic import BaseModel, Field

from app.schemas import Goal, MealSummary, Nutrition, NutritionTotals


class DayPoint(BaseModel):
    date: date
    logged: bool = Field(description="false → totals is null (unknown, not zero)")
    meal_count: int
    totals: NutritionTotals | None
    goal: Goal | None = Field(description="Effective goal for that date")


class MealContribution(MealSummary):
    share: Nutrition = Field(description="Fraction of the day's total for each metric, 0–1")


class DailyAnalytics(BaseModel):
    date: date
    logged: bool
    goal: Goal | None
    totals: NutritionTotals | None
    meals: list[MealContribution]


class WeeklyAnalytics(BaseModel):
    start: date
    end: date
    days: list[DayPoint] = Field(description="Always 7 entries, one per date")
    logged_day_count: int
    averages: Nutrition | None = Field(description="Averages over logged days only")


class HistoryAnalytics(BaseModel):
    days: list[DayPoint]
