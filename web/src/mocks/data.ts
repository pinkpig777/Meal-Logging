/**
 * In-memory mock database for MSW (VITE_API_MOCK=true) and tests.
 * Shapes follow src/api/types.ts. Values are realistic but invented.
 *
 * Seeded content (relative to today):
 *  - Confirmed meals on each of the last 7 days except 3 days ago (unlogged day).
 *  - One draft meal (DEMO_DRAFT_ID) with two asked clarifications:
 *    a portion question (rice) and a preparation question (chicken).
 */
import type {
  AttributeOption,
  Goal,
  Meal,
  MealItem,
  MealSummary,
  MealType,
  ModelsConfig,
  Nutrition,
  NutritionTotals,
  Portion,
  Profile,
  UncertainAttribute,
} from '@/api/types';
import { toIsoWithOffset, toLocalDateString } from '@/lib/format';
import { uuid } from '@/lib/uuid';

export const DEMO_DRAFT_ID = '11111111-1111-4111-8111-111111111111';

const n = (kcal: number, protein_g: number, carbs_g: number, fat_g: number): Nutrition => ({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
});
const p = (qty: number, unit: string, grams: number): Portion => ({ qty, unit, grams });

// ---------- Derived values (mirrors M1 design §3.5) ----------

export function computeRange(item: MealItem): MealItem['kcal_range'] {
  const cur = item.nutrition.kcal;
  let lo = 0;
  let hi = 0;
  for (const a of item.uncertain_attributes) {
    if (a.status === 'answered') continue;
    const deltas = a.options.map((o) => o.nutrition.kcal - cur);
    lo += Math.min(0, ...deltas);
    hi += Math.max(0, ...deltas);
  }
  const low = cur + lo;
  const high = cur + hi;
  return high - low < Math.max(30, 0.1 * cur) ? null : { low, high };
}

export function computeTotals(items: MealItem[]): NutritionTotals {
  const t: NutritionTotals = {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    kcal_low: 0,
    kcal_high: 0,
  };
  for (const i of items) {
    t.kcal += i.nutrition.kcal;
    t.protein_g += i.nutrition.protein_g;
    t.carbs_g += i.nutrition.carbs_g;
    t.fat_g += i.nutrition.fat_g;
    t.kcal_low += i.kcal_range?.low ?? i.nutrition.kcal;
    t.kcal_high += i.kcal_range?.high ?? i.nutrition.kcal;
  }
  return t;
}

export function refreshDerived(meal: Meal): Meal {
  meal.items.forEach((i, idx) => {
    i.position = idx;
    i.uncertain_attributes.forEach((a) => {
      const kc = a.options.map((o) => o.nutrition.kcal);
      a.impact_kcal = Math.max(...kc) - Math.min(...kc);
    });
    i.kcal_range = computeRange(i);
  });
  meal.totals = computeTotals(meal.items);
  meal.updated_at = toIsoWithOffset(new Date());
  return meal;
}

// ---------- Builders ----------

function attr(
  attribute: UncertainAttribute['attribute'],
  reason: string,
  question: string,
  options: AttributeOption[],
  current_option_id: string,
  asked: boolean,
): UncertainAttribute {
  return {
    id: uuid(),
    attribute,
    reason,
    question,
    options,
    current_option_id,
    impact_kcal: 0,
    asked,
    status: 'unresolved',
    resolution: null,
  };
}

function item(
  partial: Partial<MealItem> & Pick<MealItem, 'name' | 'portion' | 'nutrition'>,
): MealItem {
  return {
    id: uuid(),
    position: 0,
    kind: 'dish',
    preparation: null,
    kcal_range: null,
    source: 'ai',
    uncertain_attributes: [],
    ai_original: null,
    ...partial,
  };
}

function meal(opts: {
  id?: string;
  status: Meal['status'];
  meal_type: MealType;
  eaten: Date;
  items: MealItem[];
  text_input?: string | null;
  photo_url?: string | null;
}): Meal {
  const iso = toIsoWithOffset(opts.eaten);
  const m: Meal = {
    id: opts.id ?? uuid(),
    status: opts.status,
    meal_type: opts.meal_type,
    eaten_at: iso,
    local_date: toLocalDateString(opts.eaten),
    text_input: opts.text_input ?? null,
    photo_url: opts.photo_url ?? null,
    model_version: 'model-a',
    image_issues: [],
    failure_reason: null,
    items: opts.items,
    totals: computeTotals([]),
    created_at: iso,
    updated_at: iso,
    confirmed_at: opts.status === 'confirmed' ? iso : null,
  };
  for (const i of m.items) i.ai_original = { name: i.name, nutrition: { ...i.nutrition } };
  return refreshDerived(m);
}

export const PHOTO_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e7ece9"/><circle cx="200" cy="150" r="95" fill="#fff" stroke="#cfd8d3" stroke-width="6"/><circle cx="170" cy="130" r="35" fill="#f4e7c5"/><circle cx="235" cy="160" r="30" fill="#c98d5b"/><circle cx="185" cy="190" r="20" fill="#8fbf7a"/></svg>',
  );

/** The draft returned by POST /meals/analyze: two asked clarifications (portion + preparation). */
export function buildDraftMeal(opts: {
  id?: string;
  eaten?: Date;
  text_input?: string | null;
  photo?: boolean;
}): Meal {
  const rice = item({
    name: 'White rice',
    portion: p(1, 'cup', 186),
    nutrition: n(242, 4.4, 53.2, 0.4),
    uncertain_attributes: [
      attr(
        'portion',
        'Scale is unclear from one photo',
        'About how much rice did you eat?',
        [
          {
            id: 'half_cup',
            label: '½ cup',
            nutrition: n(121, 2.2, 26.6, 0.2),
            portion: p(0.5, 'cup', 93),
          },
          {
            id: 'one_cup',
            label: '1 cup',
            nutrition: n(242, 4.4, 53.2, 0.4),
            portion: p(1, 'cup', 186),
          },
          {
            id: 'one_half_cup',
            label: '1½ cups',
            nutrition: n(363, 6.6, 79.8, 0.6),
            portion: p(1.5, 'cup', 279),
          },
          {
            id: 'two_cups',
            label: '2 cups',
            nutrition: n(484, 8.8, 106.4, 0.8),
            portion: p(2, 'cup', 372),
          },
        ],
        'one_cup',
        true,
      ),
    ],
  });
  const chicken = item({
    name: 'Chicken thigh',
    preparation: 'grilled',
    portion: p(1, 'piece', 120),
    nutrition: n(250, 30.1, 0, 14.2),
    uncertain_attributes: [
      attr(
        'preparation',
        'Cooking method is hard to tell from the surface',
        'How was the chicken cooked?',
        [
          { id: 'grilled', label: 'Grilled', nutrition: n(250, 30.1, 0, 14.2), portion: null },
          { id: 'fried', label: 'Fried', nutrition: n(368, 28.4, 11.5, 22.8), portion: null },
          {
            id: 'air_fried',
            label: 'Air-fried',
            nutrition: n(270, 29.6, 3.2, 15.1),
            portion: null,
          },
        ],
        'grilled',
        true,
      ),
      attr(
        'identity',
        'Looks like dark meat chicken',
        'Is this chicken thigh?',
        [
          { id: 'thigh', label: 'Chicken thigh', nutrition: n(250, 30.1, 0, 14.2), portion: null },
          { id: 'breast', label: 'Chicken breast', nutrition: n(198, 37.2, 0, 4.3), portion: null },
        ],
        'thigh',
        false,
      ),
    ],
  });
  const ranch = item({
    name: 'Ranch dressing',
    kind: 'addon',
    portion: p(2, 'tbsp', 30),
    nutrition: n(129, 0.4, 1.8, 13.4),
    uncertain_attributes: [
      attr(
        'portion',
        'Sauce is partly hidden under the greens',
        'How much dressing was there?',
        [
          {
            id: 'one_tbsp',
            label: '1 tbsp',
            nutrition: n(65, 0.2, 0.9, 6.7),
            portion: p(1, 'tbsp', 15),
          },
          {
            id: 'two_tbsp',
            label: '2 tbsp',
            nutrition: n(129, 0.4, 1.8, 13.4),
            portion: p(2, 'tbsp', 30),
          },
        ],
        'two_tbsp',
        false,
      ),
    ],
  });
  const greens = item({
    name: 'Mixed greens',
    portion: p(1, 'cup', 40),
    nutrition: n(9, 0.6, 1.6, 0.1),
  });
  return meal({
    id: opts.id,
    status: 'draft',
    meal_type: 'lunch',
    eaten: opts.eaten ?? new Date(),
    items: [rice, chicken, greens, ranch],
    text_input: opts.text_input ?? null,
    photo_url: opts.photo === false ? null : PHOTO_PLACEHOLDER,
  });
}

function daysAgo(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function confirmedMeals(): Meal[] {
  const breakfast = (d: number) =>
    meal({
      status: 'confirmed',
      meal_type: 'breakfast',
      eaten: daysAgo(d, 8, 10),
      items: [
        item({ name: 'Greek yogurt', portion: p(1, 'cup', 245), nutrition: n(146, 20, 8, 3.8) }),
        item({
          name: 'Granola',
          kind: 'addon',
          portion: p(0.25, 'cup', 30),
          nutrition: n(140, 3.2, 19, 6),
        }),
        item({ name: 'Blueberries', portion: p(0.5, 'cup', 74), nutrition: n(42, 0.5, 10.7, 0.2) }),
      ],
    });
  const lunch = (d: number) =>
    meal({
      status: 'confirmed',
      meal_type: 'lunch',
      eaten: daysAgo(d, 12, 40),
      photo_url: PHOTO_PLACEHOLDER,
      items: [
        item({
          name: 'Chicken burrito',
          portion: p(1, 'piece', 380),
          nutrition: n(720, 38, 82, 24),
        }),
        item({
          name: 'Salsa',
          kind: 'addon',
          portion: p(2, 'tbsp', 32),
          nutrition: n(10, 0.5, 2, 0.1),
        }),
      ],
    });
  const dinner = (d: number) =>
    meal({
      status: 'confirmed',
      meal_type: 'dinner',
      eaten: daysAgo(d, 19, 5),
      items: [
        item({
          name: 'Salmon fillet',
          preparation: 'baked',
          portion: p(1, 'piece', 150),
          nutrition: n(310, 34, 0, 18.5),
        }),
        item({
          name: 'Roasted potatoes',
          portion: p(1, 'cup', 150),
          nutrition: n(210, 4, 32, 7.5),
        }),
        item({ name: 'Steamed broccoli', portion: p(1, 'cup', 90), nutrition: n(31, 2.5, 6, 0.3) }),
      ],
    });
  const snack = (d: number) =>
    meal({
      status: 'confirmed',
      meal_type: 'snack',
      eaten: daysAgo(d, 16, 0),
      items: [item({ name: 'Apple', portion: p(1, 'piece', 182), nutrition: n(95, 0.5, 25, 0.3) })],
    });

  const out: Meal[] = [];
  // Today: breakfast only so far. 3 days ago: unlogged (unknown, not zero).
  out.push(breakfast(0));
  for (const d of [1, 2, 4, 5, 6, 7]) {
    out.push(breakfast(d), lunch(d), dinner(d));
    if (d % 2 === 0) out.push(snack(d));
  }
  // A not_sure attribute left on one confirmed meal, so the detail page shows a cue.
  const l = out.find((m) => m.meal_type === 'lunch');
  if (l) {
    l.items[0].uncertain_attributes.push({
      ...attr(
        'portion',
        'Tortilla size is hard to judge',
        'How big was the burrito?',
        [
          {
            id: 'regular',
            label: 'Regular',
            nutrition: n(720, 38, 82, 24),
            portion: p(1, 'piece', 380),
          },
          {
            id: 'large',
            label: 'Large',
            nutrition: n(950, 48, 110, 32),
            portion: p(1, 'piece', 500),
          },
        ],
        'regular',
        true,
      ),
      status: 'not_sure',
      resolution: { option_id: null, text: null },
    });
    refreshDerived(l);
  }
  return out;
}

export const MODELS: ModelsConfig = {
  default: 'model-a',
  models: [
    { id: 'model-a', label: 'Faster', description: 'Quicker results, less detail' },
    { id: 'model-b', label: 'More detailed', description: 'Slower, more careful estimates' },
  ],
};

export interface MockDb {
  meals: Map<string, Meal>;
  goals: Goal[];
  profile: Profile;
}

function seed(): MockDb {
  const meals = new Map<string, Meal>();
  for (const m of confirmedMeals()) meals.set(m.id, m);
  const draft = buildDraftMeal({ id: DEMO_DRAFT_ID, eaten: daysAgo(0, 12, 30) });
  meals.set(draft.id, draft);
  const goalStart = toLocalDateString(daysAgo(30, 0));
  return {
    meals,
    goals: [
      {
        id: uuid(),
        effective_from: goalStart,
        kcal: 2000,
        protein_g: 120,
        carbs_g: 230,
        fat_g: 70,
      },
    ],
    profile: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'dev@example.com',
      display_name: 'Dev User',
      avatar_url: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
      dietary_restrictions: [],
      analysis_model: null,
    },
  };
}

export let db: MockDb = seed();

/** Restore seed data (call between tests). */
export function resetMockDb() {
  db = seed();
}

export function toSummary(m: Meal): MealSummary {
  return {
    id: m.id,
    status: m.status,
    meal_type: m.meal_type,
    eaten_at: m.eaten_at,
    local_date: m.local_date,
    photo_url: m.photo_url,
    item_names: m.items.map((i) => i.name),
    totals: m.totals,
  };
}

/** Most recent goal with effective_from ≤ date. */
export function effectiveGoal(date: string): Goal | null {
  const sorted = [...db.goals].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return sorted.find((g) => g.effective_from <= date) ?? null;
}
