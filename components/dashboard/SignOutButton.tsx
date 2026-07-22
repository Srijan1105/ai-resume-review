'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors"
    >
      Sign out
    </button>
  )
}
