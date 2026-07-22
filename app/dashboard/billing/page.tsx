import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'
import UsageMeter from '@/components/dashboard/UsageMeter'
import UpgradeButton from '@/components/dashboard/UpgradeButton'
import CancelButton from '@/components/dashboard/CancelButton'
import type { Plan } from '@/types'

interface BillingPageProps {
  searchParams: { success?: string; canceled?: string }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Load user plan + subscription info + today's usage directly from DB
  const today = new Date().toISOString().split('T')[0]

  const [{ data: userRecord }, { data: usageRecord }] = await Promise.all([
    supabase
      .from('users')
      .select('plan, stripe_subscription_id, subscription_status, subscription_ends_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('daily_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  const plan: Plan = (userRecord?.plan as Plan) ?? 'starter'
  const usedToday: number = usageRecord?.count ?? 0
  const subscriptionStatus: string | null = userRecord?.subscription_status ?? null
  const currentPeriodEnd: string | null = userRecord?.subscription_ends_at ?? null
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? ''

  const showSuccess = searchParams.success === 'true'
  const showCanceled = searchParams.canceled === 'true'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Billing &amp; Plan</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and review usage.
        </p>
      </div>

      {/* Success / canceled banners — Req 6.1 */}
      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          🎉 Your subscription has been activated. Welcome to Pro!
        </div>
      )}
      {showCanceled && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Checkout was canceled. Your plan has not changed.
        </div>
      )}

      {/* Current plan card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        {/* Plan badge + usage — Req 7.1 */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Current Plan
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 capitalize">{plan}</p>
            {plan === 'starter' && (
              <p className="mt-0.5 text-sm text-gray-500">
                {STARTER_DAILY_LIMIT} reviews per day
              </p>
            )}
            {plan === 'pro' && (
              <p className="mt-0.5 text-sm text-gray-500">Unlimited reviews per day</p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              plan === 'pro'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {plan === 'pro' ? 'Active' : 'Free'}
          </span>
        </div>

        {/* Usage meter */}
        <UsageMeter plan={plan} usedToday={usedToday} />

        {/* Pro subscription details — Req 7.3 */}
        {plan === 'pro' && subscriptionStatus && (
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              Status:{' '}
              <span className="font-medium capitalize">{subscriptionStatus}</span>
            </p>
            {currentPeriodEnd && (
              <p>
                {subscriptionStatus === 'canceled'
                  ? 'Access until: '
                  : 'Renews on: '}
                <span className="font-medium">
                  {new Date(currentPeriodEnd).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          {/* Starter: upgrade CTA — Req 7.2 */}
          {plan === 'starter' && <UpgradeButton priceId={priceId} />}

          {/* Pro: cancel option — Req 7.3, 7.4 */}
          {plan === 'pro' && subscriptionStatus !== 'canceled' && <CancelButton />}

          {plan === 'pro' && subscriptionStatus === 'canceled' && (
            <p className="text-sm text-gray-500">
              Your subscription is scheduled to cancel at the end of the current period.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
