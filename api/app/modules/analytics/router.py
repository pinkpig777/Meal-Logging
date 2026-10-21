"""M4 endpoints (api-reference §6). Owner: Xiaochuan."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import CurrentUser
from app.core.db import UserDb
from app.modules.analytics import service
from app.modules.analytics.schemas import DailyAnalytics, HistoryAnalytics, WeeklyAnalytics
from app.modules.meals import repository

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/daily", response_model=DailyAnalytics)
def get_daily_analytics(
    user: CurrentUser, db: UserDb, day: Annotated[date | None, Query(alias="date")] = None
) -> DailyAnalytics:
    """One day: totals vs. goal and each meal's contribution (default: today)."""
    return service.daily(db, user.id, day)


@router.get("/weekly", response_model=WeeklyAnalytics)
def get_weekly_analytics(
    user: CurrentUser, db: UserDb, start: date | None = None
) -> WeeklyAnalytics:
    """Seven days from `start` (default: Monday of the current week); unlogged days are null."""
    return service.weekly(db, user.id, start)


@router.get("/history", response_model=HistoryAnalytics)
def get_history_analytics(
    user: CurrentUser,
    db: UserDb,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
) -> HistoryAnalytics:
    """Day series over a date range (at most 92 days)."""
    repository.check_date_range(date_from, date_to)
    return service.history(db, user.id, date_from, date_to)
