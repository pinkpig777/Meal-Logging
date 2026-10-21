"""Shared enums and the error envelope (api-reference §2, api-conventions §4)."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class MealStatus(StrEnum):
    analyzing = "analyzing"
    draft = "draft"
    confirmed = "confirmed"
    failed = "failed"


class MealType(StrEnum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class ItemKind(StrEnum):
    dish = "dish"
    addon = "addon"


class ItemSource(StrEnum):
    ai = "ai"
    ai_clarified = "ai_clarified"
    user_edited = "user_edited"
    user_added = "user_added"


class AttributeKind(StrEnum):
    identity = "identity"
    portion = "portion"
    preparation = "preparation"
    ingredient = "ingredient"


class ResolutionStatus(StrEnum):
    unresolved = "unresolved"
    answered = "answered"
    not_sure = "not_sure"


class ImageIssue(StrEnum):
    blurry = "blurry"
    dark = "dark"
    partial = "partial"
    multiple_meals = "multiple_meals"
    obstructed = "obstructed"


class SuggestionResponse(StrEnum):
    useful = "useful"
    not_for_me = "not_for_me"
    already_do = "already_do"


class ErrorBody(BaseModel):
    code: str = Field(description="Stable UPPER_SNAKE_CASE code; clients branch on it")
    message: str = Field(description="Human-readable sentence, safe to show the user")
    details: Any
    request_id: str | None


class ErrorResponse(BaseModel):
    error: ErrorBody
