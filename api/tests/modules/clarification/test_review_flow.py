"""Review flow end to end: analyze → clarify → edit → add → confirm."""

from fastapi.testclient import TestClient

from tests.conftest import FakeStore


def analyze(client: TestClient, text: str = "chicken burrito bowl") -> dict:
    response = client.post("/api/v1/meals/analyze", json={"text_input": text})
    assert response.status_code == 201, response.text
    return response.json()


def attribute(meal: dict, kind: str) -> dict:
    return next(
        a for i in meal["items"] for a in i["uncertain_attributes"] if a["attribute"] == kind
    )


def test_option_answer(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client)
    prep = attribute(meal, "preparation")
    response = client.post(
        f"/api/v1/meals/{meal['id']}/clarify",
        json={"attribute_id": prep["id"], "answer": {"kind": "option", "option_id": "fried"}},
    )
    assert response.status_code == 200, response.text
    bowl = response.json()["items"][0]
    assert bowl["nutrition"]["kcal"] == 820
    assert bowl["source"] == "ai_clarified"
    assert attribute(response.json(), "preparation")["status"] == "answered"


def test_not_sure_keeps_values_and_cue(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client)
    portion = attribute(meal, "portion")
    response = client.post(
        f"/api/v1/meals/{meal['id']}/clarify",
        json={"attribute_id": portion["id"], "answer": {"kind": "not_sure"}},
    )
    body = response.json()
    assert body["items"][0]["nutrition"] == meal["items"][0]["nutrition"]
    assert attribute(body, "portion")["status"] == "not_sure"
    assert body["items"][0]["kcal_range"] is not None


def test_other_answer_reestimates_item(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client)
    prep = attribute(meal, "preparation")
    response = client.post(
        f"/api/v1/meals/{meal['id']}/clarify",
        json={"attribute_id": prep["id"], "answer": {"kind": "other", "text": "air-fried"}},
    )
    assert response.status_code == 200, response.text
    bowl = response.json()["items"][0]
    assert bowl["preparation"] == "air-fried"
    assert bowl["source"] == "ai_clarified"
    kept = [a for a in bowl["uncertain_attributes"] if a["id"] == prep["id"]]
    assert kept and kept[0]["resolution"] == {"option_id": None, "text": "air-fried"}
    assert bowl["ai_original"]["preparation"] == "grilled"  # snapshot kept


def test_edit_add_and_confirm(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client, "chicken and rice")
    chicken, rice, broccoli = meal["items"]
    response = client.patch(
        f"/api/v1/meals/{meal['id']}/draft",
        json={
            "meal_type": "dinner",
            "items": [
                {
                    "op": "update",
                    "id": rice["id"],
                    "portion": {"qty": 2, "unit": "cup", "grams": 316},
                },
                {"op": "update", "id": chicken["id"], "name": "Chicken thigh"},
                {"op": "remove", "id": broccoli["id"]},
            ],
        },
    )
    assert response.status_code == 200, response.text
    edited = response.json()
    assert edited["meal_type"] == "dinner"
    assert [i["name"] for i in edited["items"]] == ["Chicken thigh", "White rice"]
    assert edited["items"][1]["nutrition"]["kcal"] == 410
    assert all(i["source"] == "user_edited" for i in edited["items"])

    added = client.post(
        f"/api/v1/meals/{meal['id']}/items",
        json={
            "name": "Ranch dressing",
            "portion": {"qty": 2, "unit": "tbsp", "grams": 30},
            "nutrition": {"kcal": 130, "protein_g": 0.4, "carbs_g": 1.8, "fat_g": 13.4},
        },
    )
    assert added.status_code == 200, added.text
    assert added.json()["items"][-1]["source"] == "user_added"

    estimated = client.post(f"/api/v1/meals/{meal['id']}/items", json={"name": "Garlic bread"})
    assert estimated.status_code == 200, estimated.text
    assert estimated.json()["items"][-1]["nutrition"]["kcal"] == 170

    confirmed = client.post(f"/api/v1/meals/{meal['id']}/confirm")
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["confirmed_at"] is not None

    # Draft-only operations are now invalid; the confirmed PATCH works.
    again = client.post(f"/api/v1/meals/{meal['id']}/confirm")
    assert again.status_code == 409 and again.json()["error"]["code"] == "MEAL_INVALID_STATE"
    draft_patch = client.patch(f"/api/v1/meals/{meal['id']}/draft", json={})
    assert draft_patch.status_code == 409
    patched = client.patch(f"/api/v1/meals/{meal['id']}", json={"meal_type": "lunch"})
    assert patched.status_code == 200 and patched.json()["status"] == "confirmed"


def test_unknown_item_in_patch_is_not_found(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client)
    response = client.patch(
        f"/api/v1/meals/{meal['id']}/draft",
        json={"items": [{"op": "remove", "id": "00000000-0000-0000-0000-000000000099"}]},
    )
    assert response.status_code == 404
    assert len(fake_store.meals[next(iter(fake_store.meals))].items) == 3


def test_reestimate_requires_a_field(client: TestClient, fake_store: FakeStore) -> None:
    meal = analyze(client)
    url = f"/api/v1/meals/{meal['id']}/items/{meal['items'][0]['id']}/reestimate"
    assert client.post(url, json={}).status_code == 422
    response = client.post(url, json={"name": "Veggie burrito bowl"})
    assert response.status_code == 200
    assert response.json()["items"][0]["name"] == "Veggie burrito bowl"
    assert response.json()["items"][0]["source"] == "user_edited"
