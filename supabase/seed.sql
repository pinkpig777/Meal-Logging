-- Local / demo seed data. Applied by `supabase db reset` after the migrations.
--
-- Creates the dev user used by AUTH_MODE=dev (fixed id 00000000-0000-0000-0000-000000000001,
-- dev@example.com), a goal history (the goal changed 17 days ago), 42 days of confirmed
-- meals relative to today (five days deliberately left unlogged, heavier weekends, a mix of
-- AI-only and user-checked items), and one draft meal for today's dinner with uncertain
-- attributes so the review screen has something to show. Everything is deterministic.
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
-- Goals: the goal changed 17 days ago, so "each day vs. that day's goal" is visible.
-- ---------------------------------------------------------------------------

insert into public.user_goals (user_id, effective_from, kcal, protein_g, carbs_g, fat_g)
values
  ('00000000-0000-0000-0000-000000000001',
   (now() at time zone 'America/Chicago')::date - 43, 2200, 130, 260, 70),
  ('00000000-0000-0000-0000-000000000001',
   (now() at time zone 'America/Chicago')::date - 17, 2000, 150, 205, 65);

-- ---------------------------------------------------------------------------
-- 42 days of confirmed meals (offsets 0..41 from today), fully deterministic.
--
-- * Unlogged days (no meals): offsets 37, 30, 22, 21, 9.
-- * Day target = that day's goal x a percentage derived from the offset:
--   weekdays 85-110%, Saturdays/Sundays 110-140%, and three light weekdays at 60-80%
--   (the first weekday at or after offsets 3, 15, and 27).
--   Today (offset 0) has breakfast + lunch only, unscaled; dinner is the draft below.
-- * Meals are picked from the menu templates below and every item is scaled by one factor
--   per day, so the day's items sum to the target. Macros stay physically consistent
--   (4p + 4c + 9f within ~10% of kcal); the block checks this and fails loudly otherwise.
-- * Provenance: per day, a share of items stays `ai` (with ranges and unresolved uncertain
--   attributes); the rest become `ai_clarified` (answered attribute, no range),
--   `user_edited` (ai_original differs), or `user_added` (add-ons, no ai_original).
--
-- Menu item keys: n name, k kind, pr preparation, q/u/g portion qty/unit/grams,
-- e [kcal, protein_g, carbs_g, fat_g], a uncertain attribute template:
--   t attribute kind, r reason, qn question, cur current option, guess the AI's first pick
--   (used when the item is seeded as clarified), o options with m (multiplier, default 1)
--   and dp/dc/df (gram deltas for protein/carbs/fat).
-- ---------------------------------------------------------------------------

do $$
declare
  uid constant uuid := '00000000-0000-0000-0000-000000000001';
  tz constant text := 'America/Chicago';
  today constant date := (now() at time zone 'America/Chicago')::date;
  unlogged constant integer[] := array[37, 30, 22, 21, 9];
  light integer[];
  -- Share of items (out of 10) that stay `ai`, cycling by offset.
  ai_share constant integer[] := array[6, 6, 5, 7, 3, 8, 4];
  menus constant jsonb := $json$
{
  "breakfast": [
    {"d": "oatmeal with banana and peanut butter", "i": [
      {"n": "Oatmeal", "k": "dish", "pr": "cooked", "q": 1, "u": "cup", "g": 234, "e": [166, 6, 28, 3.6]},
      {"n": "Banana", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 118, "e": [105, 1.3, 27, 0.4]},
      {"n": "Peanut butter", "k": "addon", "pr": null, "q": 1, "u": "tbsp", "g": 16, "e": [94, 4, 3, 8],
       "a": {"t": "portion", "r": "The spoonful size is hard to judge", "qn": "How much peanut butter did you add?", "cur": "one_tbsp", "guess": "two_tbsp",
             "o": [{"id": "one_tbsp", "l": "1 tbsp"}, {"id": "two_tbsp", "l": "2 tbsp", "m": 2}]}}]},
    {"d": "scrambled eggs, toast, coffee", "i": [
      {"n": "Scrambled eggs", "k": "dish", "pr": "scrambled", "q": 2, "u": "piece", "g": 110, "e": [200, 13, 2, 15.5],
       "a": {"t": "preparation", "r": "Cooking fat is not visible", "qn": "What were the eggs cooked in?", "cur": "oil", "guess": "butter",
             "o": [{"id": "none", "l": "No added fat", "df": -5}, {"id": "oil", "l": "A little oil"}, {"id": "butter", "l": "Butter", "df": 6}]}},
      {"n": "Whole wheat toast", "k": "dish", "pr": "toasted", "q": 2, "u": "slice", "g": 64, "e": [160, 8, 28, 2]},
      {"n": "Coffee with milk", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [40, 2, 4, 1.5]}]},
    {"d": "greek yogurt parfait and iced latte", "i": [
      {"n": "Greek yogurt parfait", "k": "dish", "pr": null, "q": 1, "u": "bowl", "g": 250, "e": [290, 20, 38, 6],
       "a": {"t": "ingredient", "r": "Granola amount is hard to see under the fruit", "qn": "How much granola was in it?", "cur": "some", "guess": "lots",
             "o": [{"id": "none", "l": "No granola", "dc": -20, "df": -3}, {"id": "some", "l": "A little"}, {"id": "lots", "l": "A lot", "dc": 20, "df": 4}]}},
      {"n": "Blueberries", "k": "addon", "pr": null, "q": 0.5, "u": "cup", "g": 74, "e": [42, 0.5, 11, 0.2]},
      {"n": "Iced latte", "k": "dish", "pr": null, "q": 12, "u": "oz", "g": 355, "e": [130, 7, 11, 7]}]},
    {"d": "avocado toast with a fried egg, orange juice", "i": [
      {"n": "Avocado toast", "k": "dish", "pr": "toasted", "q": 1, "u": "slice", "g": 140, "e": [280, 8, 26, 17],
       "a": {"t": "portion", "r": "Avocado layer thickness varies a lot", "qn": "How much avocado was on the toast?", "cur": "half", "guess": "whole",
             "o": [{"id": "quarter", "l": "About ¼ avocado", "dc": -3, "df": -5.5}, {"id": "half", "l": "About ½ avocado"}, {"id": "whole", "l": "A whole avocado", "dp": 2, "dc": 6, "df": 11}]}},
      {"n": "Fried egg", "k": "addon", "pr": "fried", "q": 1, "u": "piece", "g": 50, "e": [90, 6, 0.4, 7]},
      {"n": "Orange juice", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 248, "e": [110, 1.7, 26, 0.5]}]},
    {"d": "bagel with cream cheese and coffee", "i": [
      {"n": "Plain bagel", "k": "dish", "pr": "toasted", "q": 1, "u": "piece", "g": 105, "e": [280, 11, 55, 1.7]},
      {"n": "Cream cheese", "k": "addon", "pr": null, "q": 2, "u": "tbsp", "g": 30, "e": [100, 1.8, 1.6, 9.8],
       "a": {"t": "portion", "r": "Spread is partly hidden by the bagel top", "qn": "How much cream cheese was on it?", "cur": "two_tbsp", "guess": "one_tbsp",
             "o": [{"id": "one_tbsp", "l": "1 tbsp", "m": 0.5}, {"id": "two_tbsp", "l": "2 tbsp"}, {"id": "three_tbsp", "l": "3 tbsp", "m": 1.5}]}},
      {"n": "Coffee with milk", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [40, 2, 4, 1.5]}]},
    {"d": "breakfast burrito and coffee", "i": [
      {"n": "Breakfast burrito", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 250, "e": [520, 24, 48, 25],
       "a": {"t": "ingredient", "r": "The filling is wrapped and not visible", "qn": "What meat was in the burrito?", "cur": "bacon", "guess": "sausage",
             "o": [{"id": "veggie", "l": "No meat", "dp": -8, "df": -9}, {"id": "bacon", "l": "Bacon"}, {"id": "sausage", "l": "Sausage", "dp": 2, "df": 6}]}},
      {"n": "Coffee with milk", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [40, 2, 4, 1.5]}]}
  ],
  "breakfast_we": [
    {"d": "pancakes with syrup and bacon", "i": [
      {"n": "Buttermilk pancakes", "k": "dish", "pr": null, "q": 3, "u": "piece", "g": 230, "e": [520, 12, 80, 16]},
      {"n": "Maple syrup", "k": "addon", "pr": null, "q": 2, "u": "tbsp", "g": 40, "e": [105, 0, 27, 0],
       "a": {"t": "portion", "r": "Syrup soaks in, so the amount is hard to see", "qn": "About how much syrup did you use?", "cur": "two_tbsp", "guess": "four_tbsp",
             "o": [{"id": "one_tbsp", "l": "1 tbsp", "m": 0.5}, {"id": "two_tbsp", "l": "2 tbsp"}, {"id": "four_tbsp", "l": "¼ cup", "m": 2}]}},
      {"n": "Bacon", "k": "addon", "pr": "pan-fried", "q": 3, "u": "slice", "g": 24, "e": [130, 9, 0.3, 10]}]},
    {"d": "eggs benedict with hash browns", "i": [
      {"n": "Eggs Benedict", "k": "dish", "pr": "poached", "q": 2, "u": "piece", "g": 280, "e": [560, 26, 30, 38],
       "a": {"t": "ingredient", "r": "Sauce amount is hard to judge from the photo", "qn": "How much hollandaise was on it?", "cur": "regular", "guess": "extra",
             "o": [{"id": "light", "l": "A drizzle", "df": -8}, {"id": "regular", "l": "Regular"}, {"id": "extra", "l": "Extra sauce", "df": 10}]}},
      {"n": "Hash browns", "k": "dish", "pr": "pan-fried", "q": 1, "u": "cup", "g": 150, "e": [265, 3, 32, 14]}]},
    {"d": "sausage egg croissant and caramel latte", "i": [
      {"n": "Sausage, egg, and cheese croissant", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 160, "e": [520, 20, 30, 35]},
      {"n": "Iced caramel latte", "k": "dish", "pr": null, "q": 16, "u": "oz", "g": 473, "e": [250, 9, 35, 8],
       "a": {"t": "ingredient", "r": "Milk type is not visible", "qn": "What milk was in the latte?", "cur": "whole", "guess": "oat",
             "o": [{"id": "skim", "l": "Skim", "df": -7}, {"id": "whole", "l": "Whole milk"}, {"id": "oat", "l": "Oat milk", "dc": 6, "df": 1}]}}]}
  ],
  "lunch": [
    {"d": "chicken burrito bowl with guac", "i": [
      {"n": "Chicken burrito bowl", "k": "dish", "pr": null, "q": 1, "u": "bowl", "g": 480, "e": [660, 44, 72, 20],
       "a": {"t": "ingredient", "r": "Toppings are mixed in and hard to tell apart", "qn": "Which toppings were in the bowl?", "cur": "cheese", "guess": "both",
             "o": [{"id": "neither", "l": "No cheese or sour cream", "dp": -6, "dc": -2, "df": -12}, {"id": "cheese", "l": "Cheese only"}, {"id": "both", "l": "Cheese and sour cream", "dp": 1, "dc": 2, "df": 5}]}},
      {"n": "Guacamole", "k": "addon", "pr": null, "q": 2, "u": "tbsp", "g": 30, "e": [50, 0.6, 2.6, 4.4]}]},
    {"d": "turkey sandwich, apple, chips", "i": [
      {"n": "Turkey sandwich", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 230, "e": [430, 28, 45, 14],
       "a": {"t": "ingredient", "r": "Spreads inside the sandwich are not visible", "qn": "Was there mayo on the sandwich?", "cur": "light", "guess": "regular",
             "o": [{"id": "none", "l": "No mayo", "df": -5}, {"id": "light", "l": "A little"}, {"id": "regular", "l": "A full spread", "df": 6}]}},
      {"n": "Apple", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 182, "e": [95, 0.5, 22, 0.3]},
      {"n": "Kettle chips", "k": "addon", "pr": null, "q": 1, "u": "bag", "g": 28, "e": [150, 2, 15, 9]}]},
    {"d": "chicken caesar salad with a roll", "i": [
      {"n": "Chicken Caesar salad", "k": "dish", "pr": "grilled", "q": 1, "u": "bowl", "g": 320, "e": [470, 36, 14, 30],
       "a": {"t": "ingredient", "r": "Dressing is mixed into the greens", "qn": "How much dressing was on the salad?", "cur": "regular", "guess": "heavy",
             "o": [{"id": "light", "l": "Light", "df": -8}, {"id": "regular", "l": "Regular"}, {"id": "heavy", "l": "Heavy", "df": 10}]}},
      {"n": "Bread roll", "k": "addon", "pr": null, "q": 1, "u": "piece", "g": 40, "e": [110, 3.5, 20, 1.5]}]},
    {"d": "sukiyaki beef bowl and miso soup", "i": [
      {"n": "Sukiyaki beef bowl", "k": "dish", "pr": "simmered", "q": 1, "u": "bowl", "g": 450, "e": [720, 30, 95, 23],
       "a": {"t": "portion", "r": "Bowl size is unclear from one photo", "qn": "Which size was the bowl?", "cur": "regular", "guess": "large",
             "o": [{"id": "small", "l": "Small", "m": 0.75}, {"id": "regular", "l": "Regular"}, {"id": "large", "l": "Large", "m": 1.35}]}},
      {"n": "Miso soup", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [40, 3, 5, 1.2]}]},
    {"d": "chicken rice bowl", "i": [
      {"n": "Chicken rice bowl", "k": "dish", "pr": "grilled", "q": 1, "u": "bowl", "g": 450, "e": [650, 42, 80, 15],
       "a": {"t": "portion", "r": "Rice is partly hidden under the chicken", "qn": "How much rice was in the bowl?", "cur": "regular", "guess": "light",
             "o": [{"id": "light", "l": "About ½ cup", "dp": -2, "dc": -22}, {"id": "regular", "l": "About 1 cup"}, {"id": "extra", "l": "About 1½ cups", "dp": 2, "dc": 22}]}}]},
    {"d": "beef pho with spring rolls", "i": [
      {"n": "Beef pho", "k": "dish", "pr": null, "q": 1, "u": "bowl", "g": 700, "e": [520, 32, 65, 12]},
      {"n": "Fresh spring rolls", "k": "addon", "pr": null, "q": 2, "u": "piece", "g": 120, "e": [120, 5, 20, 2]}]},
    {"d": "mediterranean chicken wrap and greek salad", "i": [
      {"n": "Mediterranean chicken wrap", "k": "dish", "pr": null, "q": 1, "u": "piece", "g": 280, "e": [590, 38, 52, 24],
       "a": {"t": "ingredient", "r": "Sauce inside the wrap is not visible", "qn": "Was there tzatziki or hummus inside?", "cur": "tzatziki", "guess": "hummus",
             "o": [{"id": "none", "l": "Neither", "dp": -1, "dc": -2, "df": -4}, {"id": "tzatziki", "l": "Tzatziki"}, {"id": "hummus", "l": "Hummus", "dp": 2, "dc": 6, "df": 4}]}},
      {"n": "Greek salad", "k": "dish", "pr": null, "q": 1, "u": "bowl", "g": 150, "e": [150, 4, 8, 12]}]}
  ],
  "dinner": [
    {"d": "salmon, brown rice, broccoli", "i": [
      {"n": "Salmon fillet", "k": "dish", "pr": "grilled", "q": 1, "u": "piece", "g": 170, "e": [350, 38, 0, 22],
       "a": {"t": "preparation", "r": "Cooking fat is not visible", "qn": "How was the salmon cooked?", "cur": "oil", "guess": "butter",
             "o": [{"id": "plain", "l": "Baked, no added fat", "df": -6}, {"id": "oil", "l": "With a little oil"}, {"id": "butter", "l": "Butter-basted", "df": 8}]}},
      {"n": "Brown rice", "k": "dish", "pr": "steamed", "q": 1, "u": "cup", "g": 195, "e": [218, 4.5, 46, 1.6],
       "a": {"t": "portion", "r": "Scale is unclear from one photo", "qn": "About how much rice did you eat?", "cur": "one_cup", "guess": "half_cup",
             "o": [{"id": "half_cup", "l": "½ cup", "m": 0.5}, {"id": "one_cup", "l": "1 cup"}, {"id": "one_half_cups", "l": "1½ cups", "m": 1.5}]}},
      {"n": "Broccoli", "k": "dish", "pr": "roasted", "q": 1, "u": "cup", "g": 90, "e": [80, 3.7, 10, 3.5]}]},
    {"d": "spaghetti with meat sauce and garlic bread", "i": [
      {"n": "Spaghetti with meat sauce", "k": "dish", "pr": null, "q": 1.5, "u": "cup", "g": 375, "e": [560, 28, 70, 18],
       "a": {"t": "portion", "r": "Pasta piles make the amount hard to judge", "qn": "About how much pasta did you eat?", "cur": "one_half", "guess": "one",
             "o": [{"id": "one", "l": "1 cup", "m": 0.67}, {"id": "one_half", "l": "1½ cups"}, {"id": "two", "l": "2 cups", "m": 1.33}]}},
      {"n": "Garlic bread", "k": "addon", "pr": "toasted", "q": 1, "u": "slice", "g": 50, "e": [170, 4, 20, 8]}]},
    {"d": "chicken stir-fry with rice", "i": [
      {"n": "Chicken and vegetable stir-fry", "k": "dish", "pr": "stir-fried", "q": 1.5, "u": "cup", "g": 330, "e": [420, 34, 18, 22],
       "a": {"t": "preparation", "r": "Oil amount is hard to see", "qn": "How oily was the stir-fry?", "cur": "typical", "guess": "heavy",
             "o": [{"id": "light", "l": "Lightly oiled", "df": -7}, {"id": "typical", "l": "Typical"}, {"id": "heavy", "l": "Glossy / oily", "df": 9}]}},
      {"n": "White rice", "k": "dish", "pr": "steamed", "q": 1, "u": "cup", "g": 158, "e": [205, 4.3, 45, 0.4]}]},
    {"d": "beef tacos with mexican rice", "i": [
      {"n": "Beef tacos", "k": "dish", "pr": null, "q": 3, "u": "piece", "g": 270, "e": [600, 33, 45, 32],
       "a": {"t": "ingredient", "r": "Tortilla type is hard to tell", "qn": "What kind of tortillas were they?", "cur": "corn", "guess": "flour",
             "o": [{"id": "corn", "l": "Corn"}, {"id": "flour", "l": "Flour", "dp": 3, "dc": 12, "df": 6}, {"id": "hard", "l": "Hard shell", "dc": 3, "df": 7}]}},
      {"n": "Mexican rice", "k": "dish", "pr": null, "q": 0.5, "u": "cup", "g": 100, "e": [130, 2.5, 25, 2.5]}]},
    {"d": "chicken tikka masala, rice, naan", "i": [
      {"n": "Chicken tikka masala", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [440, 32, 14, 28],
       "a": {"t": "ingredient", "r": "Cream content of the sauce is unclear", "qn": "How creamy was the sauce?", "cur": "regular", "guess": "rich",
             "o": [{"id": "light", "l": "Light, tomato-based", "df": -10}, {"id": "regular", "l": "Regular"}, {"id": "rich", "l": "Very creamy", "dp": 1, "df": 12}]}},
      {"n": "Basmati rice", "k": "dish", "pr": "steamed", "q": 1, "u": "cup", "g": 160, "e": [210, 4.4, 46, 0.5]},
      {"n": "Naan", "k": "addon", "pr": null, "q": 0.5, "u": "piece", "g": 45, "e": [130, 4.5, 22, 3]}]},
    {"d": "shrimp fried rice and egg drop soup", "i": [
      {"n": "Shrimp fried rice", "k": "dish", "pr": "stir-fried", "q": 1.5, "u": "cup", "g": 330, "e": [560, 22, 72, 20],
       "a": {"t": "portion", "r": "Takeout container depth is hard to judge", "qn": "About how much fried rice did you eat?", "cur": "one_half", "guess": "two",
             "o": [{"id": "one", "l": "1 cup", "m": 0.67}, {"id": "one_half", "l": "1½ cups"}, {"id": "two", "l": "2 cups", "m": 1.33}]}},
      {"n": "Egg drop soup", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 240, "e": [65, 3, 7, 2.5]}]},
    {"d": "grilled chicken, sweet potato, green beans", "i": [
      {"n": "Grilled chicken breast", "k": "dish", "pr": "grilled", "q": 1, "u": "piece", "g": 170, "e": [280, 52, 0, 6.5]},
      {"n": "Baked sweet potato", "k": "dish", "pr": "baked", "q": 1, "u": "piece", "g": 150, "e": [135, 3, 31, 0.2]},
      {"n": "Green beans", "k": "dish", "pr": "sautéed", "q": 1, "u": "cup", "g": 125, "e": [70, 2, 8, 3.5]},
      {"n": "Dinner roll with butter", "k": "addon", "pr": null, "q": 1, "u": "piece", "g": 45, "e": [150, 4, 19, 6.5]}]}
  ],
  "dinner_we": [
    {"d": "pepperoni pizza and garlic knots", "i": [
      {"n": "Pepperoni pizza", "k": "dish", "pr": null, "q": 3, "u": "slice", "g": 320, "e": [900, 39, 102, 36],
       "a": {"t": "portion", "r": "Only part of the pizza is in the photo", "qn": "How many slices did you have?", "cur": "three", "guess": "two",
             "o": [{"id": "two", "l": "2 slices", "m": 0.67}, {"id": "three", "l": "3 slices"}, {"id": "four", "l": "4 slices", "m": 1.33}]}},
      {"n": "Garlic knots", "k": "addon", "pr": "baked", "q": 2, "u": "piece", "g": 60, "e": [200, 6, 30, 6]}]},
    {"d": "tonkotsu ramen with gyoza", "i": [
      {"n": "Tonkotsu ramen", "k": "dish", "pr": null, "q": 1, "u": "bowl", "g": 650, "e": [890, 38, 90, 40],
       "a": {"t": "portion", "r": "Broth left in the bowl is unknown", "qn": "How much of the broth did you drink?", "cur": "half", "guess": "all",
             "o": [{"id": "little", "l": "Very little", "df": -15}, {"id": "half", "l": "About half"}, {"id": "all", "l": "All of it", "df": 12}]}},
      {"n": "Pork gyoza", "k": "addon", "pr": "pan-fried", "q": 3, "u": "piece", "g": 75, "e": [190, 8, 20, 8.5]}]},
    {"d": "cheeseburger and fries", "i": [
      {"n": "Cheeseburger", "k": "dish", "pr": "grilled", "q": 1, "u": "piece", "g": 240, "e": [720, 38, 42, 44]},
      {"n": "French fries", "k": "dish", "pr": "deep-fried", "q": 1, "u": "serving", "g": 117, "e": [365, 4, 48, 17],
       "a": {"t": "portion", "r": "Fry container size is unclear", "qn": "What size were the fries?", "cur": "medium", "guess": "large",
             "o": [{"id": "small", "l": "Small", "m": 0.63}, {"id": "medium", "l": "Medium"}, {"id": "large", "l": "Large", "m": 1.37}]}}]},
    {"d": "bulgogi with rice and japchae", "i": [
      {"n": "Beef bulgogi", "k": "dish", "pr": "grilled", "q": 1.5, "u": "cup", "g": 250, "e": [560, 40, 22, 34],
       "a": {"t": "preparation", "r": "Marinade sweetness and oil are hard to judge", "qn": "How saucy was the bulgogi?", "cur": "regular", "guess": "saucy",
             "o": [{"id": "lean", "l": "Lean, little sauce", "dc": -8, "df": -8}, {"id": "regular", "l": "Regular"}, {"id": "saucy", "l": "Very saucy", "dc": 10, "df": 6}]}},
      {"n": "White rice", "k": "dish", "pr": "steamed", "q": 1, "u": "cup", "g": 158, "e": [205, 4.3, 45, 0.4]},
      {"n": "Japchae", "k": "dish", "pr": "stir-fried", "q": 1, "u": "cup", "g": 150, "e": [290, 6, 46, 9]}]}
  ],
  "snack": [
    {"d": "protein bar", "i": [
      {"n": "Protein bar", "k": "dish", "pr": null, "q": 1, "u": "bar", "g": 60, "e": [210, 20, 20, 7]}]},
    {"d": "almonds", "i": [
      {"n": "Almonds", "k": "dish", "pr": "raw", "q": 0.25, "u": "cup", "g": 35, "e": [205, 7.5, 7.5, 17.5],
       "a": {"t": "portion", "r": "A handful varies a lot in size", "qn": "About how many almonds did you eat?", "cur": "quarter", "guess": "half",
             "o": [{"id": "small", "l": "A small handful", "m": 0.5}, {"id": "quarter", "l": "About ¼ cup"}, {"id": "half", "l": "About ½ cup", "m": 2}]}}]},
    {"d": "apple with peanut butter", "i": [
      {"n": "Apple", "k": "dish", "pr": "sliced", "q": 1, "u": "piece", "g": 182, "e": [95, 0.5, 22, 0.3]},
      {"n": "Peanut butter", "k": "addon", "pr": null, "q": 2, "u": "tbsp", "g": 32, "e": [190, 8, 6, 16]}]},
    {"d": "hummus and pita chips", "i": [
      {"n": "Hummus with pita chips", "k": "dish", "pr": null, "q": 1, "u": "serving", "g": 70, "e": [230, 6, 26, 11]}]},
    {"d": "greek yogurt", "i": [
      {"n": "Greek yogurt cup", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 150, "e": [150, 15, 15, 3.5]}]}
  ],
  "snack_we": [
    {"d": "brown sugar boba milk tea", "i": [
      {"n": "Brown sugar boba milk tea", "k": "dish", "pr": null, "q": 24, "u": "oz", "g": 650, "e": [470, 5, 85, 13],
       "a": {"t": "ingredient", "r": "Sugar level cannot be seen", "qn": "What sugar level did you order?", "cur": "full", "guess": "half",
             "o": [{"id": "quarter", "l": "25% sugar", "dc": -36}, {"id": "half", "l": "50% sugar", "dc": -24}, {"id": "full", "l": "100% sugar"}]}}]},
    {"d": "chocolate chip cookies", "i": [
      {"n": "Chocolate chip cookies", "k": "dish", "pr": "baked", "q": 2, "u": "piece", "g": 60, "e": [290, 3, 38, 14],
       "a": {"t": "portion", "r": "Cookie size is hard to judge", "qn": "How big were the cookies?", "cur": "medium", "guess": "large",
             "o": [{"id": "small", "l": "Small", "m": 0.7}, {"id": "medium", "l": "Medium"}, {"id": "large", "l": "Bakery-size", "m": 1.6}]}}]},
    {"d": "ice cream", "i": [
      {"n": "Vanilla ice cream", "k": "dish", "pr": null, "q": 1, "u": "cup", "g": 132, "e": [275, 4.6, 31, 14.5]}]}
  ]
}
$json$;
  slot_times constant jsonb :=
    '{"breakfast": "07:40", "lunch": "12:05", "snack": "15:20", "dinner": "18:35"}';
  off integer;
  d date;
  is_we boolean;
  goal_kcal numeric;
  pct numeric;
  slots text[];
  pool jsonb;
  chosen jsonb;
  base numeric;
  f numeric;
  si integer;
  meal jsonb;
  mt text;
  eaten timestamptz;
  v_meal_id uuid;
  v_item_id uuid;
  pos integer;
  it jsonb;
  attr jsonb;
  step numeric;
  q numeric; g numeric; kc numeric; p numeric; c numeric; fa numeric;
  src text;
  opts jsonb;
  o jsonb;
  m numeric; okc numeric;
  lo numeric; hi numeric;
  guess jsonb;
  orig jsonb;
  ef numeric;
begin
  -- Light days: the first weekday (Mon-Fri) at or after each candidate offset.
  select array_agg((
    select k from generate_series(cand, cand + 2) k
    where extract(isodow from today - k) not in (6, 7)
    order by k limit 1))
  into light
  from unnest(array[3, 15, 27]) cand;

  for off in 0..41 loop
    continue when off = any(unlogged);
    d := today - off;
    is_we := extract(isodow from d) in (6, 7);
    select ug.kcal into goal_kcal from public.user_goals ug
    where ug.user_id = uid and ug.effective_from <= d
    order by ug.effective_from desc limit 1;

    if off = 0 then
      slots := array['breakfast', 'lunch'];
      pct := null;
    elsif off = any(light) then
      pct := 0.60 + ((off * 17) % 21) / 100.0;
      slots := case when off % 2 = 0 then array['lunch', 'dinner']
                    else array['lunch', 'snack', 'dinner'] end;
    elsif is_we then
      pct := 1.10 + ((off * 13) % 31) / 100.0;
      slots := array['breakfast', 'lunch', 'snack', 'dinner'];
    else
      pct := 0.85 + ((off * 11) % 26) / 100.0;
      slots := case when pct >= 0.97 then array['breakfast', 'lunch', 'snack', 'dinner']
                    else array['breakfast', 'lunch', 'dinner'] end;
    end if;

    -- Pick one template per slot (weekend pools on Saturdays/Sundays where they exist).
    chosen := '[]'::jsonb;
    base := 0;
    for si in 1..array_length(slots, 1) loop
      pool := menus -> (slots[si] || case when is_we and menus ? (slots[si] || '_we')
                                          then '_we' else '' end);
      meal := pool -> ((off * 3 + si * 2) % jsonb_array_length(pool));
      base := base + (select sum((x -> 'e' ->> 0)::numeric) from jsonb_array_elements(meal -> 'i') x);
      chosen := chosen || jsonb_build_array(meal || jsonb_build_object('slot', slots[si]));
    end loop;
    f := case when pct is null then 1 else goal_kcal * pct / base end;

    for si in 1..jsonb_array_length(chosen) loop
      meal := chosen -> (si - 1);
      mt := meal ->> 'slot';
      eaten := (d + (slot_times ->> mt)::time
                + make_interval(mins => ((off * 7 + si * 11) % 35))
                + case when is_we and mt = 'breakfast' then interval '2 hours' else interval '0' end
               ) at time zone tz;

      insert into public.meals (
        user_id, status, meal_type, eaten_at, local_date, text_input,
        model_version, prompt_version, created_at, updated_at, confirmed_at
      ) values (
        uid, 'confirmed', mt::public.meal_type, eaten, d, meal ->> 'd',
        'gpt-5.4-mini', 'analyze_meal.v2', eaten + interval '2 minutes',
        eaten + interval '6 minutes', eaten + interval '6 minutes'
      )
      returning id into v_meal_id;

      pos := 0;
      for it in select value from jsonb_array_elements(meal -> 'i') loop
        attr := it -> 'a';
        step := case when it ->> 'u' in ('piece', 'slice', 'bowl', 'bag', 'bar', 'serving')
                     then 0.5 else 0.25 end;
        q := greatest(step, round((it ->> 'q')::numeric * f / step) * step);
        g := round((it ->> 'g')::numeric * f);
        kc := round((it -> 'e' ->> 0)::numeric * f);
        p := round((it -> 'e' ->> 1)::numeric * f, 1);
        c := round((it -> 'e' ->> 2)::numeric * f, 1);
        fa := round((it -> 'e' ->> 3)::numeric * f, 1);

        -- Provenance: about ai_share/10 of items stay `ai`, varying by day.
        if (off * 3 + si * 7 + pos * 9) % 10 < ai_share[off % 7 + 1] then
          src := 'ai';
        elsif attr is not null then
          src := 'ai_clarified';
        elsif it ->> 'k' = 'addon' then
          src := 'user_added';
        else
          src := 'user_edited';
        end if;

        -- Options carry the item's full estimate if chosen (data-model §5.1).
        opts := '[]'::jsonb;
        lo := null; hi := null;
        if attr is not null then
          for o in select value from jsonb_array_elements(attr -> 'o') loop
            m := coalesce((o ->> 'm')::numeric, 1);
            okc := round(kc * m + f * (4 * coalesce((o ->> 'dp')::numeric, 0)
                                       + 4 * coalesce((o ->> 'dc')::numeric, 0)
                                       + 9 * coalesce((o ->> 'df')::numeric, 0)));
            opts := opts || jsonb_build_array(jsonb_build_object(
              'id', o ->> 'id',
              'label', o ->> 'l',
              'nutrition', jsonb_build_object(
                'kcal', okc,
                'protein_g', greatest(0, round(p * m + f * coalesce((o ->> 'dp')::numeric, 0), 1)),
                'carbs_g', greatest(0, round(c * m + f * coalesce((o ->> 'dc')::numeric, 0), 1)),
                'fat_g', greatest(0, round(fa * m + f * coalesce((o ->> 'df')::numeric, 0), 1))),
              'portion', case when attr ->> 't' = 'portion' then jsonb_build_object(
                'qty', greatest(0.25, round(q * m * 4) / 4), 'unit', it ->> 'u',
                'grams', round(g * m)) else null end));
          end loop;
          select min((x -> 'nutrition' ->> 'kcal')::numeric), max((x -> 'nutrition' ->> 'kcal')::numeric)
            into lo, hi from jsonb_array_elements(opts) x;
        end if;

        -- ai_original: the analysis item as first returned (null for user_added).
        orig := jsonb_build_object(
          'name', it ->> 'n', 'kind', it ->> 'k', 'preparation', it -> 'pr',
          'portion', jsonb_build_object('qty', q, 'unit', it ->> 'u', 'grams', g),
          'nutrition', jsonb_build_object('kcal', kc, 'protein_g', p, 'carbs_g', c, 'fat_g', fa),
          'uncertain_attributes', case when attr is null then '[]'::jsonb else jsonb_build_array(
            jsonb_build_object('attribute', attr ->> 't', 'reason', attr ->> 'r',
                               'question', attr ->> 'qn', 'options', opts,
                               'current_option_id', attr ->> 'cur')) end);
        if src = 'ai_clarified' then
          -- The AI first picked `guess`; the user's answer (`cur`) is the item's value now.
          select x into guess from jsonb_array_elements(opts) x where x ->> 'id' = attr ->> 'guess';
          orig := orig || jsonb_build_object(
            'nutrition', guess -> 'nutrition',
            'portion', coalesce(guess -> 'portion', orig -> 'portion'),
            'uncertain_attributes', jsonb_set(orig -> 'uncertain_attributes',
                                              '{0,current_option_id}', to_jsonb(attr ->> 'guess')));
        elsif src = 'user_edited' then
          -- The AI's portion was off; the user corrected it.
          ef := case when (off + pos) % 2 = 0 then 0.8 else 1.25 end;
          orig := orig || jsonb_build_object(
            'portion', jsonb_build_object('qty', greatest(step, round(q * ef / step) * step),
                                          'unit', it ->> 'u', 'grams', round(g * ef)),
            'nutrition', jsonb_build_object('kcal', round(kc * ef), 'protein_g', round(p * ef, 1),
                                            'carbs_g', round(c * ef, 1), 'fat_g', round(fa * ef, 1)));
        elsif src = 'user_added' then
          orig := null;
        end if;

        -- Range only for unresolved (ai) items whose options spread meaningfully (M1 §3.5).
        if src <> 'ai' or lo is null or hi - lo < greatest(30, 0.1 * kc) then
          lo := null; hi := null;
        end if;

        insert into public.meal_items (
          meal_id, user_id, position, kind, name, preparation,
          portion_qty, portion_unit, portion_grams,
          kcal, protein_g, carbs_g, fat_g, kcal_low, kcal_high, source, ai_original,
          created_at, updated_at
        ) values (
          v_meal_id, uid, pos, (it ->> 'k')::public.item_kind, it ->> 'n', it ->> 'pr',
          q, it ->> 'u', g, kc, p, c, fa, lo, hi, src::public.item_source, orig,
          eaten + interval '2 minutes', eaten + interval '5 minutes'
        )
        returning id into v_item_id;

        if attr is not null and src in ('ai', 'ai_clarified') then
          insert into public.uncertain_attributes (
            meal_item_id, user_id, attribute, reason, question, options, current_option_id,
            impact_kcal, asked, status, resolution
          ) values (
            v_item_id, uid, (attr ->> 't')::public.attribute_kind, attr ->> 'r', attr ->> 'qn',
            opts, attr ->> 'cur',
            (select max((x -> 'nutrition' ->> 'kcal')::numeric)
                    - min((x -> 'nutrition' ->> 'kcal')::numeric)
             from jsonb_array_elements(opts) x),
            src = 'ai_clarified' or (off + pos) % 3 <> 0,
            case when src = 'ai' then 'unresolved' else 'answered' end::public.resolution_status,
            case when src = 'ai' then null
                 else jsonb_build_object('option_id', attr ->> 'cur', 'text', null) end
          );
        end if;
        pos := pos + 1;
      end loop;
    end loop;
  end loop;

  -- Guard: seeded macros must stay physically consistent (4p + 4c + 9f within ~10%).
  if exists (
    select 1 from public.meal_items i
    where i.user_id = uid and i.kcal >= 50
      and abs(4 * i.protein_g + 4 * i.carbs_g + 9 * i.fat_g - i.kcal) > 0.1 * i.kcal
  ) then
    raise exception 'seed: an item''s macros do not match its kcal';
  end if;
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
  'gpt-5.4-mini',
  'analyze_meal.v2'
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
