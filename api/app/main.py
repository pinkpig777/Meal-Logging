"""FastAPI app factory: middleware, error handlers, and router registration.

Run locally: `uv run fastapi dev app/main.py` → http://localhost:8000/api/v1/docs
"""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from importlib.metadata import PackageNotFoundError, version

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import ERROR_RESPONSES, install_exception_handlers
from app.core.logging import configure_logging, set_request_id, set_user_id
from app.modules.analytics.router import router as analytics_router
from app.modules.clarification.router import router as clarification_router
from app.modules.meals.router import router as meals_router
from app.modules.recognition.router import router as recognition_router
from app.modules.recommendations.router import router as recommendations_router

API_PREFIX = "/api/v1"
logger = logging.getLogger("app")

try:
    APP_VERSION = version("meal-logging-api")
except PackageNotFoundError:  # pragma: no cover
    APP_VERSION = "0.0.0"


class HealthResponse(BaseModel):
    status: str
    version: str
    app_env: str
    auth_mode: str
    llm_mode: str


health_router = APIRouter(tags=["health"])


@health_router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness; no auth."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        app_env=settings.app_env,
        auth_mode=settings.auth_mode,
        llm_mode=settings.llm_mode,
    )


def _operation_id(route: APIRoute) -> str:
    # Stable, readable operationIds (the handler function name), e.g. "analyze_meal".
    return route.name


async def _request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    set_request_id(request_id)
    set_user_id(None)
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    route = request.scope.get("route")
    logger.info(
        "request",
        extra={
            "fields": {
                "method": request.method,
                "route": getattr(route, "path", request.url.path),
                "status": response.status_code,
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                "user_id": getattr(request.state, "user_id", None),
            }
        },
    )
    return response


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging()

    app = FastAPI(
        title="Meal Logging API",
        version=APP_VERSION,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        generate_unique_id_function=_operation_id,
        separate_input_output_schemas=False,
    )
    install_exception_handlers(app)
    app.middleware("http")(_request_context)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    app.include_router(health_router, prefix=API_PREFIX)
    for router in (
        recognition_router,
        clarification_router,
        meals_router,
        analytics_router,
        recommendations_router,
    ):
        app.include_router(router, prefix=API_PREFIX, responses=ERROR_RESPONSES)

    if settings.auth_mode == "dev":
        logger.warning("AUTH_MODE=dev: every request acts as the seeded dev user")
    if settings.auth_mode == "supabase" and not settings.supabase_jwt_secret.get_secret_value():
        logger.warning("SUPABASE_JWT_SECRET is not set; authenticated requests will fail")
    return app


app = create_app()
