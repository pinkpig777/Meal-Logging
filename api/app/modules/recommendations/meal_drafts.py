"""Hypothetical meal estimates. Nothing here creates or updates meal records."""

import math
from datetime import date
from typing import Annotated

from pydantic import BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError

from app.modules.meals.schemas import DailyTotalsRecord
from app.schemas import Nutrition

METRICS = (("kcal", "kcal"), ("protein_g", "g protein"), ("carbs_g", "g carbs"), ("fat_g", "g fat"))


class DraftIngredient(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    portion: str = Field(min_length=1, max_length=60)
    estimated_nutrition: Nutrition


class MealDraft(BaseModel):
    ingredients: list[DraftIngredient] = Field(min_length=1, max_length=5)
    assumptions: list[Annotated[str, Field(min_length=1, max_length=120)]] = Field(
        min_length=1, max_length=3
    )

    @model_validator(mode="after")
    def validate_estimates(self) -> "MealDraft":
        if any(not a.strip() or len(a) > 120 for a in self.assumptions):
            raise PydanticCustomError("invalid_assumptions", "State concise estimate assumptions")
        for item in self.ingredients:
            if not item.name.strip() or not item.portion.strip():
                raise PydanticCustomError("blank_ingredient", "Ingredient fields cannot be blank")
            n = item.estimated_nutrition
            energy = 4 * n.protein_g + 4 * n.carbs_g + 9 * n.fat_g
            if (
                not all(math.isfinite(v) for v in n.model_dump().values())
                or not 0 < n.kcal <= 2000
                or abs(n.kcal - energy) > max(30, n.kcal * 0.25)
            ):
                raise PydanticCustomError("invalid_draft_energy", "Implausible ingredient estimate")
        if self.totals()["kcal"] > 3000:
            raise PydanticCustomError("draft_total_too_large", "Draft exceeds the supported range")
        return self

    def totals(self) -> dict[str, float]:
        return {
            metric: sum(getattr(i.estimated_nutrition, metric) for i in self.ingredients)
            for metric, _ in METRICS
        }


def remaining_today(rows: list[DailyTotalsRecord], today: date) -> dict[str, float] | None:
    """Signed goal-minus-recorded gaps; absence of a logged day is never zero intake."""
    row = next((row for row in rows if row.local_date == today), None)
    if row is None or row.goal_id is None:
        return None
    goals = {metric: getattr(row, f"goal_{metric}") for metric, _ in METRICS}
    if any(value is None for value in goals.values()):
        return None
    return {metric: goals[metric] - getattr(row, metric) for metric, _ in METRICS}


def format_gaps(gaps: dict[str, float]) -> str:
    return "; ".join(
        f"{abs(gaps[metric]):.0f} {label} {'below' if gaps[metric] >= 0 else 'above'} goal"
        for metric, label in METRICS
    )


def render_draft(draft: MealDraft, gaps: dict[str, float] | None) -> str:
    lines = ["Hypothetical meal draft — not saved. AI nutrition estimates, not verified labels:"]
    for item in draft.ingredients:
        nutrition = ", ".join(
            f"{getattr(item.estimated_nutrition, metric):.0f} {label}" for metric, label in METRICS
        )
        lines.append(f"• {item.name}: {item.portion} — estimated {nutrition}.")
    totals = draft.totals()
    lines.append(
        "Estimated draft total: "
        + ", ".join(f"{totals[metric]:.0f} {label}" for metric, label in METRICS)
        + "."
    )
    lines.append("Assumptions: " + " ".join(draft.assumptions))
    if gaps is not None:
        projected = {metric: gaps[metric] - totals[metric] for metric, _ in METRICS}
        lines.append(
            "If eaten in addition to today's confirmed meals: "
            + format_gaps(projected)
            + ". This is a projection, not an exact allowance; missing meals change it."
        )
    else:
        lines.append(
            "Today's recorded intake and goal are not both available in this period, so "
            "a remaining-goal comparison is unavailable. Choose Today and confirm any "
            "missing meals to compare."
        )
    lines.append("Review portions, preparation, and package labels before logging separately.")
    return "\n".join(lines)
