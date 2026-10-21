"""Profile contract (api-reference §2)."""

from uuid import UUID

from pydantic import BaseModel, Field


class Profile(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    timezone: str
    dietary_restrictions: list[str]
    analysis_model: str | None = Field(description="null = server default")
