import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/dashboard/ReviewCard'
import type { ReviewSummary } from '@/types'

const PAGE_SIZE = 20

interface DashboardPageProps {
  searchParams: { page?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: rows, error, count } = await supabase
    .from('reviews')
    .select('id, score, job_title, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    // Surface a friendly error rather than crash
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600">Failed to load reviews. Please refresh the page.</p>
      </div>
    )
  }

  const reviews: ReviewSummary[] = (rows ?? []).map((row) => ({
    id: row.id,
    score: row.score,
    jobTitle: row.job_title ?? '',
    createdAt: row.created_at,
  }))

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Review History</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount === 0
              ? 'No reviews yet.'
              : `${totalCount} review${totalCount === 1 ? '' : 's'} total`}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          New Review
        </Link>
      </div>

      {/* Empty state */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">You haven&apos;t submitted any reviews yet.</p>
          <Link
            href="/dashboard/new"
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            Create your first review
          </Link>
        </div>
      ) : (
        <>
          {/* Review list */}
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>

          {/* Pagination controls — only shown when totalCount > PAGE_SIZE */}
          {totalCount > PAGE_SIZE && (
            <nav
              className="flex items-center justify-between pt-2"
              aria-label="Pagination"
            >
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {hasPrev ? (
                  <Link
                    href={`/dashboard?page=${page - 1}`}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed">
                    Previous
                  </span>
                )}
                {hasNext ? (
                  <Link
                    href={`/dashboard?page=${page + 1}`}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
