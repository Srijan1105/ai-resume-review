import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Retrieves the authenticated user from the current request session.
 *
 * Returns `{ user }` on success or a `NextResponse` with HTTP 401 when no
 * valid session is present. API route handlers should check the return value
 * and short-circuit if it is a `NextResponse`.
 *
 * Usage:
 * ```ts
 * const authResult = await getAuthUser()
 * if (authResult instanceof NextResponse) return authResult
 * const { user } = authResult
 * ```
 *
 * Requirements: 2.6
 */
export async function getAuthUser(): Promise<
  { user: User } | NextResponse
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user }
}
