import Link from 'next/link'
import type { ReviewSummary } from '@/types'

interface ReviewCardProps {
  review: ReviewSummary
}

function ScoreBadge({ score }: { score: number }) {
  let colorClasses: string

  if (score >= 70) {
    colorClasses = 'bg-green-100 text-green-800'
  } else if (score >= 40) {
    colorClasses = 'bg-yellow-100 text-yellow-800'
  } else {
    colorClasses = 'bg-red-100 text-red-800'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${colorClasses}`}
    >
      {score}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Link
      href={`/dashboard/reviews/${review.id}`}
      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-center gap-4">
        <ScoreBadge score={review.score} />
        <span className="text-sm font-medium text-gray-900 line-clamp-1">
          {review.jobTitle || 'Untitled Position'}
        </span>
      </div>
      <time
        dateTime={review.createdAt}
        className="text-xs text-gray-400 shrink-0 ml-4"
      >
        {formatDate(review.createdAt)}
      </time>
    </Link>
  )
}
