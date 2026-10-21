"""M2 clarification policy: which uncertain attributes become questions (`asked = true`).

Called by M1 during analysis (M1 design §3.1 step 9), before anything is persisted, so M1
never decides which questions to ask.

Baseline: rank every attribute in the meal by `impact_kcal` and ask the top
`MAX_QUESTIONS` whose impact is at least `MIN_IMPACT_KCAL`. Everything else stays a review cue.

TODO(Clark): refine the policy (per-item caps, identity-first ordering, addon handling,
skipping questions the user's text already answered, ...) and document it in the M2 design doc.
"""

from collections.abc import Sequence

from app.modules.meals.schemas import NewItem

MAX_QUESTIONS = 2
MIN_IMPACT_KCAL = 50.0


def select(items: Sequence[NewItem]) -> list[NewItem]:
    """Return copies of `items` with `asked` set on the selected attributes."""
    result = [item.model_copy(deep=True) for item in items]
    ranked = sorted(
        (
            (item_i, attr_i, attr.impact_kcal)
            for item_i, item in enumerate(result)
            for attr_i, attr in enumerate(item.attributes)
        ),
        key=lambda entry: entry[2],
        reverse=True,
    )
    chosen = {
        (item_i, attr_i)
        for item_i, attr_i, impact in ranked[:MAX_QUESTIONS]
        if impact >= MIN_IMPACT_KCAL
    }
    for item_i, item in enumerate(result):
        for attr_i, attr in enumerate(item.attributes):
            attr.asked = (item_i, attr_i) in chosen
    return result
