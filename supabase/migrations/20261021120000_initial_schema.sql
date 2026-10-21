-- Initial schema for Meal Logging.
-- Source of truth: docs/04-data/data-model.md. Never edit this file after it is merged;
-- add a new timestamped migration instead.

-- ---------------------------------------------------------------------------
-- Enumerations (data-model §3)
-- ---------------------------------------------------------------------------

create type public.meal_status as enum ('analyzing', 'draft', 'confirmed', 'failed');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.item_kind as enum ('dish', 'addon');
create type public.item_source as enum ('ai', 'ai_clarified', 'user_edited', 'user_added');
create type public.attribute_kind as enum ('identity', 'portion', 'preparation', 'ingredient');
create type public.resolution_status as enum ('unresolved', 'answered', 'not_sure');
create type public.suggestion_response as enum ('useful', 'not_for_me', 'already_do');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (data-model §4.1)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Chicago',
  dietary_restrictions text[] not null default '{}',
  analysis_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.analysis_model is
  'Chosen analysis model id; null = server default (ADR-0006).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row on first sign-in (ADR-0002).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- user_goals (data-model §4.2) — insert-only history
-- ---------------------------------------------------------------------------

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_from date not null,
  kcal integer not null check (kcal > 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- Updates are only allowed as a same-day replacement (upsert on (user_id, effective_from)):
-- the key columns can never change.
create or replace function public.user_goals_lock_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.effective_from <> old.effective_from then
    raise exception 'user_goals rows are insert-only; only same-day replacement is allowed';
  end if;
  return new;
end;
$$;

create trigger user_goals_lock_keys
  before update on public.user_goals
  for each row execute function public.user_goals_lock_keys();

-- ---------------------------------------------------------------------------
-- meals (data-model §4.3)
-- ---------------------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.meal_status not null default 'analyzing',
  meal_type public.meal_type not null,
  eaten_at timestamptz not null default now(),
  local_date date not null,
  text_input text,
  photo_path text,
  image_issues text[] not null default '{}'
    check (image_issues <@ array['blurry', 'dark', 'partial', 'multiple_meals', 'obstructed']::text[]),
  model_version text,
  prompt_version text,
  analysis_raw jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index meals_user_local_date_idx on public.meals (user_id, local_date);
create index meals_user_status_idx on public.meals (user_id, status);

create trigger meals_set_updated_at
  before update on public.meals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_items (data-model §4.4)
-- ---------------------------------------------------------------------------

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null,
  kind public.item_kind not null,
  name text not null,
  preparation text,
  portion_qty numeric not null check (portion_qty > 0),
  portion_unit text not null,
  portion_grams numeric not null check (portion_grams > 0),
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  kcal_low numeric,
  kcal_high numeric,
  source public.item_source not null,
  ai_original jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kcal_low is null) = (kcal_high is null)),
  check (kcal_low is null or kcal_low <= kcal_high)
);

create index meal_items_meal_id_idx on public.meal_items (meal_id, position);
create index meal_items_user_id_idx on public.meal_items (user_id);

create trigger meal_items_set_updated_at
  before update on public.meal_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- uncertain_attributes (data-model §4.5)
-- ---------------------------------------------------------------------------

create table public.uncertain_attributes (
  id uuid primary key default gen_random_uuid(),
  meal_item_id uuid not null references public.meal_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attribute public.attribute_kind not null,
  reason text not null,
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  current_option_id text not null,
  impact_kcal numeric not null check (impact_kcal >= 0),
  asked boolean not null default false,
  status public.resolution_status not null default 'unresolved',
  resolution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index uncertain_attributes_item_idx on public.uncertain_attributes (meal_item_id);
create index uncertain_attributes_user_id_idx on public.uncertain_attributes (user_id);

create trigger uncertain_attributes_set_updated_at
  before update on public.uncertain_attributes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- suggestion_feedback (data-model §4.6)
-- ---------------------------------------------------------------------------

create table public.suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  suggestion jsonb not null,
  response public.suggestion_response not null,
  created_at timestamptz not null default now()
);

create index suggestion_feedback_user_id_idx on public.suggestion_feedback (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (data-model §8)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.uncertain_attributes enable row level security;
alter table public.suggestion_feedback enable row level security;

-- profiles: id = auth.uid()
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- user_goals: select + insert; update only for the same-day replacement upsert
-- (key columns are locked by trigger); no delete.
create policy user_goals_select_own on public.user_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_goals_insert_own on public.user_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_goals_update_same_day on public.user_goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- meals
create policy meals_select_own on public.meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy meals_insert_own on public.meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meals_update_own on public.meals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy meals_delete_own on public.meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_items: own rows, and the parent meal must be owned by the caller too.
create policy meal_items_select_own on public.meal_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_items_insert_own on public.meal_items
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );
create policy meal_items_update_own on public.meal_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
    )
  );
create policy meal_items_delete_own on public.meal_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- uncertain_attributes: own rows, and the parent item must be owned by the caller too.
create policy uncertain_attributes_select_own on public.uncertain_attributes
  for select to authenticated using (user_id = (select auth.uid()));
create policy uncertain_attributes_insert_own on public.uncertain_attributes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meal_items i
      where i.id = meal_item_id and i.user_id = (select auth.uid())
    )
  );
create policy uncertain_attributes_update_own on public.uncertain_attributes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meal_items i
      where i.id = meal_item_id and i.user_id = (select auth.uid())
    )
  );
create policy uncertain_attributes_delete_own on public.uncertain_attributes
  for delete to authenticated using (user_id = (select auth.uid()));

-- suggestion_feedback
create policy suggestion_feedback_select_own on public.suggestion_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy suggestion_feedback_insert_own on public.suggestion_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy suggestion_feedback_update_own on public.suggestion_feedback
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy suggestion_feedback_delete_own on public.suggestion_feedback
  for delete to authenticated using (user_id = (select auth.uid()));

-- The anon role never needs table access: every API call is made with a user JWT.
revoke all on table
  public.profiles, public.user_goals, public.meals, public.meal_items,
  public.uncertain_attributes, public.suggestion_feedback
  from anon;

-- ---------------------------------------------------------------------------
-- Derived views (data-model §6). security_invoker = true so base-table RLS applies.
-- ---------------------------------------------------------------------------

-- Per-meal totals for every meal (any status). An item without a range contributes
-- its kcal to both bounds.
create view public.meal_totals
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
  coalesce(sum(coalesce(i.kcal_high, i.kcal)), 0) as kcal_high
from public.meals m
left join public.meal_items i on i.meal_id = m.id
group by m.id;

-- Per user x local_date over confirmed meals only, joined to the effective goal
-- (the goal row with the greatest effective_from <= local_date). Only dates with
-- at least one confirmed meal produce rows (absence is not zero).
create view public.daily_totals
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
    sum(mt.kcal_high) as kcal_high
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
  g.fat_g as goal_fat_g
from days d
left join lateral (
  select ug.id, ug.effective_from, ug.kcal, ug.protein_g, ug.carbs_g, ug.fat_g
  from public.user_goals ug
  where ug.user_id = d.user_id and ug.effective_from <= d.local_date
  order by ug.effective_from desc
  limit 1
) g on true;

revoke all on table public.meal_totals, public.daily_totals from anon;
grant select on table public.meal_totals, public.daily_totals to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage (data-model §7): private bucket, path {user_id}/{photo_id}.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy meal_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy meal_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy meal_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy meal_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
