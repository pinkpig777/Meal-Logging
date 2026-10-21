-- Local / demo seed data. Applied by `supabase db reset` after the migrations.
--
-- Creates the dev user used by AUTH_MODE=dev (fixed id 00000000-0000-0000-0000-000000000001,
-- dev@example.com), a goal history, ~a week of confirmed meals relative to today
-- (two days are deliberately left unlogged), and one draft meal with uncertain
-- attributes so the review screen has something to show.
--
-- The dev user can also sign in to the LOCAL stack with email + password
-- (password: dev-password). This is a local-only test credential.

-- ---------------------------------------------------------------------------
-- Dev user (auth.users + identity). The on_auth_user_created trigger creates the profile.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'dev@example.com',
  extensions.crypt('dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Dev User"}',
  now(),
  now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "dev@example.com", "email_verified": true}',
  'email',
  now(),
  now(),
  now()
);

update public.profiles
set display_name = 'Dev User',
    timezone = 'America/Chicago',
    dietary_restrictions = '{}'
where id = '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Goals: an older goal and a newer one, so the effective-goal join can be checked.
-- ---------------------------------------------------------------------------

insert into public.user_goals (user_id, effective_from, kcal, protein_g, carbs_g, fat_g)
values
  ('00000000-0000-0000-0000-000000000001',
   (now() at time zone 'America/Chicago')::date - 30, 2200, 110, 260, 75),
  ('00000000-0000-0000-0000-000000000001',
   (now() at time zone 'America/Chicago')::date - 4, 2000, 130, 220, 65);

-- ---------------------------------------------------------------------------
-- Confirmed meals for the last 9 days (offsets 2 and 5 are unlogged on purpose).
-- Item nutrition is internally consistent (4p + 4c + 9f within ~10% of kcal).
-- ---------------------------------------------------------------------------

do $$
declare
  uid constant uuid := '00000000-0000-0000-0000-000000000001';
  tz constant text := 'America/Chicago';
  today date := (now() at time zone tz)::date;
  menus constant jsonb := '{
    "breakfast": [
      [{"name": "Oatmeal", "kind": "dish", "prep": "cooked", "qty": 1, "unit": "cup", "g": 234, "kcal": 166, "p": 6, "c": 28, "f": 3.6},
       {"name": "Banana", "kind": "dish", "prep": null, "qty": 1, "unit": "piece", "g": 118, "kcal": 105, "p": 1.3, "c": 27, "f": 0.4},
       {"name": "Peanut butter", "kind": "addon", "prep": null, "qty": 1, "unit": "tbsp", "g": 16, "kcal": 94, "p": 4, "c": 3, "f": 8}],
      [{"name": "Scrambled eggs", "kind": "dish", "prep": "scrambled", "qty": 2, "unit": "piece", "g": 100, "kcal": 180, "p": 12, "c": 2, "f": 14},
       {"name": "Whole wheat toast", "kind": "dish", "prep": "toasted", "qty": 2, "unit": "slice", "g": 64, "kcal": 160, "p": 8, "c": 28, "f": 2},
       {"name": "Butter", "kind": "addon", "prep": null, "qty": 1, "unit": "tbsp", "g": 14, "kcal": 100, "p": 0.1, "c": 0, "f": 11.4}],
      [{"name": "Greek yogurt parfait", "kind": "dish", "prep": null, "qty": 1, "unit": "bowl", "g": 250, "kcal": 290, "p": 20, "c": 38, "f": 6},
       {"name": "Coffee with milk", "kind": "dish", "prep": null, "qty": 1, "unit": "cup", "g": 240, "kcal": 40, "p": 2, "c": 4, "f": 1.5}]
    ],
    "lunch": [
      [{"name": "Chicken burrito bowl", "kind": "dish", "prep": null, "qty": 1, "unit": "bowl", "g": 450, "kcal": 650, "p": 42, "c": 70, "f": 20},
       {"name": "Guacamole", "kind": "addon", "prep": null, "qty": 2, "unit": "tbsp", "g": 30, "kcal": 50, "p": 0.6, "c": 2.6, "f": 4.4}],
      [{"name": "Turkey sandwich", "kind": "dish", "prep": null, "qty": 1, "unit": "piece", "g": 230, "kcal": 430, "p": 28, "c": 45, "f": 14},
       {"name": "Apple", "kind": "dish", "prep": null, "qty": 1, "unit": "piece", "g": 182, "kcal": 95, "p": 0.5, "c": 25, "f": 0.3}],
      [{"name": "Chicken Caesar salad", "kind": "dish", "prep": "grilled", "qty": 1, "unit": "bowl", "g": 300, "kcal": 420, "p": 32, "c": 14, "f": 26},
       {"name": "Caesar dressing", "kind": "addon", "prep": null, "qty": 2, "unit": "tbsp", "g": 30, "kcal": 160, "p": 1, "c": 1, "f": 17}]
    ],
    "dinner": [
      [{"name": "Salmon fillet", "kind": "dish", "prep": "grilled", "qty": 1, "unit": "piece", "g": 150, "kcal": 280, "p": 34, "c": 0, "f": 16},
       {"name": "Brown rice", "kind": "dish", "prep": "steamed", "qty": 1, "unit": "cup", "g": 195, "kcal": 218, "p": 4.5, "c": 46, "f": 1.6},
       {"name": "Broccoli", "kind": "dish", "prep": "roasted", "qty": 1, "unit": "cup", "g": 90, "kcal": 80, "p": 3.7, "c": 10, "f": 3.5}],
      [{"name": "Spaghetti with meat sauce", "kind": "dish", "prep": null, "qty": 1.5, "unit": "cup", "g": 375, "kcal": 520, "p": 26, "c": 68, "f": 15},
       {"name": "Garlic bread", "kind": "dish", "prep": "toasted", "qty": 1, "unit": "slice", "g": 50, "kcal": 170, "p": 4, "c": 20, "f": 8}],
      [{"name": "Pepperoni pizza", "kind": "dish", "prep": null, "qty": 2, "unit": "slice", "g": 214, "kcal": 600, "p": 26, "c": 68, "f": 24},
       {"name": "Side salad", "kind": "dish", "prep": null, "qty": 1, "unit": "bowl", "g": 100, "kcal": 25, "p": 1.5, "c": 4.5, "f": 0.3},
       {"name": "Ranch dressing", "kind": "addon", "prep": null, "qty": 2, "unit": "tbsp", "g": 30, "kcal": 130, "p": 0.4, "c": 1.8, "f": 13.4}]
    ],
    "snack": [
      [{"name": "Protein bar", "kind": "dish", "prep": null, "qty": 1, "unit": "piece", "g": 60, "kcal": 210, "p": 20, "c": 22, "f": 7}],
      [{"name": "Almonds", "kind": "dish", "prep": "raw", "qty": 0.25, "unit": "cup", "g": 35, "kcal": 205, "p": 7.5, "c": 7.5, "f": 17.5}]
    ]
  }';
  times constant jsonb := '{"breakfast": "08:00", "lunch": "12:30", "snack": "15:30", "dinner": "19:00"}';
  off integer;
  mt text;
  variant jsonb;
  v_meal_id uuid;
  eaten timestamptz;
  item jsonb;
  pos integer;
begin
  foreach off in array array[0, 1, 3, 4, 6, 7, 8] loop
    foreach mt in array array['breakfast', 'lunch', 'snack', 'dinner'] loop
      -- Today only has breakfast and lunch; snacks on every other day.
      continue when off = 0 and mt in ('snack', 'dinner');
      continue when mt = 'snack' and off % 2 = 1;

      variant := menus -> mt -> ((off + length(mt)) % jsonb_array_length(menus -> mt));
      eaten := ((today - off) + (times ->> mt)::time) at time zone tz;

      insert into public.meals (
        user_id, status, meal_type, eaten_at, local_date, text_input,
        model_version, prompt_version, created_at, confirmed_at
      ) values (
        uid, 'confirmed', mt::public.meal_type, eaten, today - off, null,
        'fixture', 'analyze_meal.v1', eaten, eaten + interval '5 minutes'
      )
      returning id into v_meal_id;

      pos := 0;
      for item in select value from jsonb_array_elements(variant) loop
        insert into public.meal_items (
          meal_id, user_id, position, kind, name, preparation,
          portion_qty, portion_unit, portion_grams,
          kcal, protein_g, carbs_g, fat_g, kcal_low, kcal_high, source, ai_original
        ) values (
          v_meal_id, uid, pos, (item ->> 'kind')::public.item_kind, item ->> 'name', item ->> 'prep',
          (item ->> 'qty')::numeric, item ->> 'unit', (item ->> 'g')::numeric,
          (item ->> 'kcal')::numeric, (item ->> 'p')::numeric, (item ->> 'c')::numeric,
          (item ->> 'f')::numeric, null, null, 'ai',
          jsonb_build_object(
            'name', item ->> 'name',
            'kind', item ->> 'kind',
            'preparation', item -> 'prep',
            'portion', jsonb_build_object(
              'qty', (item ->> 'qty')::numeric, 'unit', item ->> 'unit', 'grams', (item ->> 'g')::numeric),
            'nutrition', jsonb_build_object(
              'kcal', (item ->> 'kcal')::numeric, 'protein_g', (item ->> 'p')::numeric,
              'carbs_g', (item ->> 'c')::numeric, 'fat_g', (item ->> 'f')::numeric),
            'uncertain_attributes', '[]'::jsonb
          )
        );
        pos := pos + 1;
      end loop;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- One draft meal (today's dinner) with uncertain attributes, for the review screen.
-- ---------------------------------------------------------------------------

insert into public.meals (
  id, user_id, status, meal_type, eaten_at, local_date, text_input,
  model_version, prompt_version
) values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000001',
  'draft',
  'dinner',
  ((now() at time zone 'America/Chicago')::date + time '18:45') at time zone 'America/Chicago',
  (now() at time zone 'America/Chicago')::date,
  'chicken and rice',
  'fixture',
  'analyze_meal.v1'
);

insert into public.meal_items (
  id, meal_id, user_id, position, kind, name, preparation, portion_qty, portion_unit,
  portion_grams, kcal, protein_g, carbs_g, fat_g, kcal_low, kcal_high, source, ai_original
) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000001', 0, 'dish', 'Chicken breast', 'grilled',
   1, 'piece', 170, 280, 52, 0, 6, 280, 420, 'ai', null),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000001', 1, 'dish', 'White rice', 'steamed',
   1, 'cup', 158, 205, 4.3, 45, 0.4, 103, 410, 'ai', null);

insert into public.uncertain_attributes (
  meal_item_id, user_id, attribute, reason, question, options, current_option_id,
  impact_kcal, asked, status
) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001',
   'preparation', 'Cooking method is hard to tell from the photo',
   'How was the chicken cooked?',
   '[{"id": "grilled", "label": "Grilled", "nutrition": {"kcal": 280, "protein_g": 52, "carbs_g": 0, "fat_g": 6}, "portion": null},
     {"id": "fried", "label": "Fried", "nutrition": {"kcal": 420, "protein_g": 48, "carbs_g": 14, "fat_g": 19}, "portion": null}]',
   'grilled', 140, true, 'unresolved'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001',
   'portion', 'Scale is unclear from one photo',
   'About how much rice did you eat?',
   '[{"id": "half_cup", "label": "½ cup", "nutrition": {"kcal": 103, "protein_g": 2.2, "carbs_g": 22.5, "fat_g": 0.2}, "portion": {"qty": 0.5, "unit": "cup", "grams": 79}},
     {"id": "one_cup", "label": "1 cup", "nutrition": {"kcal": 205, "protein_g": 4.3, "carbs_g": 45, "fat_g": 0.4}, "portion": {"qty": 1, "unit": "cup", "grams": 158}},
     {"id": "two_cups", "label": "2 cups", "nutrition": {"kcal": 410, "protein_g": 8.6, "carbs_g": 90, "fat_g": 0.8}, "portion": {"qty": 2, "unit": "cup", "grams": 316}}]',
   'one_cup', 307, true, 'unresolved');
