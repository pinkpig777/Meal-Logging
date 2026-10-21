"""Meal contracts (api-reference §2). The frontend generates its types from these."""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import (
    AttributeKind,
    ImageIssue,
    ItemKind,
    ItemSource,
    MealStatus,
    MealType,
    ResolutionStatus,
)
from app.schemas.nutrition import KcalRange, Nutrition, NutritionTotals, Portion


class AttributeOption(BaseModel):
    id: str = Field(description='Stable within the attribute, e.g. "fried"')
    label: str
    nutrition: Nutrition = Field(description="The item's full estimate if this option is chosen")
    portion: Portion | None = Field(description='Set only for attribute = "portion"')


class AttributeResolution(BaseModel):
    option_id: str | None
    text: str | None


class UncertainAttribute(BaseModel):
    id: UUID
    attribute: AttributeKind
    reason: str
    question: str
    options: list[AttributeOption]
    current_option_id: str
    impact_kcal: float = Field(description="max - min kcal across options")
    asked: bool = Field(description="Selected by the clarification policy")
    status: ResolutionStatus
    resolution: AttributeResolution | None


class MealItem(BaseModel):
    id: UUID
    position: int
    kind: ItemKind
    name: str
    preparation: str | None
    portion: Portion
    nutrition: Nutrition
    kcal_range: KcalRange | None = Field(
        description="null when unresolved options do not spread meaningfully"
    )
    source: ItemSource
    uncertain_attributes: list[UncertainAttribute]
    ai_original: dict[str, Any] | None = Field(
        description="Immutable snapshot of the AI's first estimate"
    )


class Meal(BaseModel):
    id: UUID
    status: MealStatus
    meal_type: MealType
    eaten_at: datetime
    local_date: date
    text_input: str | None
    photo_url: str | None = Field(description="Short-lived signed URL")
    model_version: str | None
    image_issues: list[ImageIssue]
    failure_reason: str | None
    items: list[MealItem]
    totals: NutritionTotals
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None


class MealSummary(BaseModel):
    id: UUID
    status: MealStatus
    meal_type: MealType
    eaten_at: datetime
    local_date: date
    photo_url: str | None
    item_names: list[str]
    totals: NutritionTotals
