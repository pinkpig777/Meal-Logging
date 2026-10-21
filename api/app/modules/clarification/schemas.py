"""M2 request bodies (api-reference §4). Owner: Clark."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas import MealType, Nutrition, Portion


class OptionAnswer(BaseModel):
    kind: Literal["option"]
    option_id: str


class NotSureAnswer(BaseModel):
    kind: Literal["not_sure"]


class OtherAnswer(BaseModel):
    kind: Literal["other"]
    text: str = Field(min_length=1, max_length=200)


ClarifyAnswer = Annotated[OptionAnswer | NotSureAnswer | OtherAnswer, Field(discriminator="kind")]


class ClarifyRequest(BaseModel):
    attribute_id: UUID
    answer: ClarifyAnswer


class ItemUpdateOp(BaseModel):
    op: Literal["update"]
    id: UUID
    name: str | None = Field(default=None, min_length=1, max_length=200)
    preparation: str | None = Field(default=None, max_length=100)
    portion: Portion | None = None
    nutrition: Nutrition | None = None


class ItemRemoveOp(BaseModel):
    op: Literal["remove"]
    id: UUID


ItemEditOp = Annotated[ItemUpdateOp | ItemRemoveOp, Field(discriminator="op")]


class MealEditRequest(BaseModel):
    """Body of `PATCH /meals/{id}/draft` and `PATCH /meals/{id}`."""

    meal_type: MealType | None = None
    eaten_at: AwareDatetime | None = None
    items: list[ItemEditOp] = Field(default_factory=list)


class AddItemRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    portion: Portion | None = Field(
        default=None, description="Required when nutrition is given; estimated otherwise"
    )
    nutrition: Nutrition | None = Field(
        default=None, description="null → estimated by M1 (text-only)"
    )
