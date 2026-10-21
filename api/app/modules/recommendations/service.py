"""M5 service: suggestions grounded in logged days, feedback, chat.

Owner: Zach.
TODO(Zach): replace the rule-based placeholder with the M5 design (LLM-generated ideas via
`app.services.llm.client.structured`, more patterns, wording rules, evaluation).
"""

from datetime import timedelta
from uuid import UUID, uuid5

from supabase import Client

from app.modules.meals import repository
from app.modules.meals.schemas import DailyTotalsRecord
from app.modules.recommendations.schemas import (
    ChatMessage,
    ChatReferences,
    ChatRequest,
    ChatResponse,
    RecommendationsResponse,
    Suggestion,
    SuggestionEvidence,
    SuggestionFeedbackRequest,
    SuggestionIdea,
    SuggestionPattern,
)
from app.schemas import MealStatus, Nutrition

REQUIRED_DAY_COUNT = 3
LOOKBACK_DAYS = 14
PROTEIN_GAP_G = 30.0
_SUGGESTION_NAMESPACE = UUID("5b1d3c9e-0f7a-4c55-9a51-6f3f2b8f9d10")

CAVEATS = ["Based only on days you logged.", "Nutrition values are estimates."]


def protein_gap_days(rows: list[DailyTotalsRecord]) -> list[DailyTotalsRecord]:
    return [
        r
        for r in rows
        if r.goal_protein_g is not None and r.goal_protein_g - r.protein_g >= PROTEIN_GAP_G
    ]


def build_suggestions(
    rows: list[DailyTotalsRecord], meal_ids_by_date: dict[str, list[UUID]]
) -> list[Suggestion]:
    """Rule-based placeholder: protein below goal by >= 30 g on at least half the logged days."""
    suggestions: list[Suggestion] = []
    low = protein_gap_days(rows)
    if rows and len(low) * 2 >= len(rows):
        dates = [r.local_date for r in low]
        summary = (
            f"On {len(low)} of your {len(rows)} logged days, protein was below your goal by "
            f"{PROTEIN_GAP_G:.0f} g or more."
        )
        suggestions.append(
            Suggestion(
                id=uuid5(_SUGGESTION_NAMESPACE, "protein_g:" + ",".join(map(str, dates))),
                pattern=SuggestionPattern(metric="protein_g", summary=summary),
                title="Add a protein-forward snack",
                ideas=[
                    SuggestionIdea(
                        name="Greek yogurt with berries",
                        description="A cup of plain Greek yogurt topped with a handful of berries.",
                        estimated_nutrition=Nutrition(kcal=180, protein_g=17, carbs_g=20, fat_g=3),
                    ),
                    SuggestionIdea(
                        name="Hard-boiled eggs",
                        description="Two eggs, easy to prepare ahead for busy days.",
                        estimated_nutrition=Nutrition(kcal=155, protein_g=13, carbs_g=1, fat_g=11),
                    ),
                ],
                evidence=SuggestionEvidence(
                    dates=dates,
                    meal_ids=[m for d in dates for m in meal_ids_by_date.get(d.isoformat(), [])],
                    observations=[
                        f"{r.local_date.isoformat()}: {r.protein_g:.0f} g protein "
                        f"(goal {r.goal_protein_g:.0f} g)"
                        for r in low
                    ],
                ),
                caveats=CAVEATS,
            )
        )
    return suggestions


def get_recommendations(db: Client, user_id: UUID) -> RecommendationsResponse:
    today = repository.today_for(repository.get_profile(db, user_id).timezone)
    date_from = today - timedelta(days=LOOKBACK_DAYS - 1)
    rows = repository.list_daily_totals(db, user_id, date_from, today)
    if len(rows) < REQUIRED_DAY_COUNT:
        return RecommendationsResponse(
            status="insufficient_history",
            logged_day_count=len(rows),
            required_day_count=REQUIRED_DAY_COUNT,
            suggestions=[],
        )
    meals = repository.list_meals(db, user_id, date_from, today, MealStatus.confirmed)
    meal_ids_by_date: dict[str, list[UUID]] = {}
    for meal in meals:
        meal_ids_by_date.setdefault(meal.local_date.isoformat(), []).append(meal.id)
    return RecommendationsResponse(
        status="ok",
        logged_day_count=len(rows),
        required_day_count=REQUIRED_DAY_COUNT,
        suggestions=build_suggestions(rows, meal_ids_by_date),
    )


def record_feedback(db: Client, user_id: UUID, body: SuggestionFeedbackRequest) -> None:
    # suggestion_feedback is owned by M5 (not one of the M3-only tables).
    db.table("suggestion_feedback").insert(
        {"user_id": str(user_id), "suggestion": body.suggestion, "response": body.response.value}
    ).execute()


def chat(body: ChatRequest) -> ChatResponse:
    # TODO(Zach): grounded chat (scope TBD in the M5 design doc). Canned reply for now.
    return ChatResponse(
        message=ChatMessage(
            role="assistant",
            content="Chat isn't available yet. Check the Suggestions tab for ideas based on "
            "the days you logged.",
        ),
        references=ChatReferences(meal_ids=[], dates=[]),
    )
