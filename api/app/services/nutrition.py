"""Pure nutrition math shared by M1, M2, and M3 (M1 design §3.4–3.5, data-model §4.4).

No I/O here, so every rule is unit-testable.
"""

from collections.abc import Iterable, Sequence

from app.schemas.nutrition import KcalRange, Nutrition, NutritionTotals

ENERGY_TOLERANCE = 0.25  # 4p + 4c + 9f within ±25% of kcal
ENERGY_CHECK_MIN_KCAL = 50.0  # skip the energy check for tiny items
CURRENT_OPTION_TOLERANCE = 0.05  # current option ≈ item nutrition (±5%)
RANGE_MIN_SPREAD_KCAL = 30.0  # range is null when high - low < max(30, 10% of kcal)
RANGE_MIN_SPREAD_FRACTION = 0.10


def energy_from_macros(n: Nutrition) -> float:
    return 4 * n.protein_g + 4 * n.carbs_g + 9 * n.fat_g


def is_energy_consistent(n: Nutrition) -> bool:
    if n.kcal < ENERGY_CHECK_MIN_KCAL:
        return True
    return abs(energy_from_macros(n) - n.kcal) <= ENERGY_TOLERANCE * n.kcal


def _close(a: float, b: float, tolerance: float, abs_floor: float) -> bool:
    return abs(a - b) <= max(abs(b) * tolerance, abs_floor)


def nutrition_matches(
    a: Nutrition, b: Nutrition, tolerance: float = CURRENT_OPTION_TOLERANCE
) -> bool:
    """True when every metric of `a` is within `tolerance` of `b` (with a small absolute floor)."""
    return (
        _close(a.kcal, b.kcal, tolerance, 5.0)
        and _close(a.protein_g, b.protein_g, tolerance, 1.0)
        and _close(a.carbs_g, b.carbs_g, tolerance, 1.0)
        and _close(a.fat_g, b.fat_g, tolerance, 1.0)
    )


def impact_kcal(option_kcals: Sequence[float]) -> float:
    """max − min kcal across an attribute's options (M1 §3.5)."""
    if not option_kcals:
        return 0.0
    return max(option_kcals) - min(option_kcals)


def kcal_range(
    current_kcal: float, attribute_option_kcals: Iterable[Sequence[float]]
) -> KcalRange | None:
    """Estimate range for one item (M1 §3.5).

    `attribute_option_kcals` holds, for each *unresolved* attribute, the kcal of every option.
    Starting at the current kcal, add the most negative and most positive deltas
    (option.kcal − current kcal) of each attribute. Returns None when the spread is below
    max(30 kcal, 10% of current kcal).
    """
    low = high = current_kcal
    for kcals in attribute_option_kcals:
        if not kcals:
            continue
        deltas = [k - current_kcal for k in kcals]
        low += min(0.0, min(deltas))
        high += max(0.0, max(deltas))
    low = max(0.0, low)
    threshold = max(RANGE_MIN_SPREAD_KCAL, RANGE_MIN_SPREAD_FRACTION * current_kcal)
    if high - low < threshold:
        return None
    return KcalRange(low=low, high=high)


def scale_nutrition(n: Nutrition, factor: float) -> Nutrition:
    return Nutrition(
        kcal=n.kcal * factor,
        protein_g=n.protein_g * factor,
        carbs_g=n.carbs_g * factor,
        fat_g=n.fat_g * factor,
    )


def sum_totals(items: Iterable[tuple[Nutrition, KcalRange | None]]) -> NutritionTotals:
    """Meal totals; an item without a range contributes its kcal to both bounds."""
    kcal = protein = carbs = fat = low = high = 0.0
    for n, rng in items:
        kcal += n.kcal
        protein += n.protein_g
        carbs += n.carbs_g
        fat += n.fat_g
        low += rng.low if rng else n.kcal
        high += rng.high if rng else n.kcal
    return NutritionTotals(
        kcal=kcal, protein_g=protein, carbs_g=carbs, fat_g=fat, kcal_low=low, kcal_high=high
    )
