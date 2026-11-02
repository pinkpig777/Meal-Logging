"""Deterministic candidate patterns; historical claims never come from the LLM."""

from dataclasses import dataclass
from uuid import UUID, uuid5

from app.modules.meals.schemas import DailyTotalsRecord
from app.modules.recommendations.schemas import Suggestion, SuggestionEvidence, SuggestionPattern

REQUIRED_DAY_COUNT = 3
LOOKBACK_DAYS = 14
_NAMESPACE = UUID("5b1d3c9e-0f7a-4c55-9a51-6f3f2b8f9d10")
CAVEATS = [
    "Based only on days you logged.",
    "Nutrition values are estimates.",
    "Missing meals can change this pattern; backfill any meals you left out.",
    "Today is excluded because the day is still in progress.",
]


@dataclass(frozen=True)
class Rule:
    metric: str
    label: str
    unit: str
    direction: int  # -1 = below goal, +1 = above goal
    minimum_gap: float
    relative_gap: float
    title: str


# Initial product thresholds, not dietary prescriptions. Tune with usability evaluation.
RULES = (
    Rule("protein_g", "protein", "g", -1, 30, 0.20, "Explore a protein-forward meal or snack"),
    Rule("carbs_g", "carbs", "g", -1, 40, 0.20, "Explore a carbohydrate-forward meal or snack"),
    Rule("fat_g", "fat", "g", 1, 15, 0.20, "Explore a meal with less added fat"),
    Rule("kcal", "calories", "kcal", 1, 300, 0.15, "Explore a meal closer to your calorie goal"),
)


def build_suggestions(
    rows: list[DailyTotalsRecord], meal_ids_by_date: dict[str, list[UUID]]
) -> list[Suggestion]:
    """Rank recurring patterns by frequency, then relative gap, then rule order.

    Each metric needs three logged days with a positive effective goal. At least
    half (and at least two) of those days must meet both gap thresholds. Missing
    dates and goals never become zero, and each row carries its own historical goal.
    """
    ranked: list[tuple[float, float, Suggestion]] = []
    for rule in RULES:
        eligible = [r for r in rows if (getattr(r, f"goal_{rule.metric}") or 0) > 0]
        if len(eligible) < REQUIRED_DAY_COUNT:
            continue
        matches: list[DailyTotalsRecord] = []
        gaps: list[float] = []
        for row in eligible:
            target = float(getattr(row, f"goal_{rule.metric}"))
            gap = rule.direction * (float(getattr(row, rule.metric)) - target)
            if gap >= max(rule.minimum_gap, target * rule.relative_gap):
                matches.append(row)
                gaps.append(gap / target)
        if len(matches) < 2 or len(matches) * 2 < len(eligible):
            continue
        matches.sort(key=lambda r: r.local_date)
        direction = "below" if rule.direction < 0 else "above"
        dates = [r.local_date for r in matches]
        summary = (
            f"On {len(matches)} of your {len(eligible)} logged days with a {rule.label} goal, "
            f"{rule.label} was {direction} your goal by at least {rule.minimum_gap:g} {rule.unit} "
            f"and {rule.relative_gap:.0%}."
        )
        observations = [
            f"{r.local_date.isoformat()}: {getattr(r, rule.metric):.0f} {rule.unit} "
            f"{rule.label} (goal {getattr(r, f'goal_{rule.metric}'):.0f} {rule.unit})"
            for r in matches
        ]
        # Identity changes when the evidence changes, including edits on the same dates.
        identity = f"{rule.metric}:{len(eligible)}:" + "|".join(
            f"{r.local_date}:{getattr(r, rule.metric)}:{getattr(r, f'goal_{rule.metric}')}"
            for r in matches
        )
        suggestion = Suggestion(
            id=uuid5(_NAMESPACE, identity),
            pattern=SuggestionPattern(metric=rule.metric, summary=summary),
            title=rule.title,
            ideas=[],
            evidence=SuggestionEvidence(
                dates=dates,
                meal_ids=list(
                    dict.fromkeys(m for d in dates for m in meal_ids_by_date.get(str(d), []))
                ),
                observations=observations,
            ),
            caveats=list(CAVEATS),
        )
        ranked.append((len(matches) / len(eligible), sum(gaps) / len(gaps), suggestion))
    ranked.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
    return [suggestion for _, _, suggestion in ranked]
