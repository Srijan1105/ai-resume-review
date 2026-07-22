import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client.
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Reads and writes session cookies via the Next.js `cookies()` store.
 */
export function createClient() {
  const cookieStore = cookies()
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const url = rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll may be called from a Server Component where cookies
            // cannot be mutated. The Middleware is responsible for
            // refreshing the session in that case.
          }
        },
      },
    }
  )
}
