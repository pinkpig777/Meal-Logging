"""M5 bodies (api-reference §7). Owner: Zach."""

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Nutrition, SuggestionResponse


class SuggestionPattern(BaseModel):
    metric: str = Field(description='e.g. "protein_g"')
    summary: str


class SuggestionIdea(BaseModel):
    name: str
    description: str
    estimated_nutrition: Nutrition


class SuggestionEvidence(BaseModel):
    dates: list[date]
    meal_ids: list[UUID]
    observations: list[str]


class Suggestion(BaseModel):
    id: UUID
    pattern: SuggestionPattern
    title: str
    ideas: list[SuggestionIdea]
    evidence: SuggestionEvidence
    caveats: list[str]


class RecommendationsResponse(BaseModel):
    status: Literal["ok", "insufficient_history"]
    logged_day_count: int
    required_day_count: int
    suggestions: list[Suggestion]


class SuggestionFeedbackRequest(BaseModel):
    suggestion: dict[str, Any] = Field(description="Snapshot of the suggestion shown")
    response: SuggestionResponse


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class ChatReferences(BaseModel):
    meal_ids: list[UUID]
    dates: list[date]


class ChatResponse(BaseModel):
    message: ChatMessage
    references: ChatReferences
