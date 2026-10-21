"""M3 schemas: request/response bodies for /meals, /goals, /me, plus the internal row records
the repository returns to other modules.

Records (`MealRecord`, `ItemRecord`, `AttributeRecord`) mirror the database rows. They are
internal: API responses use the shared contracts in `app/schemas` (built by
`repository.to_meal` / `repository.to_summary`).
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field

from app.schemas import (
    AttributeKind,
    AttributeOption,
    AttributeResolution,
    Goal,
    ImageIssue,
    ItemKind,
    ItemSource,
    KcalRange,
    MealStatus,
    MealSummary,
    MealType,
    Nutrition,
    Portion,
    ResolutionStatus,
)

# ---------------------------------------------------------------------------
# Internal records (database rows)
# ---------------------------------------------------------------------------


class AttributeRecord(BaseModel):
    id: UUID
    meal_item_id: UUID
    attribute: AttributeKind
    reason: str
    question: str
    options: list[AttributeOption]
    current_option_id: str
    impact_kcal: float
    asked: bool
    status: ResolutionStatus
    resolution: AttributeResolution | None = None


class ItemRecord(BaseModel):
    id: UUID
    meal_id: UUID
    position: int
    kind: ItemKind
    name: str
    preparation: str | None
    portion_qty: float
    portion_unit: str
    portion_grams: float
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    kcal_low: float | None
    kcal_high: float | None
    source: ItemSource
    ai_original: dict[str, Any] | None = None
    attributes: list[AttributeRecord] = Field(
        default_factory=list,
        validation_alias=AliasChoices("uncertain_attributes", "attributes"),
    )

    @property
    def nutrition(self) -> Nutrition:
        return Nutrition(
            kcal=self.kcal, protein_g=self.protein_g, carbs_g=self.carbs_g, fat_g=self.fat_g
        )

    @property
    def portion(self) -> Portion:
        return Portion(qty=self.portion_qty, unit=self.portion_unit, grams=self.portion_grams)

    @property
    def kcal_range(self) -> KcalRange | None:
        if self.kcal_low is None or self.kcal_high is None:
            return None
        return KcalRange(low=self.kcal_low, high=self.kcal_high)


class MealRecord(BaseModel):
    id: UUID
    user_id: UUID
    status: MealStatus
    meal_type: MealType
    eaten_at: datetime
    local_date: date
    text_input: str | None
    photo_path: str | None
    image_issues: list[ImageIssue] = Field(default_factory=list)
    model_version: str | None = None
    prompt_version: str | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None = None
    items: list[ItemRecord] = Field(
        default_factory=list, validation_alias=AliasChoices("meal_items", "items")
    )

    def item(self, item_id: UUID) -> ItemRecord | None:
        return next((i for i in self.items if i.id == item_id), None)


class ProfileRecord(BaseModel):
    id: UUID
    display_name: str | None
    timezone: str
    dietary_restrictions: list[str]
    analysis_model: str | None


class DailyTotalsRecord(BaseModel):
    """One row of the `daily_totals` view (confirmed meals only)."""

    local_date: date
    meal_count: int
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    kcal_low: float
    kcal_high: float
    goal_id: UUID | None
    goal_effective_from: date | None
    goal_kcal: int | None
    goal_protein_g: float | None
    goal_carbs_g: float | None
    goal_fat_g: float | None


# ---------------------------------------------------------------------------
# Write models (used by M1 / M2 through the repository)
# ---------------------------------------------------------------------------


class NewAttribute(BaseModel):
    attribute: AttributeKind
    reason: str
    question: str
    options: list[AttributeOption]
    current_option_id: str
    impact_kcal: float
    asked: bool = False
    status: ResolutionStatus = ResolutionStatus.unresolved
    resolution: AttributeResolution | None = None


class NewItem(BaseModel):
    position: int
    kind: ItemKind
    name: str
    preparation: str | None
    portion: Portion
    nutrition: Nutrition
    kcal_range: KcalRange | None
    source: ItemSource
    ai_original: dict[str, Any] | None
    attributes: list[NewAttribute] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# API bodies (M3 endpoints)
# ---------------------------------------------------------------------------


class MealListResponse(BaseModel):
    meals: list[MealSummary]


class GoalCreate(BaseModel):
    kcal: int = Field(gt=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    effective_from: date | None = Field(
        default=None, description="Defaults to today in the user's time zone"
    )


class GoalsResponse(BaseModel):
    current: Goal | None = Field(description="Effective goal for today; null if none yet")
    history: list[Goal] = Field(description="All goals, newest effective_from first")


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, description="IANA name, e.g. America/Chicago")
    dietary_restrictions: list[str] | None = None
    analysis_model: str | None = Field(
        default=None, description="null resets to the server default"
    )
