"""Goal contract (api-reference §2)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class Goal(BaseModel):
    id: UUID
    effective_from: date
    kcal: int
    protein_g: float
    carbs_g: float
    fat_g: float
