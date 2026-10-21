"""LLM output schemas (M1 design §3.2).

These are sent to OpenAI as the structured-output JSON schema, so keep them strict:
every field is required (nullable fields use `X | None` without a default) and no extra keys.
Range rules (2–4 options, ≤ 3 attributes, 1–12 items, …) are enforced by the semantic checks in
`app/modules/recognition/validation.py`, not by the JSON schema.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LLMNutrition(_Strict):
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


class LLMPortion(_Strict):
    qty: float
    unit: str  # familiar unit: cup, piece, slice, tbsp, bowl, g
    grams: float


class LLMOption(_Strict):
    id: str  # short slug, unique within the attribute
    label: str
    nutrition: LLMNutrition  # item's full estimate if chosen, at the current portion
    portion: LLMPortion | None  # only for attribute == "portion"


class LLMUncertainAttribute(_Strict):
    attribute: Literal["identity", "portion", "preparation", "ingredient"]
    reason: str  # ≤ 80 chars, plain language, no numbers about confidence
    question: str  # one question about one attribute of this item
    options: list[LLMOption]  # 2–4, mutually exclusive
    current_option_id: str  # the option the item's values currently reflect


class LLMItem(_Strict):
    name: str
    kind: Literal["dish", "addon"]
    preparation: str | None
    portion: LLMPortion
    nutrition: LLMNutrition
    uncertain_attributes: list[LLMUncertainAttribute]  # 0–3


class LLMImageAssessment(_Strict):
    is_food: bool
    issues: list[Literal["blurry", "dark", "partial", "multiple_meals", "obstructed"]]
    note: str | None  # user-facing explanation when not food or issues exist


class AnalysisResult(_Strict):
    image: LLMImageAssessment | None  # null for text-only input
    items: list[LLMItem]  # 1–12


class EstimateItemResult(_Strict):
    """Wrapper for `estimate_item` (structured outputs need an object at the root)."""

    item: LLMItem
