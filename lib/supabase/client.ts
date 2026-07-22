import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client.
 * Use this in Client Components ('use client') to interact with Supabase.
 */
export function createClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const url = rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  return createBrowserClient(url, anonKey)
}
