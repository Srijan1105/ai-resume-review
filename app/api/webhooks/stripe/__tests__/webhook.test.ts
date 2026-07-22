/**
 * Tests for the Stripe webhook handler
 *
 * Task 20.2 — Property 4: Webhook processing is idempotent
 * Task 20.3 — Unit tests for handleStripeWebhook
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Track all DB writes so we can assert idempotency
type UserRecord = {
  plan?: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
}

// In-memory DB: userId → UserRecord
const db = new Map<string, UserRecord>()
// Map: customerId → userId (for subscription.deleted lookup)
const customerToUser = new Map<string, string>()

// Mock Supabase admin client
const mockConstructEvent = vi.fn()

vi.mock('@/lib/stripe', () => {
  return {
    default: {
      webhooks: {
        constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
      },
    },
  }
})

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => buildSupabaseMock(),
  }
})

function buildSupabaseMock() {
  return {
    from(table: string) {
      if (table !== 'users') throw new Error(`Unexpected table: ${table}`)

      let _filters: Record<string, string> = {}
      let _updates: UserRecord = {}

      const chain = {
        select(_cols: string) {
          return chain
        },
        update(data: UserRecord) {
          _updates = data
          return chain
        },
        eq(col: string, val: string) {
          _filters[col] = val
          return chain
        },
        single() {
          // Used for SELECT by stripe_customer_id
          const customerId = _filters['stripe_customer_id']
          const userId = customerToUser.get(customerId)
          if (!userId) {
            return Promise.resolve({ data: null, error: { message: 'not found' } })
          }
          return Promise.resolve({ data: { id: userId }, error: null })
        },
        then(resolve: (val: { error: null }) => void) {
          // Used for UPDATE — apply to in-memory DB
          const userId = _filters['id']
          if (userId) {
            const existing = db.get(userId) ?? {}
            db.set(userId, { ...existing, ..._updates })
          }
          resolve({ error: null })
        },
      }

      // Make the chain thenable so `await supabaseAdmin.from(...).update(...).eq(...)` works
      return chain
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
    },
  })
}

function makeCheckoutEvent(userId: string, customerId: string, subscriptionId: string) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        metadata: { userId },
        customer: customerId,
        subscription: subscriptionId,
      },
    },
  }
}

function makeSubscriptionDeletedEvent(customerId: string) {
  return {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        customer: customerId,
      },
    },
  }
}

function makeUnknownEvent() {
  return {
    type: 'payment_intent.created',
    data: { object: {} },
  }
}

// Import AFTER mocks are set up
import { POST } from '@/app/api/webhooks/stripe/route'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  db.clear()
  customerToUser.clear()
  mockConstructEvent.mockReset()
  process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

// ---------------------------------------------------------------------------
// Task 20.3 — Unit tests
// ---------------------------------------------------------------------------

describe('Stripe webhook handler — unit tests', () => {

  describe('checkout.session.completed → upgrades user to pro', () => {
    it('sets plan=pro, stores customer and subscription IDs', async () => {
      const userId = 'user-abc'
      const customerId = 'cus_123'
      const subscriptionId = 'sub_456'

      db.set(userId, { plan: 'starter' })
      const event = makeCheckoutEvent(userId, customerId, subscriptionId)
      mockConstructEvent.mockReturnValue(event)

      const req = makeRequest(JSON.stringify(event), 'valid-sig')
      const res = await POST(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)

      const user = db.get(userId)
      expect(user?.plan).toBe('pro')
      expect(user?.stripe_customer_id).toBe(customerId)
      expect(user?.stripe_subscription_id).toBe(subscriptionId)
      expect(user?.subscription_status).toBe('active')
    })
  })

  describe('customer.subscription.deleted → downgrades user to starter', () => {
    it('sets plan=starter, subscription_status=canceled', async () => {
      const userId = 'user-xyz'
      const customerId = 'cus_999'

      db.set(userId, { plan: 'pro', stripe_customer_id: customerId, subscription_status: 'active' })
      customerToUser.set(customerId, userId)

      const event = makeSubscriptionDeletedEvent(customerId)
      mockConstructEvent.mockReturnValue(event)

      const req = makeRequest(JSON.stringify(event), 'valid-sig')
      const res = await POST(req)

      expect(res.status).toBe(200)

      const user = db.get(userId)
      expect(user?.plan).toBe('starter')
      expect(user?.subscription_status).toBe('canceled')
      expect(user?.stripe_subscription_id).toBeNull()
    })
  })

  describe('invalid signature → returns 400, no DB write', () => {
    it('returns HTTP 400 when constructEvent throws', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      const sizeBefore = db.size
      const req = makeRequest('{}', 'bad-sig')
      const res = await POST(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Invalid webhook signature/)
      // DB must not have changed
      expect(db.size).toBe(sizeBefore)
    })
  })

  describe('unknown event type → returns 200, no DB write', () => {
    it('returns HTTP 200 and takes no DB action for unhandled event types', async () => {
      const event = makeUnknownEvent()
      mockConstructEvent.mockReturnValue(event)

      const dbSnapshot = new Map(db)
      const req = makeRequest(JSON.stringify(event), 'valid-sig')
      const res = await POST(req)

      expect(res.status).toBe(200)
      // DB unchanged
      expect(db.size).toBe(dbSnapshot.size)
    })
  })

  describe('missing stripe-signature header → returns 400', () => {
    it('returns HTTP 400 when stripe-signature header is absent', async () => {
      const req = new NextRequest('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
        // no stripe-signature header
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })
})

// ---------------------------------------------------------------------------
// Task 20.2 — Property 4: Webhook processing is idempotent
// Validates: Requirement 6.6
// ---------------------------------------------------------------------------

describe('Property 4: Webhook processing is idempotent', () => {
  it(
    'processing checkout.session.completed N times produces the same DB state as once',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),         // userId
          fc.uuid(),         // customerId  
          fc.uuid(),         // subscriptionId
          fc.integer({ min: 1, max: 5 }), // N repetitions
          async (userId, customerId, subscriptionId, n) => {
            db.clear()
            db.set(userId, { plan: 'starter' })

            const event = makeCheckoutEvent(userId, customerId, subscriptionId)
            mockConstructEvent.mockReturnValue(event)

            // Process the event N times
            for (let i = 0; i < n; i++) {
              const req = makeRequest(JSON.stringify(event), 'valid-sig')
              const res = await POST(req)
              if (res.status !== 200) return false
            }

            const stateAfterN = { ...db.get(userId) }

            // Reset and process once
            db.clear()
            db.set(userId, { plan: 'starter' })
            mockConstructEvent.mockReturnValue(event)

            const reqOnce = makeRequest(JSON.stringify(event), 'valid-sig')
            await POST(reqOnce)

            const stateAfterOne = { ...db.get(userId) }

            // Both states must be identical
            return (
              stateAfterN.plan === stateAfterOne.plan &&
              stateAfterN.stripe_customer_id === stateAfterOne.stripe_customer_id &&
              stateAfterN.stripe_subscription_id === stateAfterOne.stripe_subscription_id &&
              stateAfterN.subscription_status === stateAfterOne.subscription_status
            )
          }
        ),
        { numRuns: 25 }
      )
    }
  )

  it(
    'processing customer.subscription.deleted N times produces the same DB state as once',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),  // userId
          fc.uuid(),  // customerId
          fc.integer({ min: 1, max: 5 }),
          async (userId, customerId, n) => {
            db.clear()
            customerToUser.clear()
            db.set(userId, { plan: 'pro', stripe_customer_id: customerId, subscription_status: 'active' })
            customerToUser.set(customerId, userId)

            const event = makeSubscriptionDeletedEvent(customerId)
            mockConstructEvent.mockReturnValue(event)

            for (let i = 0; i < n; i++) {
              const req = makeRequest(JSON.stringify(event), 'valid-sig')
              const res = await POST(req)
              if (res.status !== 200) return false
            }

            const stateAfterN = { ...db.get(userId) }

            // Reset and process once
            db.clear()
            customerToUser.clear()
            db.set(userId, { plan: 'pro', stripe_customer_id: customerId, subscription_status: 'active' })
            customerToUser.set(customerId, userId)
            mockConstructEvent.mockReturnValue(event)

            const reqOnce = makeRequest(JSON.stringify(event), 'valid-sig')
            await POST(reqOnce)

            const stateAfterOne = { ...db.get(userId) }

            return (
              stateAfterN.plan === stateAfterOne.plan &&
              stateAfterN.subscription_status === stateAfterOne.subscription_status
            )
          }
        ),
        { numRuns: 25 }
      )
    }
  )
})
