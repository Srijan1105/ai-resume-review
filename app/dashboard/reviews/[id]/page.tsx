import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReviewDetail from '@/components/dashboard/ReviewDetail'
import type { ReviewDetailResponse } from '@/types'

interface ReviewDetailPageProps {
  params: { id: string }
}

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const { id } = params

  // Fetch review directly from DB, scoped to the authenticated user
  const { data: row, error } = await supabase
    .from('reviews')
    .select(
      'id, score, summary, strengths, improvements, keyword_matches, created_at, resume_text, job_description'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !row) {
    redirect('/dashboard')
  }

  const review: ReviewDetailResponse = {
    id: row.id,
    score: row.score,
    summary: row.summary,
    strengths: row.strengths,
    improvements: row.improvements,
    keywordMatches: row.keyword_matches,
    createdAt: row.created_at,
    resumeSnippet: (row.resume_text as string).slice(0, 500),
    jobDescriptionSnippet: (row.job_description as string).slice(0, 500),
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
          Review History
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-900">Review Detail</span>
      </nav>

      <ReviewDetail review={review} />
    </div>
  )
}
