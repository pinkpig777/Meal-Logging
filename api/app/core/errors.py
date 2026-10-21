"""Error codes and the error envelope (docs/05-api/api-conventions.md §4).

Raise `AppError(ErrorCode.X, "Human-readable sentence.", details={...})` anywhere; the
exception handlers registered in `install_exception_handlers` turn it into:

    {"error": {"code": "...", "message": "...", "details": ..., "request_id": "..."}}

New codes are added to `ErrorCode` and `ERROR_STATUS` *and* to the table in
api-conventions.md in the same PR.
"""

import logging
from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_request_id
from app.schemas.common import ErrorBody, ErrorResponse

logger = logging.getLogger(__name__)


class ErrorCode(StrEnum):
    UNAUTHENTICATED = "UNAUTHENTICATED"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MEAL_INVALID_STATE = "MEAL_INVALID_STATE"
    IMAGE_NOT_FOOD = "IMAGE_NOT_FOOD"
    INPUT_REQUIRED = "INPUT_REQUIRED"
    MODEL_NOT_ALLOWED = "MODEL_NOT_ALLOWED"
    LLM_UNAVAILABLE = "LLM_UNAVAILABLE"
    LLM_INVALID_OUTPUT = "LLM_INVALID_OUTPUT"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL = "INTERNAL"


ERROR_STATUS: dict[ErrorCode, int] = {
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.MEAL_INVALID_STATE: 409,
    ErrorCode.IMAGE_NOT_FOOD: 422,
    ErrorCode.INPUT_REQUIRED: 422,
    ErrorCode.MODEL_NOT_ALLOWED: 422,
    ErrorCode.LLM_UNAVAILABLE: 502,
    ErrorCode.LLM_INVALID_OUTPUT: 502,
    ErrorCode.LLM_TIMEOUT: 504,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.INTERNAL: 500,
}

DEFAULT_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.UNAUTHENTICATED: "Please sign in again.",
    ErrorCode.NOT_FOUND: "We couldn't find that.",
    ErrorCode.VALIDATION_ERROR: "Some of the information sent was not valid.",
    ErrorCode.MEAL_INVALID_STATE: "This meal can't be changed that way right now.",
    ErrorCode.IMAGE_NOT_FOOD: (
        "This photo doesn't seem to show food. Try another photo or describe your meal."
    ),
    ErrorCode.INPUT_REQUIRED: "Add a photo or a short description of your meal.",
    ErrorCode.MODEL_NOT_ALLOWED: "That analysis model isn't available.",
    ErrorCode.LLM_UNAVAILABLE: "Meal analysis is unavailable right now. Please try again.",
    ErrorCode.LLM_INVALID_OUTPUT: "We couldn't make sense of the analysis. Please try again.",
    ErrorCode.LLM_TIMEOUT: "Meal analysis took too long. Please try again.",
    ErrorCode.RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
    ErrorCode.INTERNAL: "Something went wrong on our side. Please try again.",
}


class AppError(Exception):
    """An error with a stable code, rendered as the standard error envelope."""

    def __init__(
        self,
        code: ErrorCode,
        message: str | None = None,
        *,
        details: Any = None,
        status_code: int | None = None,
    ) -> None:
        self.code = code
        self.message = message or DEFAULT_MESSAGES[code]
        self.details = details
        self.status_code = status_code or ERROR_STATUS[code]
        super().__init__(f"{code}: {self.message}")


def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    body = ErrorResponse(
        error=ErrorBody(code=code, message=message, details=details, request_id=get_request_id())
    )
    return body.model_dump(mode="json")


def _response(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    headers = {}
    if request_id := get_request_id():
        headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=status, content=error_payload(code, message, details), headers=headers
    )


_HTTP_STATUS_CODES: dict[int, ErrorCode] = {
    401: ErrorCode.UNAUTHENTICATED,
    403: ErrorCode.UNAUTHENTICATED,
    404: ErrorCode.NOT_FOUND,
    405: ErrorCode.NOT_FOUND,
    422: ErrorCode.VALIDATION_ERROR,
    429: ErrorCode.RATE_LIMITED,
}


async def _app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    if exc.status_code >= 500:
        logger.warning("app error", extra={"fields": {"code": exc.code, "msg": exc.message}})
    return _response(exc.status_code, exc.code, exc.message, exc.details)


async def _validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [
        {"loc": [str(part) for part in err.get("loc", ())], "msg": err.get("msg", "")}
        for err in exc.errors()
    ]
    return _response(
        422, ErrorCode.VALIDATION_ERROR, DEFAULT_MESSAGES[ErrorCode.VALIDATION_ERROR], details
    )


async def _http_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_STATUS_CODES.get(
        exc.status_code,
        ErrorCode.INTERNAL if exc.status_code >= 500 else ErrorCode.VALIDATION_ERROR,
    )
    message = exc.detail if isinstance(exc.detail, str) else DEFAULT_MESSAGES[code]
    return _response(exc.status_code, code, message)


async def _unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error", exc_info=exc)
    return _response(500, ErrorCode.INTERNAL, DEFAULT_MESSAGES[ErrorCode.INTERNAL])


def install_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)


# Attach to routers so every operation documents the envelope instead of FastAPI's
# default `HTTPValidationError` (FastAPI skips its default 422 when "422" is present).
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    "4XX": {"model": ErrorResponse, "description": "Client error (see error.code)"},
    "422": {"model": ErrorResponse, "description": "Validation error"},
    "5XX": {"model": ErrorResponse, "description": "Server or upstream LLM error"},
}
