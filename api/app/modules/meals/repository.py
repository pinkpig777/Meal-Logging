"""M3 persistence: the ONLY code that writes meals, meal_items, uncertain_attributes, profiles,
and user_goals (system-architecture §3). Other modules call these functions.

Every function takes the per-request, user-scoped Supabase client (`UserDb`), so RLS applies.
Rows that are not visible to the caller look exactly like missing rows (→ NOT_FOUND).
"""

from collections.abc import Iterable, Sequence
from datetime import date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from supabase import Client

from app.core.errors import AppError, ErrorCode
from app.modules.meals.schemas import (
    AttributeRecord,
    DailyTotalsRecord,
    GoalCreate,
    ItemRecord,
    MealRecord,
    NewAttribute,
    NewItem,
    ProfileRecord,
)
from app.schemas import (
    Goal,
    Meal,
    MealItem,
    MealStatus,
    MealSummary,
    UncertainAttribute,
)
from app.services.nutrition import sum_totals

PHOTO_BUCKET = "meal-photos"
PHOTO_URL_TTL_SECONDS = 15 * 60
DEFAULT_TIMEZONE = "America/Chicago"

_MEAL_WITH_ITEMS = "*, meal_items(*, uncertain_attributes(*))"
_MEAL_WITH_ITEM_TOTALS = (
    "*, meal_items(id, position, name, kcal, protein_g, carbs_g, fat_g, kcal_low, kcal_high)"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _rows(response: Any) -> list[dict[str, Any]]:
    data = getattr(response, "data", None)
    return data if isinstance(data, list) else []


def _jsonable(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    return value


def zone(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIMEZONE)


def is_valid_timezone(tz_name: str) -> bool:
    try:
        ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


def local_date_for(eaten_at: datetime, tz_name: str | None) -> date:
    """`eaten_at` converted to the profile's time zone at write time (data-model §4.3)."""
    return eaten_at.astimezone(zone(tz_name)).date()


def today_for(tz_name: str | None) -> date:
    return datetime.now(zone(tz_name)).date()


MAX_RANGE_DAYS = 92


def check_date_range(date_from: date, date_to: date) -> None:
    if date_from > date_to:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "The start date must be on or before the end date.",
            details=[{"loc": ["query", "from"], "msg": "must be <= to"}],
        )
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Date ranges are limited to {MAX_RANGE_DAYS} days.",
            details=[{"loc": ["query", "to"], "msg": f"range exceeds {MAX_RANGE_DAYS} days"}],
        )


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


def get_profile(db: Client, user_id: UUID) -> ProfileRecord:
    rows = _rows(db.table("profiles").select("*").eq("id", str(user_id)).limit(1).execute())
    if rows:
        return ProfileRecord.model_validate(rows[0])
    # The auth.users trigger normally creates it; recover if it is missing.
    created = _rows(db.table("profiles").insert({"id": str(user_id)}).execute())
    return ProfileRecord.model_validate(created[0])


def update_profile(db: Client, user_id: UUID, fields: dict[str, Any]) -> ProfileRecord:
    if fields:
        db.table("profiles").update(_jsonable(fields)).eq("id", str(user_id)).execute()
    return get_profile(db, user_id)


# ---------------------------------------------------------------------------
# Goals (insert-only history; same-day replacement via upsert)
# ---------------------------------------------------------------------------


def list_goals(db: Client, user_id: UUID) -> list[Goal]:
    rows = _rows(
        db.table("user_goals")
        .select("id, effective_from, kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", str(user_id))
        .order("effective_from", desc=True)
        .execute()
    )
    return [Goal.model_validate(r) for r in rows]


def upsert_goal(db: Client, user_id: UUID, body: GoalCreate, effective_from: date) -> Goal:
    row = {
        "user_id": str(user_id),
        "effective_from": effective_from.isoformat(),
        "kcal": body.kcal,
        "protein_g": body.protein_g,
        "carbs_g": body.carbs_g,
        "fat_g": body.fat_g,
    }
    rows = _rows(db.table("user_goals").upsert(row, on_conflict="user_id,effective_from").execute())
    return Goal.model_validate(rows[0])


def effective_goal(goals: Iterable[Goal], day: date) -> Goal | None:
    """The goal with the greatest effective_from <= day (data-model §4.2)."""
    candidates = [g for g in goals if g.effective_from <= day]
    return max(candidates, key=lambda g: g.effective_from, default=None)


# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------


def create_meal(
    db: Client,
    user_id: UUID,
    *,
    meal_type: str,
    eaten_at: datetime,
    local_date: date,
    text_input: str | None,
    photo_path: str | None,
    model_version: str | None,
    prompt_version: str | None,
    status: MealStatus = MealStatus.analyzing,
) -> UUID:
    row = _jsonable(
        {
            "user_id": user_id,
            "status": status,
            "meal_type": meal_type,
            "eaten_at": eaten_at,
            "local_date": local_date,
            "text_input": text_input,
            "photo_path": photo_path,
            "model_version": model_version,
            "prompt_version": prompt_version,
        }
    )
    rows = _rows(db.table("meals").insert(row).execute())
    return UUID(rows[0]["id"])


def update_meal(db: Client, meal_id: UUID, fields: dict[str, Any]) -> None:
    if fields:
        db.table("meals").update(_jsonable(fields)).eq("id", str(meal_id)).execute()


def get_meal(db: Client, meal_id: UUID) -> MealRecord:
    rows = _rows(
        db.table("meals")
        .select(_MEAL_WITH_ITEMS)
        .eq("id", str(meal_id))
        .order("position", foreign_table="meal_items")
        .limit(1)
        .execute()
    )
    if not rows:
        raise AppError(ErrorCode.NOT_FOUND, "Meal not found.", details={"meal_id": str(meal_id)})
    record = MealRecord.model_validate(rows[0])
    record.items.sort(key=lambda i: i.position)
    for item in record.items:
        item.attributes.sort(key=lambda a: (-a.impact_kcal, str(a.id)))
    return record


def list_meals(
    db: Client,
    user_id: UUID,
    date_from: date,
    date_to: date,
    status: MealStatus | None = MealStatus.confirmed,
) -> list[MealRecord]:
    """Meals with local_date in [date_from, date_to], newest first. Items carry totals only."""
    query = (
        db.table("meals")
        .select(_MEAL_WITH_ITEM_TOTALS)
        .eq("user_id", str(user_id))
        .gte("local_date", date_from.isoformat())
        .lte("local_date", date_to.isoformat())
    )
    if status is not None:
        query = query.eq("status", status.value)
    rows = _rows(query.order("eaten_at", desc=True).execute())
    records = [MealRecord.model_validate(_with_item_defaults(r)) for r in rows]
    for record in records:
        record.items.sort(key=lambda i: i.position)
    return records


def _with_item_defaults(row: dict[str, Any]) -> dict[str, Any]:
    """`list_meals` selects a subset of item columns; fill the rest for the record model."""
    filler = {
        "kind": "dish",
        "preparation": None,
        "portion_qty": 1,
        "portion_unit": "serving",
        "portion_grams": 1,
        "source": "ai",
    }
    items = [{**filler, "meal_id": row["id"], **i} for i in row.get("meal_items") or []]
    return {**row, "meal_items": items}


def confirm_meal(db: Client, meal: MealRecord, now: datetime) -> None:
    fields: dict[str, Any] = {"status": MealStatus.confirmed.value}
    if meal.confirmed_at is None:
        fields["confirmed_at"] = now
    update_meal(db, meal.id, fields)


def delete_meal(db: Client, meal_id: UUID) -> None:
    db.table("meals").delete().eq("id", str(meal_id)).execute()


# ---------------------------------------------------------------------------
# Items and uncertain attributes
# ---------------------------------------------------------------------------


def _attribute_row(user_id: UUID, item_id: UUID | str, attr: NewAttribute) -> dict[str, Any]:
    return _jsonable(
        {
            "meal_item_id": item_id,
            "user_id": user_id,
            "attribute": attr.attribute,
            "reason": attr.reason,
            "question": attr.question,
            "options": attr.options,
            "current_option_id": attr.current_option_id,
            "impact_kcal": attr.impact_kcal,
            "asked": attr.asked,
            "status": attr.status,
            "resolution": attr.resolution,
        }
    )


def add_items(db: Client, user_id: UUID, meal_id: UUID, items: Sequence[NewItem]) -> list[UUID]:
    if not items:
        return []
    rows = [
        _jsonable(
            {
                "meal_id": meal_id,
                "user_id": user_id,
                "position": item.position,
                "kind": item.kind,
                "name": item.name,
                "preparation": item.preparation,
                "portion_qty": item.portion.qty,
                "portion_unit": item.portion.unit,
                "portion_grams": item.portion.grams,
                "kcal": item.nutrition.kcal,
                "protein_g": item.nutrition.protein_g,
                "carbs_g": item.nutrition.carbs_g,
                "fat_g": item.nutrition.fat_g,
                "kcal_low": item.kcal_range.low if item.kcal_range else None,
                "kcal_high": item.kcal_range.high if item.kcal_range else None,
                "source": item.source,
                "ai_original": item.ai_original,
            }
        )
        for item in items
    ]
    inserted = _rows(db.table("meal_items").insert(rows).execute())
    by_position = {int(r["position"]): r["id"] for r in inserted}
    attr_rows = [
        _attribute_row(user_id, by_position[item.position], attr)
        for item in items
        for attr in item.attributes
    ]
    if attr_rows:
        db.table("uncertain_attributes").insert(attr_rows).execute()
    return [UUID(by_position[item.position]) for item in items]


def update_item(db: Client, item_id: UUID, fields: dict[str, Any]) -> None:
    if fields:
        db.table("meal_items").update(_jsonable(fields)).eq("id", str(item_id)).execute()


def delete_item(db: Client, item_id: UUID) -> None:
    db.table("meal_items").delete().eq("id", str(item_id)).execute()


def replace_item_attributes(
    db: Client,
    user_id: UUID,
    item_id: UUID,
    attributes: Sequence[NewAttribute],
    keep_ids: Sequence[UUID] = (),
) -> None:
    """Delete the item's attributes (except `keep_ids`) and insert `attributes`."""
    query = db.table("uncertain_attributes").delete().eq("meal_item_id", str(item_id))
    if keep_ids:
        query = query.not_.in_("id", [str(i) for i in keep_ids])
    query.execute()
    if attributes:
        rows = [_attribute_row(user_id, item_id, a) for a in attributes]
        db.table("uncertain_attributes").insert(rows).execute()


def update_attribute(db: Client, attribute_id: UUID, fields: dict[str, Any]) -> None:
    if fields:
        db.table("uncertain_attributes").update(_jsonable(fields)).eq(
            "id", str(attribute_id)
        ).execute()


# ---------------------------------------------------------------------------
# Daily totals (read model for M4 / M5)
# ---------------------------------------------------------------------------


def list_daily_totals(
    db: Client, user_id: UUID, date_from: date, date_to: date
) -> list[DailyTotalsRecord]:
    rows = _rows(
        db.table("daily_totals")
        .select("*")
        .eq("user_id", str(user_id))
        .gte("local_date", date_from.isoformat())
        .lte("local_date", date_to.isoformat())
        .order("local_date")
        .execute()
    )
    return [DailyTotalsRecord.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# Photos (Storage, under the caller's folder; Storage RLS applies)
# ---------------------------------------------------------------------------


def create_photo_url(db: Client, path: str | None) -> str | None:
    if not path:
        return None
    try:
        signed = db.storage.from_(PHOTO_BUCKET).create_signed_url(path, PHOTO_URL_TTL_SECONDS)
    except Exception:  # missing object or storage hiccup: the meal is still usable
        return None
    return signed.get("signedURL") or signed.get("signedUrl")


def create_photo_urls(db: Client, paths: Sequence[str]) -> dict[str, str]:
    if not paths:
        return {}
    try:
        signed = db.storage.from_(PHOTO_BUCKET).create_signed_urls(
            list(paths), PHOTO_URL_TTL_SECONDS
        )
    except Exception:
        return {}
    result: dict[str, str] = {}
    for entry in signed:
        url = entry.get("signedURL") or entry.get("signedUrl")
        if url and not entry.get("error"):
            result[entry["path"]] = url
    return result


def download_photo(db: Client, path: str) -> bytes:
    return db.storage.from_(PHOTO_BUCKET).download(path)


def remove_photo(db: Client, path: str) -> None:
    db.storage.from_(PHOTO_BUCKET).remove([path])


# ---------------------------------------------------------------------------
# Record → API contract
# ---------------------------------------------------------------------------


def to_attribute(a: AttributeRecord) -> UncertainAttribute:
    return UncertainAttribute(
        id=a.id,
        attribute=a.attribute,
        reason=a.reason,
        question=a.question,
        options=a.options,
        current_option_id=a.current_option_id,
        impact_kcal=a.impact_kcal,
        asked=a.asked,
        status=a.status,
        resolution=a.resolution,
    )


def to_item(i: ItemRecord) -> MealItem:
    return MealItem(
        id=i.id,
        position=i.position,
        kind=i.kind,
        name=i.name,
        preparation=i.preparation,
        portion=i.portion,
        nutrition=i.nutrition,
        kcal_range=i.kcal_range,
        source=i.source,
        uncertain_attributes=[to_attribute(a) for a in i.attributes],
        ai_original=i.ai_original,
    )


def to_meal(record: MealRecord, photo_url: str | None) -> Meal:
    return Meal(
        id=record.id,
        status=record.status,
        meal_type=record.meal_type,
        eaten_at=record.eaten_at,
        local_date=record.local_date,
        text_input=record.text_input,
        photo_url=photo_url,
        model_version=record.model_version,
        image_issues=record.image_issues,
        failure_reason=record.failure_reason,
        items=[to_item(i) for i in record.items],
        totals=sum_totals((i.nutrition, i.kcal_range) for i in record.items),
        created_at=record.created_at,
        updated_at=record.updated_at,
        confirmed_at=record.confirmed_at,
    )


def to_summary(record: MealRecord, photo_url: str | None) -> MealSummary:
    return MealSummary(
        id=record.id,
        status=record.status,
        meal_type=record.meal_type,
        eaten_at=record.eaten_at,
        local_date=record.local_date,
        photo_url=photo_url,
        item_names=[i.name for i in record.items],
        totals=sum_totals((i.nutrition, i.kcal_range) for i in record.items),
    )


def load_meal(db: Client, meal_id: UUID) -> Meal:
    """Fetch a meal and return the API contract (with a fresh signed photo URL)."""
    record = get_meal(db, meal_id)
    return to_meal(record, create_photo_url(db, record.photo_path))
