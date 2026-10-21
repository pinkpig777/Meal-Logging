"""Application settings, loaded from environment variables.

See docs/07-engineering/environment-setup.md.

Every variable in `api/.env.example` maps to one field here. Settings are validated at startup:
an invalid combination (e.g. `AUTH_MODE=dev` outside `APP_ENV=local`) stops the app from booting.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]


class AnalysisModelOption(BaseModel):
    """One entry of the `ANALYSIS_MODELS` allowlist (ADR-0006)."""

    id: str
    label: str
    description: str | None = None


def parse_analysis_models(raw: str) -> list[AnalysisModelOption]:
    """Parse `"id:label,id:label"`.

    The label is everything after the **last** colon, so model ids that contain colons
    (e.g. fine-tuned `ft:...` ids) still work. An entry without a label uses its id as the label.
    """
    models: list[AnalysisModelOption] = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        model_id, sep, label = entry.rpartition(":")
        if not sep:
            model_id, label = entry, entry
        model_id, label = model_id.strip(), label.strip()
        if not model_id or not label:
            raise ValueError(f"Invalid ANALYSIS_MODELS entry: {entry!r} (expected 'id:label')")
        models.append(AnalysisModelOption(id=model_id, label=label))
    ids = [m.id for m in models]
    if len(ids) != len(set(ids)):
        raise ValueError("ANALYSIS_MODELS contains duplicate model ids")
    return models


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["local", "preview", "production"] = "local"

    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: SecretStr = SecretStr("")
    # Admin tasks only (storage cleanup, account purge). Never sent to the browser.
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_jwt_secret: SecretStr = SecretStr("")

    auth_mode: Literal["supabase", "dev"] = "supabase"
    llm_mode: Literal["live", "fixture"] = "fixture"
    openai_api_key: SecretStr = SecretStr("")

    analysis_models: Annotated[list[AnalysisModelOption], NoDecode] = Field(
        default_factory=lambda: parse_analysis_models("model-a:Faster,model-b:More detailed")
    )
    analysis_model_default: str = "model-a"
    llm_timeout_seconds: float = Field(default=45, gt=0)

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    @field_validator("analysis_models", mode="before")
    @classmethod
    def _parse_models(cls, value: object) -> object:
        if isinstance(value, str):
            return parse_analysis_models(value)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip().rstrip("/") for o in value.split(",") if o.strip()]
        return value

    @model_validator(mode="after")
    def _check_combinations(self) -> "Settings":
        if self.auth_mode == "dev" and self.app_env != "local":
            raise ValueError("AUTH_MODE=dev is only allowed when APP_ENV=local")
        if not self.analysis_models:
            raise ValueError("ANALYSIS_MODELS must list at least one model")
        if self.analysis_model_default not in self.model_ids:
            raise ValueError(
                f"ANALYSIS_MODEL_DEFAULT={self.analysis_model_default!r} is not in ANALYSIS_MODELS"
            )
        if self.llm_mode == "live" and not self.openai_api_key.get_secret_value():
            raise ValueError("OPENAI_API_KEY is required when LLM_MODE=live")
        return self

    @property
    def model_ids(self) -> list[str]:
        return [m.id for m in self.analysis_models]

    def is_model_allowed(self, model_id: str) -> bool:
        return model_id in self.model_ids

    def resolve_model(self, preferred: str | None) -> str:
        """Use the preferred model if it is still allowlisted, else the default (ADR-0006)."""
        if preferred and self.is_model_allowed(preferred):
            return preferred
        return self.analysis_model_default


@lru_cache
def get_settings() -> Settings:
    return Settings()
