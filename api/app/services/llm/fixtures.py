"""Recorded LLM responses for `LLM_MODE=fixture` (M1 design §3.7).

Files live in `api/tests/fixtures/llm/`; `index.json` maps keys to files. Selection order:

1. exact key: the photo filename stem (`{user_id}/{stem}.jpg`) or `sha256(text)[:12]`
2. the first `keywords` entry contained in the (lower-cased) text, e.g. "pasta"
3. `default`

So in fixture mode, typing "pasta with cream sauce" returns the pasta fixture, and
"not food" returns the non-food result.
"""

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services.llm.schemas import AnalysisResult, LLMItem

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "llm"


@lru_cache
def load_index() -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / "index.json").read_text(encoding="utf-8"))


def text_key(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()[:12]


def select_analysis_key(photo_path: str | None, text: str | None) -> str:
    index = load_index()
    analyses: dict[str, str] = index["analyses"]
    keys: dict[str, str] = index.get("keys", {})
    candidates: list[str] = []
    if photo_path:
        candidates.append(Path(photo_path).stem)
    if text:
        candidates.append(text_key(text))
    for candidate in candidates:
        if candidate in analyses:
            return candidate
        if candidate in keys:
            return keys[candidate]
    if text:
        lowered = text.lower()
        for keyword, key in index.get("keywords", {}).items():
            if keyword in lowered:
                return key
    return index["default"]


def load_analysis(key: str) -> AnalysisResult:
    filename = load_index()["analyses"][key]
    return AnalysisResult.model_validate_json((FIXTURES_DIR / filename).read_text("utf-8"))


def all_analysis_keys() -> list[str]:
    return list(load_index()["analyses"].keys())


def load_estimate_item(name: str | None) -> LLMItem:
    """An item from any analysis fixture with the same name, else the default estimate."""
    if name:
        for key in all_analysis_keys():
            for item in load_analysis(key).items:
                if item.name.lower() == name.strip().lower():
                    return item.model_copy(deep=True)
    filename = load_index()["estimate_item_default"]
    data = json.loads((FIXTURES_DIR / filename).read_text("utf-8"))
    return LLMItem.model_validate(data["item"])


def load_structured(fixture_key: str) -> dict[str, Any] | None:
    """Generic structured-output fixtures: `structured/<fixture_key>.json` (used by M5)."""
    path = FIXTURES_DIR / "structured" / f"{fixture_key}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text("utf-8"))
