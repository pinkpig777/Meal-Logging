"""M5 endpoints (api-reference §7). Owner: Zach."""

from fastapi import APIRouter, Response, status

from app.core.auth import CurrentUser
from app.core.db import UserDb
from app.modules.recommendations import chat_service, service
from app.modules.recommendations.schemas import (
    ChatRequest,
    ChatResponse,
    RecommendationsResponse,
    SuggestionFeedbackRequest,
)

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsResponse)
def get_recommendations(user: CurrentUser, db: UserDb) -> RecommendationsResponse:
    """Current suggestions with evidence; `insufficient_history` below 3 logged days."""
    return service.get_recommendations(db, user.id)


@router.post(
    "/recommendations/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def post_recommendation_feedback(
    body: SuggestionFeedbackRequest, user: CurrentUser, db: UserDb
) -> Response:
    service.record_feedback(db, user.id, body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/chat", response_model=ChatResponse)
def post_chat(body: ChatRequest, user: CurrentUser, db: UserDb) -> ChatResponse:
    """Read-only chat about confirmed meals in the selected time window."""
    return chat_service.chat(db, user.id, body)
