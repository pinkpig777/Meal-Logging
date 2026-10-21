"""The OpenAPI schema is the published contract (api-conventions §5)."""

from app.main import app

EXPECTED = {
    ("get", "/api/v1/health"),
    ("get", "/api/v1/config/models"),
    ("post", "/api/v1/meals/analyze"),
    ("post", "/api/v1/meals/{id}/items/{item_id}/reestimate"),
    ("post", "/api/v1/meals/{id}/clarify"),
    ("patch", "/api/v1/meals/{id}/draft"),
    ("post", "/api/v1/meals/{id}/items"),
    ("post", "/api/v1/meals/{id}/confirm"),
    ("get", "/api/v1/meals"),
    ("get", "/api/v1/meals/{id}"),
    ("patch", "/api/v1/meals/{id}"),
    ("delete", "/api/v1/meals/{id}"),
    ("delete", "/api/v1/meals/{id}/photo"),
    ("get", "/api/v1/goals"),
    ("post", "/api/v1/goals"),
    ("get", "/api/v1/me"),
    ("patch", "/api/v1/me"),
    ("get", "/api/v1/analytics/daily"),
    ("get", "/api/v1/analytics/weekly"),
    ("get", "/api/v1/analytics/history"),
    ("get", "/api/v1/recommendations"),
    ("post", "/api/v1/recommendations/feedback"),
    ("post", "/api/v1/chat"),
}

SHARED_COMPONENTS = {
    "Nutrition",
    "KcalRange",
    "Portion",
    "AttributeOption",
    "UncertainAttribute",
    "MealItem",
    "NutritionTotals",
    "Meal",
    "MealSummary",
    "Goal",
    "Profile",
    "ErrorResponse",
    "MealStatus",
    "MealType",
    "ItemKind",
    "ItemSource",
    "AttributeKind",
    "ResolutionStatus",
    "ImageIssue",
}


def test_all_endpoints_present() -> None:
    schema = app.openapi()
    operations = {(m, p) for p, ops in schema["paths"].items() for m in ops}
    assert operations >= EXPECTED
    assert operations == EXPECTED


def test_status_codes() -> None:
    paths = app.openapi()["paths"]
    assert "201" in paths["/api/v1/meals/analyze"]["post"]["responses"]
    assert "201" in paths["/api/v1/goals"]["post"]["responses"]
    assert "204" in paths["/api/v1/meals/{id}"]["delete"]["responses"]
    assert "204" in paths["/api/v1/meals/{id}/photo"]["delete"]["responses"]
    assert "204" in paths["/api/v1/recommendations/feedback"]["post"]["responses"]


def test_shared_components_have_stable_names() -> None:
    components = set(app.openapi()["components"]["schemas"])
    assert components >= SHARED_COMPONENTS
    assert "HTTPValidationError" not in components
    assert not [c for c in components if c.endswith(("-Input", "-Output"))]


def test_auth_is_documented_except_health() -> None:
    paths = app.openapi()["paths"]
    assert "security" not in paths["/api/v1/health"]["get"]
    assert paths["/api/v1/meals/analyze"]["post"].get("security")
