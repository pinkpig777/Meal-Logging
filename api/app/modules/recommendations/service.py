"""M5 orchestration: verified patterns, personalized ideas, and feedback.

Only suggestion feedback is written here. Chat remains a separate, unfinished feature.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from supabase import Client

from app.core.config import get_settings
from app.modules.meals import repository
from app.modules.recommendations.generation import generate_ideas
from app.modules.recommendations.patterns import (
    LOOKBACK_DAYS,
    REQUIRED_DAY_COUNT,
    build_suggestions,
)
from app.modules.recommendations.schemas import (
    RecommendationsResponse,
    SuggestionFeedbackRequest,
)
from app.schemas import MealStatus
from app.services.llm.client import LLMError

logger = logging.getLogger(__name__)
FEEDBACK_COOLDOWN_DAYS = 7


def dismissed_metrics(db: Client, user_id: UUID) -> set[str]:
    """Latest feedback per metric wins, across evidence changes, for seven days."""
    cutoff = datetime.now(UTC) - timedelta(days=FEEDBACK_COOLDOWN_DAYS)
    result = (
        db.table("suggestion_feedback")
        .select("suggestion,response,created_at")
        .eq("user_id", str(user_id))
        .gte("created_at", cutoff.isoformat())
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )
    seen: set[str] = set()
    dismissed: set[str] = set()
    for row in result.data or []:
        if not isinstance(row, dict):
            continue
        snapshot = row.get("suggestion")
        if not isinstance(snapshot, dict):
            continue
        pattern = snapshot.get("pattern")
        metric = pattern.get("metric") if isinstance(pattern, dict) else None
        if not isinstance(metric, str) or metric in seen:
            continue
        seen.add(metric)
        if row.get("response") in ("not_for_me", "already_do"):
            dismissed.add(metric)
    return dismissed


def get_recommendations(db: Client, user_id: UUID) -> RecommendationsResponse:
    profile = repository.get_profile(db, user_id)
    today = repository.today_for(profile.timezone)
    # Use the previous fourteen calendar days. Do not treat today's breakfast as a full day.
    date_to = today - timedelta(days=1)
    date_from = today - timedelta(days=LOOKBACK_DAYS)
    rows = repository.list_daily_totals(db, user_id, date_from, date_to)
    response = RecommendationsResponse(
        status="insufficient_history" if len(rows) < REQUIRED_DAY_COUNT else "ok",
        logged_day_count=len(rows),
        required_day_count=REQUIRED_DAY_COUNT,
        suggestions=[],
    )
    if response.status == "insufficient_history":
        return response
    meals = repository.list_meals(db, user_id, date_from, date_to, MealStatus.confirmed)
    meal_ids_by_date: dict[str, list[UUID]] = {}
    for meal in meals:
        meal_ids_by_date.setdefault(meal.local_date.isoformat(), []).append(meal.id)
    candidates = build_suggestions(rows, meal_ids_by_date)
    if not candidates:
        return response
    dismissed = dismissed_metrics(db, user_id)
    candidates = [s for s in candidates if s.pattern.metric not in dismissed]
    if not candidates:
        return response
    current_goal = repository.effective_goal(repository.list_goals(db, user_id), today)
    suggestion = candidates[0]  # One clear pattern and two ideas, rather than a long feed.
    foods = list(dict.fromkeys(item.name[:100] for meal in meals for item in meal.items))[:30]
    try:
        generated = generate_ideas(
            suggestion,
            user_id=str(user_id),
            model=get_settings().resolve_model(profile.analysis_model),
            restrictions=profile.dietary_restrictions,
            foods=foods,
            current_goal=current_goal.model_dump(mode="json", exclude={"id"})
            if current_goal
            else None,
        )
        suggestion.ideas = generated.ideas
        if not generated.available:
            suggestion.caveats.append(
                "Personalized meal ideas are unavailable for this pattern or these restrictions."
            )
        elif get_settings().llm_mode == "fixture":
            suggestion.caveats.append("Demo meal ideas use recorded example estimates.")
    except LLMError:
        # Keep trustworthy evidence visible when idea generation fails. Never substitute
        # unrestricted generic foods or cache the failure as a successful generation.
        logger.info("M5 idea generation unavailable")
        suggestion.caveats.append("Meal ideas are temporarily unavailable. Try again later.")
    response.suggestions = [suggestion]
    return response


def record_feedback(db: Client, user_id: UUID, body: SuggestionFeedbackRequest) -> None:
    # suggestion_feedback is owned by M5 (not one of the M3-only tables).
    db.table("suggestion_feedback").insert(
        {"user_id": str(user_id), "suggestion": body.suggestion, "response": body.response.value}
    ).execute()
