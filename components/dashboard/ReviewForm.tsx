'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plan } from '@/types'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'

interface ReviewFormProps {
  userPlan: Plan
  dailyUsageCount: number
}

const RESUME_MAX = 8000
const JD_MAX = 4000

export default function ReviewForm({ userPlan, dailyUsageCount }: ReviewFormProps) {
  const router = useRouter()

  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; showUpgrade?: boolean } | null>(null)

  const isAtLimit = userPlan === 'starter' && dailyUsageCount >= STARTER_DAILY_LIMIT

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobDescription }),
      })

      if (res.status === 201) {
        const data = await res.json()
        router.push(`/dashboard/reviews/${data.id}`)
        return
      }

      const body = await res.json().catch(() => ({ error: 'Unexpected error. Please try again.' }))

      if (res.status === 400) {
        setError({ message: body.error ?? 'Invalid input. Please check your text and try again.' })
      } else if (res.status === 429) {
        setError({
          message: body.error ?? 'Daily review limit reached.',
          showUpgrade: true,
        })
      } else if (res.status === 502) {
        setError({ message: body.error ?? 'AI service is temporarily unavailable. Please try again.' })
      } else {
        setError({ message: body.error ?? 'Something went wrong. Please try again.' })
      }
    } catch {
      setError({ message: 'Network error. Please check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Resume textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="resumeText" className="block text-sm font-medium text-gray-700">
            Resume
          </label>
          <span className={`text-xs ${resumeText.length > RESUME_MAX ? 'text-red-500' : 'text-gray-400'}`}>
            {resumeText.length.toLocaleString()} / {RESUME_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          id="resumeText"
          name="resumeText"
          rows={12}
          maxLength={RESUME_MAX}
          disabled={loading}
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume here…"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
        />
      </div>

      {/* Job description textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700">
            Job Description
          </label>
          <span className={`text-xs ${jobDescription.length > JD_MAX ? 'text-red-500' : 'text-gray-400'}`}>
            {jobDescription.length.toLocaleString()} / {JD_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={8}
          maxLength={JD_MAX}
          disabled={loading}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here…"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
        />
      </div>

      {/* Upgrade prompt when at limit */}
      {isAtLimit && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800">
            You&apos;ve used all {STARTER_DAILY_LIMIT} free reviews for today.{' '}
            <Link
              href="/dashboard/billing"
              className="font-medium underline hover:text-amber-900"
            >
              Upgrade to Pro
            </Link>{' '}
            for unlimited reviews.
          </p>
        </div>
      )}

      {/* Inline error message */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-800">
            {error.message}
            {error.showUpgrade && (
              <>
                {' '}
                <Link
                  href="/dashboard/billing"
                  className="font-medium underline hover:text-red-900"
                >
                  Upgrade to Pro
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || isAtLimit}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {loading ? 'Analyzing…' : 'Analyze Resume'}
      </button>
    </form>
  )
}
