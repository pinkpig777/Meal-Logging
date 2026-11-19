"""Nutrition value objects (api-reference §2). Numbers are unrounded; clients round."""

from pydantic import BaseModel, Field


class Nutrition(BaseModel):
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class KcalRange(BaseModel):
    low: float
    high: float


class Portion(BaseModel):
    qty: float = Field(gt=0, description="e.g. 1.5")
    unit: str = Field(
        min_length=1, description='Familiar unit: "cup", "piece", "slice", "tbsp", "g"'
    )
    grams: float = Field(gt=0, description="Estimated weight in grams")


class NutritionTotals(Nutrition):
    kcal_low: float
    kcal_high: float
    kcal_checked: float = Field(
        ge=0,
        description="kcal from items the user touched (source ai_clarified, user_edited, "
        "or user_added)",
    )
    kcal_ai_only: float = Field(
        ge=0, description="kcal from untouched AI items (source ai); kcal_checked + this = kcal"
    )
