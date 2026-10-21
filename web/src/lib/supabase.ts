import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase browser client: Google OAuth session (ADR-0002) and photo uploads
 * to the private `meal-photos` bucket. Never use a service-role key here.
 *
 * In dev auth mode the anon key may be blank; a placeholder keeps createClient
 * from throwing, and nothing calls Supabase in that mode.
 */
export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey || 'dev-placeholder-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  },
);

export const MEAL_PHOTOS_BUCKET = 'meal-photos';
