from app.modules.clarification import policy
from app.modules.meals.schemas import NewAttribute, NewItem
from app.schemas import AttributeKind, AttributeOption, ItemKind, ItemSource, Nutrition, Portion


def make_item(impacts: list[float]) -> NewItem:
    n = Nutrition(kcal=100, protein_g=5, carbs_g=10, fat_g=4)
    return NewItem(
        position=0,
        kind=ItemKind.dish,
        name="x",
        preparation=None,
        portion=Portion(qty=1, unit="cup", grams=100),
        nutrition=n,
        kcal_range=None,
        source=ItemSource.ai,
        ai_original=None,
        attributes=[
            NewAttribute(
                attribute=AttributeKind.preparation,
                reason="r",
                question="q",
                options=[AttributeOption(id="a", label="A", nutrition=n, portion=None)],
                current_option_id="a",
                impact_kcal=impact,
            )
            for impact in impacts
        ],
    )


def test_asks_top_two_with_meaningful_impact() -> None:
    items = policy.select([make_item([60, 10]), make_item([300, 120])])
    assert [[a.asked for a in i.attributes] for i in items] == [[False, False], [True, True]]


def test_low_impact_attributes_are_not_asked() -> None:
    items = policy.select([make_item([49, 30])])
    assert not any(a.asked for a in items[0].attributes)


def test_select_does_not_mutate_input() -> None:
    original = make_item([300])
    policy.select([original])
    assert original.attributes[0].asked is False
