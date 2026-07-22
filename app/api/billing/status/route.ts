import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'
import type { BillingStatusResponse, Plan } from '@/types'

export async function GET(_req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, subscription_status, subscription_ends_at')
    .eq('id', user.id)
    .single()

  const today = new Date().toISOString().split('T')[0]

  const { data: usageRecord } = await supabase
    .from('daily_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  const plan: Plan = (userRecord?.plan as Plan) ?? 'starter'
  const reviewsThisMonth = usageRecord?.count ?? 0
  const reviewsLimit = plan === 'pro' ? null : STARTER_DAILY_LIMIT

  const response: BillingStatusResponse = {
    plan,
    reviewsThisMonth,
    reviewsLimit,
  }

  if (userRecord?.subscription_status) {
    response.stripeSubscriptionStatus = userRecord.subscription_status
  }

  if (userRecord?.subscription_ends_at) {
    response.currentPeriodEnd = new Date(
      userRecord.subscription_ends_at
    ).toISOString()
  }

  return NextResponse.json(response)
}
