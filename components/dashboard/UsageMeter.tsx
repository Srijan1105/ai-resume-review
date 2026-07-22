import { Plan } from '@/types'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'

interface UsageMeterProps {
  plan: Plan
  usedToday: number
}

export default function UsageMeter({ plan, usedToday }: UsageMeterProps) {
  if (plan === 'pro') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Pro
        </span>
        <span>Unlimited reviews</span>
      </div>
    )
  }

  const used = Math.min(usedToday, STARTER_DAILY_LIMIT)
  const progressPercent = (used / STARTER_DAILY_LIMIT) * 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {used} / {STARTER_DAILY_LIMIT} reviews used today
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Starter
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            used >= STARTER_DAILY_LIMIT ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
