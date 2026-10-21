"""M1 endpoints (api-reference §3). Owner: Charlie."""

from uuid import UUID

from fastapi import APIRouter, status

from app.core.auth import CurrentUser
from app.core.db import UserDb
from app.modules.recognition import service
from app.modules.recognition.schemas import (
    AnalysisModelsResponse,
    AnalyzeMealRequest,
    ReestimateItemRequest,
)
from app.schemas import Meal

router = APIRouter(tags=["recognition"])


@router.get("/config/models", response_model=AnalysisModelsResponse)
def list_analysis_models(_: CurrentUser) -> AnalysisModelsResponse:
    """Allowed analysis models (ADR-0006)."""
    return service.list_models()


@router.post("/meals/analyze", response_model=Meal, status_code=status.HTTP_201_CREATED)
def analyze_meal(body: AnalyzeMealRequest, user: CurrentUser, db: UserDb) -> Meal:
    """Photo and/or text → draft meal, with `asked` set by the clarification policy.

    On an LLM failure the meal is kept with `status: failed`; its id is in `error.details.meal_id`.
    """
    return service.analyze(db, user, body)


@router.post("/meals/{id}/items/{item_id}/reestimate", response_model=Meal)
def reestimate_item(
    id: UUID, item_id: UUID, body: ReestimateItemRequest, user: CurrentUser, db: UserDb
) -> Meal:
    """Re-estimate one item after an identity or preparation change."""
    return service.reestimate(db, user, id, item_id, body)
