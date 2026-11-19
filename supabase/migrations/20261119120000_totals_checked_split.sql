-- Split kcal by provenance in the derived views (data-model §6).
--   kcal_checked: items the user touched (source ai_clarified, user_edited, user_added)
--   kcal_ai_only: untouched AI items (source ai)
-- Invariant: kcal_checked + kcal_ai_only = kcal. Both columns are appended at the end, so
-- `create or replace view` keeps every existing column, its order, and the grants.

create or replace view public.meal_totals
with (security_invoker = true)
as
select
  m.id as meal_id,
  m.user_id,
  m.status,
  m.local_date,
  count(i.id)::integer as item_count,
  coalesce(sum(i.kcal), 0) as kcal,
  coalesce(sum(i.protein_g), 0) as protein_g,
  coalesce(sum(i.carbs_g), 0) as carbs_g,
  coalesce(sum(i.fat_g), 0) as fat_g,
  coalesce(sum(coalesce(i.kcal_low, i.kcal)), 0) as kcal_low,
  coalesce(sum(coalesce(i.kcal_high, i.kcal)), 0) as kcal_high,
  coalesce(sum(i.kcal) filter (where i.source <> 'ai'), 0) as kcal_checked,
  coalesce(sum(i.kcal) filter (where i.source = 'ai'), 0) as kcal_ai_only
from public.meals m
left join public.meal_items i on i.meal_id = m.id
group by m.id;

create or replace view public.daily_totals
with (security_invoker = true)
as
with days as (
  select
    mt.user_id,
    mt.local_date,
    count(*)::integer as meal_count,
    sum(mt.kcal) as kcal,
    sum(mt.protein_g) as protein_g,
    sum(mt.carbs_g) as carbs_g,
    sum(mt.fat_g) as fat_g,
    sum(mt.kcal_low) as kcal_low,
    sum(mt.kcal_high) as kcal_high,
    sum(mt.kcal_checked) as kcal_checked,
    sum(mt.kcal_ai_only) as kcal_ai_only
  from public.meal_totals mt
  where mt.status = 'confirmed'
  group by mt.user_id, mt.local_date
)
select
  d.user_id,
  d.local_date,
  d.meal_count,
  d.kcal,
  d.protein_g,
  d.carbs_g,
  d.fat_g,
  d.kcal_low,
  d.kcal_high,
  g.id as goal_id,
  g.effective_from as goal_effective_from,
  g.kcal as goal_kcal,
  g.protein_g as goal_protein_g,
  g.carbs_g as goal_carbs_g,
  g.fat_g as goal_fat_g,
  d.kcal_checked,
  d.kcal_ai_only
from days d
left join lateral (
  select ug.id, ug.effective_from, ug.kcal, ug.protein_g, ug.carbs_g, ug.fat_g
  from public.user_goals ug
  where ug.user_id = d.user_id and ug.effective_from <= d.local_date
  order by ug.effective_from desc
  limit 1
) g on true;

-- Grants survive `create or replace`, but restate them so this file is self-describing.
revoke all on table public.meal_totals, public.daily_totals from anon;
grant select on table public.meal_totals, public.daily_totals to authenticated;
