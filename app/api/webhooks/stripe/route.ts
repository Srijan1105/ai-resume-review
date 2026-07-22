/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Verifies Stripe webhook signatures and processes subscription lifecycle events:
 * - checkout.session.completed → upgrade user to Pro
 * - customer.subscription.deleted → downgrade user to Starter
 *
 * Uses the Node.js runtime for raw body access.
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import stripe from '@/lib/stripe'

// Must use Node.js runtime to access raw request body (not Edge runtime)
export const runtime = 'nodejs'

/**
 * Supabase admin client — bypasses RLS for server-side writes.
 * Uses the service role key instead of the anon key.
 */
const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body — must NOT use req.json() for signature verification
  const rawBody = await req.text()

  // 2. Get the Stripe signature header
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // 3. Verify signature — return 400 on failure (Req 6.4)
  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook signature verification failed: ${message}`)
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  // 4. Route by event type
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Extract fields from the completed checkout session
        const session = event.data.object as import('stripe').Stripe.Checkout.Session

        const userId = session.metadata?.userId
        const customerId = session.customer as string | null
        const subscriptionId = session.subscription as string | null

        if (!userId) {
          console.warn('checkout.session.completed: missing metadata.userId')
          // Return 200 to prevent Stripe from retrying — nothing we can do without userId
          return NextResponse.json({ received: true })
        }

        // Update user to Pro — upsert ensures idempotency (Req 6.2, 6.6)
        const { error } = await supabaseAdmin
          .from('users')
          .update({
            plan: 'pro',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
          })
          .eq('id', userId)

        if (error) {
          console.error('Failed to upgrade user to pro:', error)
          return NextResponse.json(
            { error: 'Database update failed' },
            { status: 500 }
          )
        }

        break
      }

      case 'customer.subscription.deleted': {
        // Downgrade user when their subscription is deleted (Req 6.3)
        const subscription = event.data.object as import('stripe').Stripe.Subscription

        const customerId = subscription.customer as string

        // Find user by stripe_customer_id
        const { data: userRecord, error: lookupError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (lookupError || !userRecord) {
          console.warn(
            `customer.subscription.deleted: no user found for customer ${customerId}`
          )
          // Return 200 to avoid Stripe retries — per design error handling table
          return NextResponse.json({ received: true })
        }

        // Downgrade to starter — idempotent SET operation (Req 6.3, 6.6)
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            plan: 'starter',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('id', userRecord.id)

        if (updateError) {
          console.error('Failed to downgrade user to starter:', updateError)
          return NextResponse.json(
            { error: 'Database update failed' },
            { status: 500 }
          )
        }

        break
      }

      default:
        // All other event types: silently ignore and return 200 (Req 6.5)
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook handler error: ${message}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 5. Return 200 for all handled events
  return NextResponse.json({ received: true })
}
