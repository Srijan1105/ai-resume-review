'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelAt, setCancelAt] = useState<string | null>(null)

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your Pro subscription?')) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      const data = await res.json()
      if (data.cancelAt) {
        setCancelAt(
          new Date(data.cancelAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        )
      }

      // Refresh server data
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (cancelAt) {
    return (
      <p className="text-sm text-gray-600">
        Your subscription will be canceled on{' '}
        <span className="font-medium">{cancelAt}</span>. You&apos;ll retain Pro
        access until then.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {loading ? 'Canceling…' : 'Cancel Subscription'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
