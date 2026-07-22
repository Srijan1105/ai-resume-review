import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import stripe from '@/lib/stripe'

const checkoutSchema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { priceId } = parsed.data

  // Fetch user email from public.users table
  const { data: userRecord } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .single()

  const customerEmail = userRecord?.email ?? user.email ?? undefined

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: user.id },
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
