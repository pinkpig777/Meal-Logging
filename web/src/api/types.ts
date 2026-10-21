/**
 * API types for the app. All app code imports API types from this file only.
 *
 * Generated types live in ./schema.d.ts (do not edit). Regenerate after a
 * backend contract change:
 *
 *   cd api && uv run python scripts/export_openapi.py
 *   npm run gen:api            # from the repo root
 *
 * Aliases below map generated component schemas to the names the app uses.
 * Only types with no OpenAPI equivalent (query params, UI unions) are hand-written.
 */
import type { components } from './schema';

type S = components['schemas'];

// ---------- Enums ----------
export type MealStatus = S['MealStatus'];
export type MealType = S['MealType'];
export type ItemKind = S['ItemKind'];
export type ItemSource = S['ItemSource'];
export type AttributeKind = S['AttributeKind'];
export type ResolutionStatus = S['ResolutionStatus'];
export type ImageIssue = S['ImageIssue'];
export type SuggestionResponse = S['SuggestionResponse'];

// ---------- Shared schemas ----------
export type Nutrition = S['Nutrition'];
export type KcalRange = S['KcalRange'];
export type Portion = S['Portion'];
export type AttributeOption = S['AttributeOption'];
export type AttributeResolution = S['AttributeResolution'];
export type UncertainAttribute = S['UncertainAttribute'];
export type MealItem = S['MealItem'];
export type NutritionTotals = S['NutritionTotals'];
export type Meal = S['Meal'];
export type MealSummary = S['MealSummary'];
export type Goal = S['Goal'];
export type Profile = S['Profile'];
/** The full error envelope: `{ error: { code, message, details, request_id } }`. */
export type ErrorBody = S['ErrorResponse'];

// ---------- M1 ----------
export type AnalysisModel = S['AnalysisModelInfo'];
export type ModelsConfig = S['AnalysisModelsResponse'];
export type AnalyzeRequest = S['AnalyzeMealRequest'];
export type ReestimateRequest = S['ReestimateItemRequest'];

// ---------- M2 ----------
export type ClarifyRequest = S['ClarifyRequest'];
export type ClarifyAnswer = ClarifyRequest['answer'];
export type ItemPatch = S['ItemUpdateOp'] | S['ItemRemoveOp'];
export type MealPatch = S['MealEditRequest'];
export type AddItemRequest = S['AddItemRequest'];

// ---------- M3 ----------
export type MealListResponse = S['MealListResponse'];
export type GoalsResponse = S['GoalsResponse'];
export type GoalCreate = S['GoalCreate'];
export type ProfilePatch = S['ProfileUpdate'];

export interface MealListParams {
  from?: string;
  to?: string;
  status?: MealStatus;
}

// ---------- M4 ----------
export type DayPoint = S['DayPoint'];
export type MealContribution = S['MealContribution'];
export type DailyAnalytics = S['DailyAnalytics'];
export type WeeklyAnalytics = S['WeeklyAnalytics'];
export type HistoryAnalytics = S['HistoryAnalytics'];
export type MacroMetric = 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g';

// ---------- M5 ----------
export type SuggestionIdea = S['SuggestionIdea'];
export type Suggestion = S['Suggestion'];
export type RecommendationsResponse = S['RecommendationsResponse'];
export type SuggestionFeedbackRequest = S['SuggestionFeedbackRequest'];
export type ChatMessage = S['ChatMessage'];
export type ChatRequest = S['ChatRequest'];
export type ChatResponse = S['ChatResponse'];

// ---------- Errors ----------
/** Mirrors the code table in docs/05-api/api-conventions.md. */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'MEAL_INVALID_STATE'
  | 'IMAGE_NOT_FOOD'
  | 'INPUT_REQUIRED'
  | 'MODEL_NOT_ALLOWED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_INVALID_OUTPUT'
  | 'LLM_TIMEOUT'
  | 'RATE_LIMITED'
  | 'INTERNAL';
