"""The only module that talks to OpenAI (system-architecture §3, M1 design §3.7).

Public interface:

- `analyze_meal(...) -> AnalysisResult`      one call per meal analysis (M1)
- `estimate_item(...) -> LLMItem`            re-estimate / estimate one item (M1, used by M2)
- `structured(...) -> T`                     generic structured output for any Pydantic model (M5)

Modes (`LLM_MODE`):

- `live`: OpenAI structured outputs (`chat.completions.parse` with the Pydantic model as the
  schema), `LLM_TIMEOUT_SECONDS` timeout, one SDK retry on timeout / 5xx / connection errors.
- `fixture`: recorded responses from `api/tests/fixtures/llm/` (see `fixtures.py`). No network.

Errors raised are `AppError`s (`LLM_TIMEOUT`, `LLM_UNAVAILABLE`, `LLM_INVALID_OUTPUT`), so they
render as the standard envelope if a caller does not handle them.
"""

import base64
import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import openai
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.services.llm import fixtures
from app.services.llm.schemas import AnalysisResult, EstimateItemResult, LLMItem

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
ANALYZE_PROMPT_VERSION = "analyze_meal.v1"
ESTIMATE_PROMPT_VERSION = "estimate_item.v1"


class LLMError(AppError):
    """Base class for LLM failures. Subclasses fix the error code."""

    code_for_class: ErrorCode = ErrorCode.LLM_UNAVAILABLE

    def __init__(self, message: str | None = None, *, details: Any = None) -> None:
        super().__init__(self.code_for_class, message, details=details)


class LLMTimeoutError(LLMError):
    code_for_class = ErrorCode.LLM_TIMEOUT


class LLMUnavailableError(LLMError):
    code_for_class = ErrorCode.LLM_UNAVAILABLE


class LLMInvalidOutputError(LLMError):
    code_for_class = ErrorCode.LLM_INVALID_OUTPUT


@dataclass(frozen=True)
class PhotoInput:
    """A meal photo. Bytes are loaded lazily, so fixture mode never touches Storage."""

    path: str
    load_bytes: Callable[[], bytes]
    mime_type: str = "image/jpeg"


@dataclass(frozen=True)
class MealContext:
    local_time: str  # e.g. "2026-10-21 12:30 (Tuesday)"
    meal_type_hint: str | None = None
    dietary_restrictions: list[str] = field(default_factory=list)


@lru_cache
def load_prompt(version: str) -> str:
    return (PROMPTS_DIR / f"{version}.md").read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def analyze_meal(
    *,
    model: str,
    photo: PhotoInput | None,
    text: str | None,
    context: MealContext,
    feedback: list[str] | None = None,
) -> AnalysisResult:
    """Analyze a meal photo and/or text. `feedback` = validation errors from a previous attempt."""
    if get_settings().llm_mode == "fixture":
        key = fixtures.select_analysis_key(photo.path if photo else None, text)
        _log_call("analyze_meal", model, ANALYZE_PROMPT_VERSION, 0.0, None, f"fixture:{key}")
        return fixtures.load_analysis(key)

    lines = [
        f"Local time: {context.local_time}",
        f"Meal type hint: {context.meal_type_hint or 'unknown'}",
        "Dietary restrictions (context only; never change the recognized food): "
        + (", ".join(context.dietary_restrictions) or "none"),
        f"User's description: {text.strip() if text else '(none)'}",
    ]
    if photo is None:
        lines.append("No photo was provided: set `image` to null and rely on the description.")
    if feedback:
        lines.append(_feedback_block(feedback))
    return _parse(
        model=model,
        prompt_version=ANALYZE_PROMPT_VERSION,
        system=load_prompt(ANALYZE_PROMPT_VERSION),
        user_text="\n".join(lines),
        photo=photo,
        schema=AnalysisResult,
        operation="analyze_meal",
    )


def estimate_item(
    *,
    model: str,
    name: str | None,
    preparation: str | None,
    note: str | None,
    current_item: dict[str, Any] | None,
    portion: dict[str, Any] | None,
    photo: PhotoInput | None,
    context: MealContext,
    feedback: list[str] | None = None,
) -> LLMItem:
    """Estimate one item. Used for re-estimates, "Something else" answers, and manual adds."""
    if get_settings().llm_mode == "fixture":
        item = fixtures.load_estimate_item(name or (current_item or {}).get("name"))
        if name:
            item.name = name
        if preparation:
            item.preparation = preparation
        _log_call("estimate_item", model, ESTIMATE_PROMPT_VERSION, 0.0, None, "fixture")
        return item

    lines = [
        f"Local time: {context.local_time}",
        f"Meal type hint: {context.meal_type_hint or 'unknown'}",
        "Current item (may be wrong): "
        + (json.dumps(current_item, ensure_ascii=False) if current_item else "(new item)"),
        f"New name from the user: {name or '(unchanged)'}",
        f"New preparation from the user: {preparation or '(unchanged)'}",
        f"User's note: {note or '(none)'}",
        "Portion stated by the user: "
        + (json.dumps(portion) if portion else "(not given; estimate it)"),
    ]
    if feedback:
        lines.append(_feedback_block(feedback))
    result = _parse(
        model=model,
        prompt_version=ESTIMATE_PROMPT_VERSION,
        system=load_prompt(ESTIMATE_PROMPT_VERSION),
        user_text="\n".join(lines),
        photo=photo,
        schema=EstimateItemResult,
        operation="estimate_item",
    )
    return result.item


def structured[T: BaseModel](
    *,
    model: str,
    system: str,
    user: str,
    schema: type[T],
    fixture_key: str | None = None,
    prompt_version: str = "adhoc",
) -> T:
    """Generic structured output (e.g. M5 suggestions). Fixture mode reads
    `tests/fixtures/llm/structured/<fixture_key>.json`."""
    if get_settings().llm_mode == "fixture":
        data = fixtures.load_structured(fixture_key) if fixture_key else None
        if data is None:
            raise LLMUnavailableError(f"No LLM fixture recorded for {fixture_key!r}.")
        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            raise LLMInvalidOutputError(details=str(exc)) from exc
    return _parse(
        model=model,
        prompt_version=prompt_version,
        system=system,
        user_text=user,
        photo=None,
        schema=schema,
        operation="structured",
    )


# ---------------------------------------------------------------------------
# Live mode
# ---------------------------------------------------------------------------


@lru_cache
def _openai_client() -> openai.OpenAI:
    settings = get_settings()
    return openai.OpenAI(
        api_key=settings.openai_api_key.get_secret_value(),
        timeout=settings.llm_timeout_seconds,
        max_retries=1,  # one retry on timeout / 5xx / connection errors
    )


# Models that rejected `temperature` (e.g. reasoning models); remembered per process.
_NO_TEMPERATURE: set[str] = set()


def _parse[T: BaseModel](
    *,
    model: str,
    prompt_version: str,
    system: str,
    user_text: str,
    photo: PhotoInput | None,
    schema: type[T],
    operation: str,
) -> T:
    content: list[dict[str, Any]] = [{"type": "text", "text": user_text}]
    if photo is not None:
        encoded = base64.b64encode(photo.load_bytes()).decode()
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{photo.mime_type};base64,{encoded}", "detail": "high"},
            }
        )
    messages: list[Any] = [
        {"role": "system", "content": system},
        {"role": "user", "content": content},
    ]

    started = time.perf_counter()
    try:
        completion = _create(model, messages, schema)
    except openai.APITimeoutError as exc:
        _log_call(operation, model, prompt_version, _elapsed(started), None, "timeout")
        raise LLMTimeoutError() from exc
    except (openai.APIConnectionError, openai.APIStatusError) as exc:
        _log_call(operation, model, prompt_version, _elapsed(started), None, "unavailable")
        raise LLMUnavailableError() from exc
    except (openai.LengthFinishReasonError, openai.ContentFilterFinishReasonError) as exc:
        _log_call(operation, model, prompt_version, _elapsed(started), None, "invalid")
        raise LLMInvalidOutputError(details=type(exc).__name__) from exc
    except ValidationError as exc:
        _log_call(operation, model, prompt_version, _elapsed(started), None, "invalid")
        raise LLMInvalidOutputError(details=str(exc)) from exc

    usage = completion.usage.model_dump() if completion.usage else None
    message = completion.choices[0].message
    if message.parsed is None:
        _log_call(operation, model, prompt_version, _elapsed(started), usage, "refusal")
        raise LLMInvalidOutputError(details=message.refusal or "empty response")
    _log_call(operation, model, prompt_version, _elapsed(started), usage, "ok")
    return message.parsed


def _create[T: BaseModel](model: str, messages: list[Any], schema: type[T]):
    """Call with the lowest randomness the model supports (M1 §3.3)."""
    completions = _openai_client().chat.completions
    if model not in _NO_TEMPERATURE:
        try:
            return completions.parse(
                model=model, messages=messages, response_format=schema, temperature=0
            )
        except openai.BadRequestError as exc:
            if "temperature" not in str(exc):
                raise
            _NO_TEMPERATURE.add(model)
    return completions.parse(model=model, messages=messages, response_format=schema)


def _feedback_block(feedback: list[str]) -> str:
    bullet_list = "\n".join(f"- {line}" for line in feedback)
    return (
        "Your previous answer failed these checks. Return a corrected answer that fixes them:\n"
        + bullet_list
    )


def _elapsed(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 1)


def _log_call(
    operation: str,
    model: str,
    prompt_version: str,
    latency_ms: float,
    usage: dict[str, Any] | None,
    outcome: str,
) -> None:
    # Never log the image or the user's text at info level (M1 §3.7).
    logger.info(
        "llm call",
        extra={
            "fields": {
                "llm_operation": operation,
                "llm_model": model,
                "llm_prompt_version": prompt_version,
                "llm_mode": get_settings().llm_mode,
                "latency_ms": latency_ms,
                "usage": usage,
                "outcome": outcome,
            }
        },
    )
