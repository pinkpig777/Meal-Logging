"""Shared Pydantic contracts. Import from here: `from app.schemas import Meal, Nutrition`."""

from app.schemas.common import (
    AttributeKind,
    ErrorBody,
    ErrorResponse,
    ImageIssue,
    ItemKind,
    ItemSource,
    MealStatus,
    MealType,
    ResolutionStatus,
    SuggestionResponse,
)
from app.schemas.goal import Goal
from app.schemas.meal import (
    AttributeOption,
    AttributeResolution,
    Meal,
    MealItem,
    MealSummary,
    UncertainAttribute,
)
from app.schemas.nutrition import KcalRange, Nutrition, NutritionTotals, Portion
from app.schemas.profile import Profile

__all__ = [
    "AttributeKind",
    "AttributeOption",
    "AttributeResolution",
    "ErrorBody",
    "ErrorResponse",
    "Goal",
    "ImageIssue",
    "ItemKind",
    "ItemSource",
    "KcalRange",
    "Meal",
    "MealItem",
    "MealStatus",
    "MealSummary",
    "MealType",
    "Nutrition",
    "NutritionTotals",
    "Portion",
    "Profile",
    "ResolutionStatus",
    "SuggestionResponse",
    "UncertainAttribute",
]
