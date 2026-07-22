import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/dashboard/SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 flex w-60 flex-col bg-white border-r border-gray-200">
        {/* Logo / Brand */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
            ResumeAI
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            History
          </Link>
          <Link
            href="/dashboard/new"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            New Review
          </Link>
          <Link
            href="/dashboard/billing"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Billing
          </Link>
        </nav>

        {/* Footer: user info + sign out */}
        <div className="border-t border-gray-200 px-4 py-4 space-y-2">
          <p className="px-3 py-1 text-xs text-gray-400 truncate">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center h-16 px-6 bg-white border-b border-gray-200">
          <h1 className="text-sm font-medium text-gray-500">Dashboard</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
