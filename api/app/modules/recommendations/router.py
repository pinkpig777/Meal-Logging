"""M5 endpoints (api-reference §7). Owner: Zach."""

from fastapi import APIRouter, Response, status

from app.core.auth import CurrentUser
from app.core.db import UserDb
from app.modules.recommendations import service
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
def post_chat(body: ChatRequest, _: CurrentUser) -> ChatResponse:
    """Grounded chat (scope TBD). Currently returns a placeholder reply."""
    return service.chat(body)
