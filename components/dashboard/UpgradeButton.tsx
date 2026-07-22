'use client'

import { useState } from 'react'

interface UpgradeButtonProps {
  priceId: string
}

export default function UpgradeButton({ priceId }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {loading ? 'Redirecting to checkout…' : 'Upgrade to Pro — $19/month'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
