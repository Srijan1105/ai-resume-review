import { SupabaseClient } from '@supabase/supabase-js'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'
import { Plan } from '@/types'

/**
 * Checks whether a user is allowed to create a new review based on their plan
 * and daily usage.
 *
 * - Pro plan: always allowed, no DB access required.
 * - Starter plan: atomically ensures a `daily_usage` row exists for
 *   (userId, today) with count = 0 (INSERT … ON CONFLICT DO NOTHING via
 *   `ignoreDuplicates: true`), then reads the current count and compares it
 *   against STARTER_DAILY_LIMIT. The two-step approach avoids double-counting
 *   on concurrent calls because the insert is a no-op when a row already
 *   exists, and the select always reflects the latest committed count.
 *
 * @param supabase - Injected Supabase client (server-side or test double)
 * @param userId   - UUID of the authenticated user
 * @param plan     - The user's current subscription plan
 * @returns `{ allowed, remaining }` — whether the request is permitted and
 *          how many reviews are left for today (Infinity for Pro users).
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan
): Promise<{ allowed: boolean; remaining: number }> {
  // Pro users are never rate-limited — skip the DB entirely.
  if (plan === 'pro') {
    return { allowed: true, remaining: Infinity }
  }

  // --- Starter plan ---

  const today = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

  // Step 1: Ensure a row exists for (userId, today) with count = 0.
  // `ignoreDuplicates: true` maps to ON CONFLICT DO NOTHING, so an existing
  // row's count is left untouched.
  const { error: upsertError } = await supabase
    .from('daily_usage')
    .upsert(
      { user_id: userId, date: today, count: 0 },
      { onConflict: 'user_id,date', ignoreDuplicates: true }
    )

  if (upsertError) {
    throw new Error(`Rate limit upsert failed: ${upsertError.message}`)
  }

  // Step 2: Read the authoritative count for today.
  const { data, error: selectError } = await supabase
    .from('daily_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (selectError) {
    throw new Error(`Rate limit select failed: ${selectError.message}`)
  }

  const count: number = data?.count ?? 0

  if (count >= STARTER_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: STARTER_DAILY_LIMIT - count }
}
