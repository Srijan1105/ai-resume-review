import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import stripe from '@/lib/stripe'

export async function POST(_req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single()

  const subscriptionId = userRecord?.stripe_subscription_id

  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 400 }
    )
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })

  const cancelAt =
    subscription.cancel_at != null
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null

  return NextResponse.json({ cancelAt })
}
