/**
 * Integration tests for the full review creation flow
 *
 * Task 24.3 — Integration tests
 *
 * Scenarios:
 * 1. Authenticated POST /api/reviews → DB record created → GET /api/reviews returns it
 * 2. Starter user at limit (3 reviews) → POST → 429
 * 3. Stripe webhook checkout.session.completed → user plan updated to 'pro'
 *    → POST /api/reviews allowed (no rate limit)
 *
 * Requirements: 3.1, 3.5, 3.6, 6.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { CreateReviewResponse, ReviewListResponse } from '@/types'

// ---------------------------------------------------------------------------
// vi.hoisted — creates values that are available inside vi.mock() factories
// (vi.mock factories are hoisted before all import/variable declarations)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // In-memory DB stores
  const usersDb = new Map<string, Record<string, unknown>>()
  const reviewsDb = new Map<string, Record<string, unknown>>()
  const usageDb = new Map<string, number>()
  const customerToUser = new Map<string, string>()
  let reviewIdCounter = 0

  function nextReviewId() {
    return `review-${++reviewIdCounter}`
  }

  function buildTableChain(table: string) {
    const state: {
      filters: Record<string, unknown>
      insertData: Record<string, unknown> | null
      updateData: Record<string, unknown> | null
      upsertData: Record<string, unknown> | null
      upsertOpts: Record<string, unknown> | null
      orderAscending: boolean
      rangeFrom: number
      rangeTo: number
      countMode: boolean
    } = {
      filters: {},
      insertData: null,
      updateData: null,
      upsertData: null,
      upsertOpts: null,
      orderAscending: false,
      rangeFrom: 0,
      rangeTo: 19,
      countMode: false,
    }

    const chain: Record<string, unknown> = {
      select(_cols: string, opts?: { count?: string }) {
        if (opts?.count) state.countMode = true
        return chain
      },
      insert(data: Record<string, unknown>) {
        state.insertData = data
        return chain
      },
      update(data: Record<string, unknown>) {
        state.updateData = data
        return chain
      },
      upsert(data: Record<string, unknown>, opts?: Record<string, unknown>) {
        state.upsertData = data
        state.upsertOpts = opts ?? {}
        // For daily_usage upsert — ensure row exists
        if (table === 'daily_usage' && data['user_id'] && data['date']) {
          const key = `${data['user_id']}::${data['date']}`
          const ignoreDuplicates = (opts as Record<string, unknown>)?.ignoreDuplicates
          if (ignoreDuplicates) {
            if (!usageDb.has(key)) usageDb.set(key, (data['count'] as number) ?? 0)
          } else {
            const existing = usageDb.get(key) ?? 0
            usageDb.set(key, existing + 1)
          }
        }
        return Promise.resolve({ error: null })
      },
      eq(col: string, val: unknown) {
        state.filters[col] = val
        return chain
      },
      order(_col: string, opts: { ascending: boolean }) {
        state.orderAscending = opts.ascending
        return chain
      },
      range(from: number, to: number) {
        state.rangeFrom = from
        state.rangeTo = to
        if (table === 'reviews') {
          const uid = state.filters['user_id'] as string | undefined
          let rows = Array.from(reviewsDb.values())
          if (uid) rows = rows.filter((r) => r['user_id'] === uid)
          rows.sort((a, b) => {
            const diff =
              new Date(b['created_at'] as string).getTime() -
              new Date(a['created_at'] as string).getTime()
            return state.orderAscending ? -diff : diff
          })
          const page = rows.slice(from, to + 1)
          return Promise.resolve({ data: page, error: null, count: rows.length })
        }
        return Promise.resolve({ data: [], error: null, count: 0 })
      },
      single() {
        if (table === 'users') {
          if (state.updateData && state.filters['id']) {
            const uid = state.filters['id'] as string
            const existing = usersDb.get(uid) ?? {}
            const updated = { ...existing, ...state.updateData }
            usersDb.set(uid, updated)
            return Promise.resolve({ data: updated, error: null })
          }
          if (state.insertData) {
            const uid = (state.insertData['id'] ?? '') as string
            usersDb.set(uid, { ...state.insertData })
            return Promise.resolve({ data: state.insertData, error: null })
          }
          if (state.filters['id']) {
            const uid = state.filters['id'] as string
            const row = usersDb.get(uid)
            if (!row) return Promise.resolve({ data: null, error: { message: 'not found' } })
            return Promise.resolve({ data: row, error: null })
          }
          if (state.filters['stripe_customer_id']) {
            const cid = state.filters['stripe_customer_id'] as string
            const uid = customerToUser.get(cid)
            if (!uid) return Promise.resolve({ data: null, error: { message: 'not found' } })
            return Promise.resolve({ data: { id: uid }, error: null })
          }
        }
        if (table === 'reviews') {
          if (state.insertData) {
            const id = nextReviewId()
            const row = { id, ...state.insertData, created_at: new Date().toISOString() }
            reviewsDb.set(id, row)
            return Promise.resolve({ data: row, error: null })
          }
          if (state.filters['id'] && state.filters['user_id']) {
            const rid = state.filters['id'] as string
            const uid = state.filters['user_id'] as string
            const row = reviewsDb.get(rid)
            if (!row || row['user_id'] !== uid) {
              return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
            }
            return Promise.resolve({ data: row, error: null })
          }
        }
        if (table === 'daily_usage') {
          const uid = state.filters['user_id'] as string
          const date = state.filters['date'] as string
          const key = `${uid}::${date}`
          const count = usageDb.get(key) ?? 0
          return Promise.resolve({ data: { count }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'unhandled single' } })
      },
      maybeSingle() {
        if (table === 'daily_usage') {
          const uid = state.filters['user_id'] as string
          const date = state.filters['date'] as string
          const key = `${uid}::${date}`
          const count = usageDb.get(key)
          if (count === undefined) return Promise.resolve({ data: null, error: null })
          return Promise.resolve({ data: { count }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      // Thenable for fire-and-forget .update().eq() chains (used by webhook handler)
      then(resolve: (val: unknown) => void) {
        if (table === 'users' && state.updateData && state.filters['id']) {
          const uid = state.filters['id'] as string
          const existing = usersDb.get(uid) ?? {}
          usersDb.set(uid, { ...existing, ...state.updateData })
        }
        resolve({ error: null })
      },
    }

    return chain
  }

  const getUser = vi.fn()

  function buildSupabaseClient() {
    return {
      auth: { getUser },
      from: (table: string) => buildTableChain(table),
      rpc(fnName: string, args: Record<string, string>) {
        if (fnName === 'increment_daily_usage') {
          const key = `${args['p_user_id']}::${args['p_date']}`
          usageDb.set(key, (usageDb.get(key) ?? 0) + 1)
          return Promise.resolve({ error: null })
        }
        return Promise.resolve({ error: { message: 'Unknown RPC' } })
      },
    }
  }

  return {
    usersDb,
    reviewsDb,
    usageDb,
    customerToUser,
    getUser,
    buildSupabaseClient,
    generateReview: vi.fn(),
    constructEvent: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// vi.mock — factories can reference `mocks` because it was created with vi.hoisted
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.buildSupabaseClient(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mocks.buildSupabaseClient(),
}))

vi.mock('@/lib/openai', () => ({
  generateReview: (...args: unknown[]) => mocks.generateReview(...args),
  AIServiceError: class AIServiceError extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'AIServiceError'
    }
  },
}))

vi.mock('@/lib/stripe', () => ({
  default: {
    webhooks: { constructEvent: (...a: unknown[]) => mocks.constructEvent(...a) },
  },
}))

// ---------------------------------------------------------------------------
// Import route handlers AFTER mocks are registered
// ---------------------------------------------------------------------------

import { POST, GET } from '@/app/api/reviews/route'
import { POST as webhookPOST } from '@/app/api/webhooks/stripe/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().split('T')[0]

const VALID_AI_RESULT = {
  score: 78,
  summary: 'Good alignment with the role.',
  jobTitle: 'Software Engineer',
  strengths: ['TypeScript skills', 'Relevant experience'],
  improvements: ['Add metrics', 'Tailor summary'],
  keywordMatches: [{ keyword: 'TypeScript', found: true }],
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/reviews', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(page = 1): NextRequest {
  return new NextRequest(`http://localhost/api/reviews?page=${page}`, { method: 'GET' })
}

function makeWebhookRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'valid-sig' },
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mocks.usersDb.clear()
  mocks.reviewsDb.clear()
  mocks.usageDb.clear()
  mocks.customerToUser.clear()
  mocks.getUser.mockReset()
  mocks.generateReview.mockReset()
  mocks.constructEvent.mockReset()
  process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

// ---------------------------------------------------------------------------
// Scenario 1: POST /api/reviews → DB record created → GET returns it
// Requirements: 3.1
// ---------------------------------------------------------------------------

describe('Scenario 1: full review creation flow', () => {
  it('POST creates a review and GET returns it in the list', async () => {
    const userId = 'user-int-1'
    mocks.usersDb.set(userId, { id: userId, plan: 'starter', email: 'test@example.com' })
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } })
    mocks.generateReview.mockResolvedValue(VALID_AI_RESULT)

    // POST /api/reviews
    const postRes = await POST(
      makePostRequest({
        resumeText: 'My resume with TypeScript experience',
        jobDescription: 'We need a TypeScript developer',
      })
    )
    expect(postRes.status).toBe(201)

    const created = (await postRes.json()) as CreateReviewResponse
    expect(created.score).toBe(78)
    expect(created.id).toBeTruthy()

    // GET /api/reviews — should include the newly created review
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } })
    const getRes = await GET(makeGetRequest())
    expect(getRes.status).toBe(200)

    const list = (await getRes.json()) as ReviewListResponse
    expect(list.totalCount).toBe(1)
    expect(list.reviews[0].id).toBe(created.id)
    expect(list.reviews[0].score).toBe(78)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Starter user at limit → 429
// Requirements: 3.5
// ---------------------------------------------------------------------------

describe('Scenario 2: starter user at daily limit returns 429', () => {
  it('returns HTTP 429 when daily_usage count >= 3', async () => {
    const userId = 'user-int-2'
    mocks.usersDb.set(userId, { id: userId, plan: 'starter' })
    mocks.usageDb.set(`${userId}::${TODAY}`, 3) // already at limit

    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } })
    mocks.generateReview.mockResolvedValue(VALID_AI_RESULT)

    const res = await POST(
      makePostRequest({ resumeText: 'My resume', jobDescription: 'A job description' })
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/limit/i)
    expect(body.upgradeUrl).toBe('/dashboard/billing')
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Stripe webhook upgrades user to pro → POST allowed
// Requirements: 3.6, 6.2
// ---------------------------------------------------------------------------

describe('Scenario 3: after pro upgrade via webhook, reviews are unrestricted', () => {
  it('checkout.session.completed webhook sets plan=pro, then POST succeeds despite usage limit', async () => {
    const userId = 'user-int-3'
    const customerId = 'cus_int'
    const subscriptionId = 'sub_int'

    // Start as starter with usage at limit
    mocks.usersDb.set(userId, { id: userId, plan: 'starter' })
    mocks.usageDb.set(`${userId}::${TODAY}`, 3)

    // Fire the webhook
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId },
          customer: customerId,
          subscription: subscriptionId,
        },
      },
    }
    mocks.constructEvent.mockReturnValue(event)

    const webhookRes = await webhookPOST(makeWebhookRequest(event))
    expect(webhookRes.status).toBe(200)

    // Verify plan upgraded in memory
    expect(mocks.usersDb.get(userId)?.plan).toBe('pro')

    // Now POST — pro user is never rate-limited
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } })
    mocks.generateReview.mockResolvedValue(VALID_AI_RESULT)

    const postRes = await POST(
      makePostRequest({ resumeText: 'Pro user resume', jobDescription: 'Senior engineer role' })
    )

    expect(postRes.status).toBe(201)
    const created = (await postRes.json()) as CreateReviewResponse
    expect(created.score).toBe(78)
  })
})
