"""Opt-in smoke test against the real OpenAI API: `uv run pytest -m live`.

Reads OPENAI_API_KEY and the model allowlist from the real environment (LIVE_OPENAI_API_KEY
overrides, since conftest blanks OPENAI_API_KEY for the offline suite).
"""

import os

import pytest

from app.core.config import Settings, get_settings
from app.modules.recognition.validation import check_analysis
from app.services.llm import client as llm

pytestmark = pytest.mark.live


def test_text_analysis_live(monkeypatch: pytest.MonkeyPatch) -> None:
    key = os.environ.get("LIVE_OPENAI_API_KEY")
    if not key:
        pytest.skip("set LIVE_OPENAI_API_KEY to run live tests")
    settings = Settings(llm_mode="live", openai_api_key=key)  # type: ignore[call-arg]
    monkeypatch.setattr(llm, "get_settings", lambda: settings)
    llm._openai_client.cache_clear()
    result = llm.analyze_meal(
        model=settings.analysis_model_default,
        photo=None,
        text="grilled chicken with a cup of rice and broccoli",
        context=llm.MealContext(local_time="2026-10-21 12:30 (Wednesday)"),
    )
    assert check_analysis(result).ok or result.items
    get_settings.cache_clear()
