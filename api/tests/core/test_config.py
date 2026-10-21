import pytest
from pydantic import ValidationError

from app.core.config import Settings, parse_analysis_models


def make(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_parse_analysis_models_pairs() -> None:
    models = parse_analysis_models("model-a:Faster, model-b:More detailed")
    assert [(m.id, m.label) for m in models] == [
        ("model-a", "Faster"),
        ("model-b", "More detailed"),
    ]
    assert all(m.description is None for m in models)


def test_parse_analysis_models_id_with_colons_uses_last_colon() -> None:
    (model,) = parse_analysis_models("ft:gpt-x:org::abc:Tuned")
    assert model.id == "ft:gpt-x:org::abc"
    assert model.label == "Tuned"


def test_parse_analysis_models_rejects_duplicates_and_blanks() -> None:
    with pytest.raises(ValueError):
        parse_analysis_models("a:A,a:Again")
    with pytest.raises(ValueError):
        parse_analysis_models(":label")


def test_env_strings_are_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANALYSIS_MODELS", "m1:One,m2:Two")
    monkeypatch.setenv("ANALYSIS_MODEL_DEFAULT", "m2")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, https://app.example.com/")
    settings = make()
    assert settings.model_ids == ["m1", "m2"]
    assert settings.cors_origins == ["http://localhost:5173", "https://app.example.com"]


def test_dev_auth_refused_outside_local() -> None:
    with pytest.raises(ValidationError, match="AUTH_MODE=dev"):
        make(app_env="production", auth_mode="dev")
    assert make(app_env="local", auth_mode="dev").auth_mode == "dev"


def test_default_model_must_be_allowlisted() -> None:
    with pytest.raises(ValidationError, match="ANALYSIS_MODEL_DEFAULT"):
        make(analysis_model_default="nope")


def test_live_mode_requires_openai_key() -> None:
    with pytest.raises(ValidationError, match="OPENAI_API_KEY"):
        make(llm_mode="live", openai_api_key="")
    assert make(llm_mode="live", openai_api_key="sk-test").llm_mode == "live"


def test_resolve_model_falls_back_to_default() -> None:
    settings = make()
    assert settings.resolve_model("model-b") == "model-b"
    assert settings.resolve_model("removed-model") == settings.analysis_model_default
    assert settings.resolve_model(None) == settings.analysis_model_default
