'use client'

import type { ReviewDetailResponse, KeywordMatch } from '@/types'

interface ReviewDetailProps {
  review: ReviewDetailResponse
}

function ScoreBadge({ score }: { score: number }) {
  let colorClasses: string

  if (score >= 70) {
    colorClasses = 'bg-green-100 text-green-800 ring-green-600/20'
  } else if (score >= 40) {
    colorClasses = 'bg-yellow-100 text-yellow-800 ring-yellow-600/20'
  } else {
    colorClasses = 'bg-red-100 text-red-800 ring-red-600/20'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-2xl font-bold ring-1 ring-inset ${colorClasses}`}
      aria-label={`Score: ${score} out of 100`}
    >
      {score}
      <span className="ml-1 text-sm font-medium opacity-70">/100</span>
    </span>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-gray-900 mb-3">{children}</h3>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  )
}

function KeywordMatchesTable({ matches }: { matches: KeywordMatch[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-gray-500">No keyword data available.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-1/4">
              Keyword
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-16">
              Found
            </th>
            <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Context
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {matches.map((match, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-2 pr-4 font-medium text-gray-800 break-words">
                {match.keyword}
              </td>
              <td className="py-2 pr-4">
                {match.found ? (
                  <span className="text-green-600 font-semibold" aria-label="Found">
                    ✓
                  </span>
                ) : (
                  <span className="text-red-500 font-semibold" aria-label="Not found">
                    ✗
                  </span>
                )}
              </td>
              <td className="py-2 text-gray-500 text-xs leading-relaxed">
                {match.context ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReviewDetail({ review }: ReviewDetailProps) {
  const formattedDate = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-6">
      {/* Score + date header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ScoreBadge score={review.score} />
        <time className="text-sm text-gray-400" dateTime={review.createdAt}>
          {formattedDate}
        </time>
      </div>

      {/* Summary */}
      <Card>
        <SectionHeader>Summary</SectionHeader>
        <p className="text-sm text-gray-700 leading-relaxed">{review.summary}</p>
      </Card>

      {/* Strengths */}
      <Card>
        <SectionHeader>Strengths</SectionHeader>
        {review.strengths.length > 0 ? (
          <ul className="space-y-2">
            {review.strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-green-500">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No strengths listed.</p>
        )}
      </Card>

      {/* Improvements */}
      <Card>
        <SectionHeader>Suggested Improvements</SectionHeader>
        {review.improvements.length > 0 ? (
          <ul className="space-y-2">
            {review.improvements.map((improvement, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                <span>{improvement}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No improvements listed.</p>
        )}
      </Card>

      {/* Keyword Matches */}
      <Card>
        <SectionHeader>Keyword Matches</SectionHeader>
        <KeywordMatchesTable matches={review.keywordMatches} />
      </Card>

      {/* Resume Snippet */}
      <Card>
        <SectionHeader>Resume Snippet</SectionHeader>
        <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono leading-relaxed bg-gray-50 rounded-md p-3 overflow-x-auto">
          {review.resumeSnippet || 'Not available.'}
        </pre>
        {review.resumeSnippet && review.resumeSnippet.length >= 500 && (
          <p className="mt-2 text-xs text-gray-400">Showing first 500 characters.</p>
        )}
      </Card>

      {/* Job Description Snippet */}
      <Card>
        <SectionHeader>Job Description Snippet</SectionHeader>
        <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono leading-relaxed bg-gray-50 rounded-md p-3 overflow-x-auto">
          {review.jobDescriptionSnippet || 'Not available.'}
        </pre>
        {review.jobDescriptionSnippet && review.jobDescriptionSnippet.length >= 500 && (
          <p className="mt-2 text-xs text-gray-400">Showing first 500 characters.</p>
        )}
      </Card>
    </div>
  )
}
