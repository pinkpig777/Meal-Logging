/**
 * MSW request handlers that emulate the backend contract
 * (docs/05-api/api-reference.md) against the in-memory db in ./data.ts.
 *
 * Handy triggers when testing the capture flow in mock mode:
 *   - text containing "fail"     → LLM_TIMEOUT error (with details.meal_id)
 *   - text containing "not food" → IMAGE_NOT_FOOD error
 */
import { delay, http, HttpResponse } from 'msw';
import type {
  AddItemRequest,
  AnalyzeRequest,
  ChatRequest,
  ClarifyRequest,
  DailyAnalytics,
  DayPoint,
  ErrorBody,
  GoalCreate,
  Meal,
  MealContribution,
  MealPatch,
  ProfilePatch,
  RecommendationsResponse,
  ReestimateRequest,
  WeeklyAnalytics,
} from '@/api/types';
import { env } from '@/lib/env';
import { parseLocalDate, toIsoWithOffset, toLocalDateString } from '@/lib/format';
import { uuid } from '@/lib/uuid';
import {
  buildDraftMeal,
  computeTotals,
  db,
  effectiveGoal,
  MODELS,
  refreshDerived,
  toSummary,
} from './data';

const base = env.apiBaseUrl;
const url = (path: string) => `${base}${path}`;

function err(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const body: ErrorBody = {
    error: { code, message, details: details ?? null, request_id: `mock-${uuid().slice(0, 8)}` },
  };
  return HttpResponse.json(body, { status });
}

const notFound = () => err(404, 'NOT_FOUND', 'We could not find that meal.');

function getMeal(id: string | readonly string[] | undefined): Meal | undefined {
  return typeof id === 'string' ? db.meals.get(id) : undefined;
}

function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function mondayOf(date: string): string {
  const d = parseLocalDate(date);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toLocalDateString(d);
}

const today = () => toLocalDateString(new Date());

function confirmedOn(date: string): Meal[] {
  return [...db.meals.values()].filter((m) => m.status === 'confirmed' && m.local_date === date);
}

function dayPoint(date: string): DayPoint {
  const meals = confirmedOn(date);
  const logged = meals.length > 0;
  return {
    date,
    logged,
    meal_count: meals.length,
    // Unlogged day → null, never zero (ADR-0005).
    totals: logged ? computeTotals(meals.flatMap((m) => m.items)) : null,
    goal: effectiveGoal(date),
  };
}

function applyPatch(meal: Meal, body: MealPatch) {
  if (body.meal_type) meal.meal_type = body.meal_type;
  if (body.eaten_at) {
    meal.eaten_at = body.eaten_at;
    meal.local_date = toLocalDateString(new Date(body.eaten_at));
  }
  for (const op of body.items ?? []) {
    const idx = meal.items.findIndex((i) => i.id === op.id);
    if (idx < 0) continue;
    if (op.op === 'remove') {
      meal.items.splice(idx, 1);
      continue;
    }
    const it = meal.items[idx];
    if (op.nutrition) {
      it.nutrition = { ...op.nutrition };
    } else if (op.portion && it.portion.grams > 0) {
      // Portion only: scale nutrition by grams (api-reference §4).
      const f = op.portion.grams / it.portion.grams;
      it.nutrition = {
        kcal: it.nutrition.kcal * f,
        protein_g: it.nutrition.protein_g * f,
        carbs_g: it.nutrition.carbs_g * f,
        fat_g: it.nutrition.fat_g * f,
      };
      for (const a of it.uncertain_attributes) {
        for (const o of a.options) {
          if (a.attribute === 'portion') continue;
          o.nutrition = {
            kcal: o.nutrition.kcal * f,
            protein_g: o.nutrition.protein_g * f,
            carbs_g: o.nutrition.carbs_g * f,
            fat_g: o.nutrition.fat_g * f,
          };
        }
      }
    }
    if (op.portion) it.portion = { ...op.portion };
    if (op.name != null) it.name = op.name;
    if (op.preparation !== undefined) it.preparation = op.preparation;
    it.source = 'user_edited';
  }
  refreshDerived(meal);
}

export const handlers = [
  http.get(url('/health'), () => HttpResponse.json({ status: 'ok' })),

  // ---------- M1 ----------
  http.get(url('/config/models'), () => HttpResponse.json(MODELS)),

  http.post(url('/meals/analyze'), async ({ request }) => {
    const body = (await request.json()) as AnalyzeRequest;
    if (!body.photo_path && !body.text_input?.trim()) {
      return err(422, 'INPUT_REQUIRED', 'Add a photo or a short description of your meal.');
    }
    await delay(1800);
    const text = body.text_input?.toLowerCase() ?? '';
    if (text.includes('not food')) {
      return err(
        422,
        'IMAGE_NOT_FOOD',
        "This photo doesn't seem to show food. Try another photo or describe your meal.",
      );
    }
    if (text.includes('fail')) {
      return err(504, 'LLM_TIMEOUT', 'Analysis took too long. Please try again.', {
        meal_id: uuid(),
      });
    }
    const meal = buildDraftMeal({
      eaten: body.eaten_at ? new Date(body.eaten_at) : new Date(),
      text_input: body.text_input ?? null,
      photo: !!body.photo_path,
    });
    if (body.meal_type) meal.meal_type = body.meal_type;
    db.meals.set(meal.id, meal);
    return HttpResponse.json(meal, { status: 201 });
  }),

  http.post(url('/meals/:id/items/:itemId/reestimate'), async ({ params, request }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    const it = meal.items.find((i) => i.id === params.itemId);
    if (!it) return notFound();
    const body = (await request.json()) as ReestimateRequest;
    await delay(1200);
    if (body.name) it.name = body.name;
    if (body.preparation !== undefined) it.preparation = body.preparation;
    it.uncertain_attributes = [];
    it.source = 'user_edited';
    refreshDerived(meal);
    return HttpResponse.json(meal);
  }),

  // ---------- M2 ----------
  http.post(url('/meals/:id/clarify'), async ({ params, request }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    if (meal.status !== 'draft') {
      return err(
        409,
        'MEAL_INVALID_STATE',
        'This meal is already confirmed and cannot be clarified.',
        {
          meal_id: meal.id,
          status: meal.status,
        },
      );
    }
    const body = (await request.json()) as ClarifyRequest;
    const item = meal.items.find((i) =>
      i.uncertain_attributes.some((a) => a.id === body.attribute_id),
    );
    const a = item?.uncertain_attributes.find((x) => x.id === body.attribute_id);
    if (!item || !a) return err(422, 'VALIDATION_ERROR', 'Unknown attribute.');
    await delay(300);
    if (body.answer.kind === 'option') {
      const optionId = body.answer.option_id;
      const opt = a.options.find((o) => o.id === optionId);
      if (!opt) return err(422, 'VALIDATION_ERROR', 'Unknown option.');
      item.nutrition = { ...opt.nutrition };
      if (opt.portion) item.portion = { ...opt.portion };
      if (a.attribute === 'preparation') item.preparation = opt.label.toLowerCase();
      if (a.attribute === 'identity') item.name = opt.label;
      a.current_option_id = opt.id;
      a.status = 'answered';
      a.resolution = { option_id: opt.id, text: null };
      item.source = 'ai_clarified';
    } else if (body.answer.kind === 'not_sure') {
      a.status = 'not_sure';
      a.resolution = { option_id: null, text: null };
    } else {
      await delay(900); // simulated M1 re-estimate
      a.status = 'answered';
      a.resolution = { option_id: null, text: body.answer.text };
      if (a.attribute === 'preparation') item.preparation = body.answer.text;
      item.source = 'user_edited';
    }
    refreshDerived(meal);
    return HttpResponse.json(meal);
  }),

  http.patch(url('/meals/:id/draft'), async ({ params, request }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    if (meal.status !== 'draft') return err(409, 'MEAL_INVALID_STATE', 'This meal is not a draft.');
    applyPatch(meal, (await request.json()) as MealPatch);
    return HttpResponse.json(meal);
  }),

  http.post(url('/meals/:id/items'), async ({ params, request }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    const body = (await request.json()) as AddItemRequest;
    await delay(body.nutrition ? 200 : 1000);
    const portion = body.portion ?? { qty: 1, unit: 'serving', grams: 150 };
    const g = portion.grams;
    meal.items.push({
      id: uuid(),
      position: meal.items.length,
      kind: 'dish',
      name: body.name,
      preparation: null,
      portion,
      nutrition: body.nutrition ?? {
        kcal: g * 1.5,
        protein_g: g * 0.05,
        carbs_g: g * 0.2,
        fat_g: g * 0.05,
      },
      kcal_range: null,
      source: 'user_added',
      uncertain_attributes: [],
      ai_original: null,
    });
    refreshDerived(meal);
    return HttpResponse.json(meal);
  }),

  // ---------- M3 ----------
  http.post(url('/meals/:id/confirm'), ({ params }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    if (meal.status !== 'draft')
      return err(409, 'MEAL_INVALID_STATE', 'Only drafts can be confirmed.');
    meal.status = 'confirmed';
    meal.confirmed_at = toIsoWithOffset(new Date());
    return HttpResponse.json(meal);
  }),

  http.get(url('/meals'), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const to = q.get('to') ?? today();
    const from = q.get('from') ?? addDays(to, -6);
    const status = q.get('status') ?? 'confirmed';
    const meals = [...db.meals.values()]
      .filter((m) => m.status === status && m.local_date >= from && m.local_date <= to)
      .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
      .map(toSummary);
    return HttpResponse.json({ meals });
  }),

  http.get(url('/meals/:id'), ({ params }) => {
    const meal = getMeal(params.id);
    return meal ? HttpResponse.json(meal) : notFound();
  }),

  http.patch(url('/meals/:id'), async ({ params, request }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    applyPatch(meal, (await request.json()) as MealPatch);
    return HttpResponse.json(meal);
  }),

  http.delete(url('/meals/:id/photo'), ({ params }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    meal.photo_url = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(url('/meals/:id'), ({ params }) => {
    const meal = getMeal(params.id);
    if (!meal) return notFound();
    db.meals.delete(meal.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url('/goals'), () => {
    const history = [...db.goals].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return HttpResponse.json({ current: effectiveGoal(today()), history });
  }),

  http.post(url('/goals'), async ({ request }) => {
    const body = (await request.json()) as GoalCreate;
    const effective_from = body.effective_from ?? today();
    db.goals = db.goals.filter((g) => g.effective_from !== effective_from);
    const goal = { id: uuid(), ...body, effective_from };
    db.goals.push(goal);
    return HttpResponse.json(goal, { status: 201 });
  }),

  http.get(url('/me'), () => HttpResponse.json(db.profile)),

  http.patch(url('/me'), async ({ request }) => {
    const body = (await request.json()) as ProfilePatch;
    if (body.analysis_model && !MODELS.models.some((m) => m.id === body.analysis_model)) {
      return err(422, 'MODEL_NOT_ALLOWED', 'That analysis model is not available.');
    }
    db.profile = { ...db.profile, ...body } as typeof db.profile;
    return HttpResponse.json(db.profile);
  }),

  // ---------- M4 ----------
  http.get(url('/analytics/daily'), ({ request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? today();
    const point = dayPoint(date);
    const meals = confirmedOn(date).sort((a, b) => a.eaten_at.localeCompare(b.eaten_at));
    const t = point.totals;
    const share = (v: number, total: number | undefined) => (total ? v / total : 0);
    const body: DailyAnalytics = {
      date,
      logged: point.logged,
      goal: point.goal,
      totals: t,
      meals: meals.map((m): MealContribution => ({
        ...toSummary(m),
        share: {
          kcal: share(m.totals.kcal, t?.kcal),
          protein_g: share(m.totals.protein_g, t?.protein_g),
          carbs_g: share(m.totals.carbs_g, t?.carbs_g),
          fat_g: share(m.totals.fat_g, t?.fat_g),
        },
      })),
    };
    return HttpResponse.json(body);
  }),

  http.get(url('/analytics/weekly'), ({ request }) => {
    const start = new URL(request.url).searchParams.get('start') ?? mondayOf(today());
    const days = Array.from({ length: 7 }, (_, i) => dayPoint(addDays(start, i)));
    const logged = days.filter((d) => d.logged && d.totals);
    const avg = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
      logged.reduce((s, d) => s + (d.totals?.[k] ?? 0), 0) / logged.length;
    const body: WeeklyAnalytics = {
      start,
      end: addDays(start, 6),
      days,
      logged_day_count: logged.length,
      // Averages over logged days only; null when none are logged.
      averages: logged.length
        ? {
            kcal: avg('kcal'),
            protein_g: avg('protein_g'),
            carbs_g: avg('carbs_g'),
            fat_g: avg('fat_g'),
          }
        : null,
    };
    return HttpResponse.json(body);
  }),

  http.get(url('/analytics/history'), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const to = q.get('to') ?? today();
    const from = q.get('from') ?? addDays(to, -29);
    const days: DayPoint[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(dayPoint(d));
    return HttpResponse.json({ days });
  }),

  // ---------- M5 ----------
  http.get(url('/recommendations'), () => {
    const loggedDates = [
      ...new Set(
        [...db.meals.values()].filter((m) => m.status === 'confirmed').map((m) => m.local_date),
      ),
    ]
      .sort()
      .reverse();
    const required = 3;
    if (loggedDates.length < required) {
      const body: RecommendationsResponse = {
        status: 'insufficient_history',
        logged_day_count: loggedDates.length,
        required_day_count: required,
        suggestions: [],
      };
      return HttpResponse.json(body);
    }
    const evidenceDates = loggedDates.slice(0, 4);
    const evidenceMeals = [...db.meals.values()]
      .filter(
        (m) =>
          m.status === 'confirmed' &&
          evidenceDates.includes(m.local_date) &&
          m.meal_type === 'breakfast',
      )
      .map((m) => m.id);
    const body: RecommendationsResponse = {
      status: 'ok',
      logged_day_count: loggedDates.length,
      required_day_count: required,
      suggestions: [
        {
          id: 'sug-protein-snack',
          pattern: {
            metric: 'protein_g',
            summary: `On 4 of your ${loggedDates.length} logged days, protein was below your goal by 30 g or more.`,
          },
          title: 'Add a protein-forward snack',
          ideas: [
            {
              name: 'Greek yogurt with berries',
              description: 'A cup of plain Greek yogurt topped with a handful of berries.',
              estimated_nutrition: { kcal: 180, protein_g: 17, carbs_g: 20, fat_g: 3 },
            },
            {
              name: 'Hard-boiled eggs',
              description: 'Two eggs, easy to prepare ahead for the week.',
              estimated_nutrition: { kcal: 156, protein_g: 12.6, carbs_g: 1.1, fat_g: 10.6 },
            },
          ],
          evidence: {
            dates: evidenceDates,
            meal_ids: evidenceMeals,
            observations: [
              'Protein averaged about 85 g on these days, against a goal of 120 g.',
              'Afternoons had the longest gap between meals.',
            ],
          },
          caveats: ['Based only on days you logged.'],
        },
        {
          id: 'sug-dinner-veg',
          pattern: {
            metric: 'carbs_g',
            summary: 'Lunches on your logged days often made up more than half of the day’s carbs.',
          },
          title: 'Balance carbs across the day',
          ideas: [
            {
              name: 'Burrito bowl with extra greens',
              description: 'Swap half of the rice for lettuce and fajita vegetables.',
              estimated_nutrition: { kcal: 560, protein_g: 36, carbs_g: 55, fat_g: 20 },
            },
          ],
          evidence: {
            dates: loggedDates.slice(0, 3),
            meal_ids: [],
            observations: ['Lunch carbs were around 85 g on these days.'],
          },
          caveats: ['Based only on days you logged.', 'Estimates come from photos and may be off.'],
        },
      ],
    };
    return HttpResponse.json(body);
  }),

  http.post(url('/recommendations/feedback'), async () => {
    await delay(200);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(url('/chat'), async ({ request }) => {
    const body = (await request.json()) as ChatRequest;
    const last = body.messages[body.messages.length - 1]?.content ?? '';
    await delay(800);
    return HttpResponse.json({
      message: {
        role: 'assistant',
        content: `(Mock reply) Based on the days you logged, here is how "${last.slice(0, 60)}" might fit your goals. Chat answers will use your confirmed meals and goals only.`,
      },
      references: { meal_ids: [], dates: [] },
    });
  }),
];
