from fastapi.testclient import TestClient

from tests.conftest import FakeStore


def test_weekly_has_seven_days_and_null_for_unlogged(
    client: TestClient, fake_store: FakeStore
) -> None:
    meal = client.post(
        "/api/v1/meals/analyze",
        json={"text_input": "chicken and rice", "eaten_at": "2026-10-21T12:30:00-05:00"},
    ).json()
    client.post(f"/api/v1/meals/{meal['id']}/confirm")

    body = client.get("/api/v1/analytics/weekly", params={"start": "2026-10-19"}).json()
    assert body["start"] == "2026-10-19" and body["end"] == "2026-10-25"
    assert len(body["days"]) == 7
    assert body["logged_day_count"] == 1
    logged = [d for d in body["days"] if d["logged"]]
    assert logged[0]["date"] == "2026-10-21"
    assert all(d["totals"] is None for d in body["days"] if not d["logged"])
    assert body["averages"]["kcal"] == logged[0]["totals"]["kcal"]

    daily = client.get("/api/v1/analytics/daily", params={"date": "2026-10-21"}).json()
    assert daily["logged"] is True
    assert daily["meals"][0]["share"]["kcal"] == 1.0


def test_history_range_is_capped(client: TestClient, fake_store: FakeStore) -> None:
    response = client.get(
        "/api/v1/analytics/history", params={"from": "2026-01-01", "to": "2026-10-21"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_recommendations_need_three_logged_days(client: TestClient, fake_store: FakeStore) -> None:
    body = client.get("/api/v1/recommendations").json()
    assert body == {
        "status": "insufficient_history",
        "logged_day_count": 0,
        "required_day_count": 3,
        "suggestions": [],
    }
