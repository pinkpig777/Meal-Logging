"""M1 request/response bodies (api-reference §3)."""

from pydantic import AwareDatetime, BaseModel, Field, model_validator

from app.schemas import MealType


class AnalyzeMealRequest(BaseModel):
    photo_path: str | None = Field(
        default=None, description="Storage path under the caller's folder: {user_id}/{photo_id}.jpg"
    )
    text_input: str | None = Field(default=None, max_length=500)
    eaten_at: AwareDatetime | None = Field(
        default=None, description="Defaults to now; a past value backfills"
    )
    meal_type: MealType | None = Field(
        default=None, description="Inferred from the local time if omitted"
    )


class ReestimateItemRequest(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    preparation: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _at_least_one(self) -> "ReestimateItemRequest":
        if not any((self.name, self.preparation, self.note)):
            raise ValueError("Provide at least one of name, preparation, or note.")
        return self


class AnalysisModelInfo(BaseModel):
    id: str
    label: str
    description: str | None


class AnalysisModelsResponse(BaseModel):
    default: str
    models: list[AnalysisModelInfo]
