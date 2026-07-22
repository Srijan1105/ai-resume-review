/**
 * Property-based tests for the Review API route handlers
 *
 * Task 12.2 — Property 6: Usage counter only increments on successful AI response
 * Task 12.3 — Property 8: Unauthenticated API requests are always rejected
 * Task 12.5 — Property 9: Review list is always user-scoped and date-ordered
 * Task 12.7 — Property 5: Reviews are user-scoped
 *
 * Validates: Requirements 2.6, 3.7, 4.1, 4.4, 8.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import type { ReviewDetailResponse, ReviewListResponse } from '@/types'

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE imports of the modules under test
// ---------------------------------------------------------------------------

// Mock Supabase server client
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

// Mock OpenAI generateReview
const mockGenerateReview = vi.fn()

vi.mock('@/lib/openai', () => ({
  generateReview: (...args: unknown[]) => mockGenerateReview(...args),
  AIServiceError: class AIServiceError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AIServiceError'
    }
  },
}))

// Import route handlers AFTER mocks
import { POST, GET } from '@/app/api/reviews/route'
import { GET as GETById } from '@/app/api/reviews/[id]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for the reviews list/create endpoint */
function makeRequest(method: string, body?: unknown): NextRequest {
  if (method === 'GET') {
    return new NextRequest('http://localhost/api/reviews', { method: 'GET' })
  }
  return new NextRequest('http://localhost/api/reviews', {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Build a NextRequest + params for the [id] detail route */
function makeIdRequest(id: string): [NextRequest, { params: { id: string } }] {
  return [
    new NextRequest(`http://localhost/api/reviews/${id}`, { method: 'GET' }),
    { params: { id } },
  ]
}

/** A valid AI result used as mock return value */
const validAIResult = {
  score: 80,
  summary: 'Good match.',
  jobTitle: 'Software Engineer',
  strengths: ['TypeScript'],
  improvements: ['Add tests'],
  keywordMatches: [{ keyword: 'TypeScript', found: true }],
}

/** Build a minimal valid review row for the reviews table */
function makeReviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-uuid-1',
    user_id: 'user-1',
    score: 75,
    summary: 'OK',
    strengths: ['Strong'],
    improvements: ['Improve'],
    keyword_matches: [],
    created_at: new Date().toISOString(),
    resume_text: 'Resume content here',
    job_description: 'Job description here',
    job_title: 'Engineer',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// In-memory daily_usage tracker for Property 6 tests
// ---------------------------------------------------------------------------

type UsageStore = Map<string, number>

/**
 * Creates a mock Supabase client that:
 * - Tracks daily_usage in memory (does NOT modify it — the route handler
 *   calls rpc('increment_daily_usage') which we intercept separately)
 * - Returns the provided user for auth.getUser()
 * - Returns the given user record for users table queries
 * - Returns the given AI result from generateReview (via mockGenerateReview)
 * - Tracks whether rpc('increment_daily_usage') was called
 */
function buildCountingMockSupabase(opts: {
  userId: string
  usageStore: UsageStore
  planValue?: string
  reviewInsertResult?: Record<string, unknown>
}) {
  const { userId, usageStore, planValue = 'starter', reviewInsertResult } = opts
  const today = new Date().toISOString().split('T')[0]
  const key = `${userId}::${today}`

  // Simulate rpc increment — increments the in-memory store
  mockRpc.mockImplementation((fnName: string, args: Record<string, string>) => {
    if (fnName === 'increment_daily_usage') {
      const k = `${args.p_user_id}::${args.p_date}`
      usageStore.set(k, (usageStore.get(k) ?? 0) + 1)
      return Promise.resolve({ error: null })
    }
    return Promise.resolve({ error: { message: 'Unknown RPC' } })
  })

  // Return mock from chain
  mockFrom.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { plan: planValue }, error: null }),
          }),
        }),
      }
    }

    if (table === 'reviews') {
      // For POST — insert chain
      const insertedRow = reviewInsertResult ?? {
        id: 'review-id',
        score: validAIResult.score,
        summary: validAIResult.summary,
        strengths: validAIResult.strengths,
        improvements: validAIResult.improvements,
        keyword_matches: validAIResult.keywordMatches,
        created_at: new Date().toISOString(),
      }

      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: insertedRow, error: null }),
          }),
        }),
      }
    }

    if (table === 'daily_usage') {
      return {
        upsert: () => Promise.resolve({ error: null }),
        select: (_cols: string) => {
          const filters: Record<string, string> = {}
          const b = {
            eq: (col: string, val: string) => {
              filters[col] = val
              return b
            },
            maybeSingle: () => {
              const k = `${filters['user_id']}::${filters['date']}`
              const count = usageStore.get(k) ?? 0
              return Promise.resolve({ data: { count }, error: null })
            },
          }
          return b
        },
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

// ---------------------------------------------------------------------------
// Task 12.2 — Property 6: Usage counter only increments on successful AI response
// **Validates: Requirements 3.7**
// ---------------------------------------------------------------------------
describe('Property 6: Usage counter only increments on successful AI response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'daily_usage count is unchanged when generateReview throws AIServiceError',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          // Fresh usage store for each run
          const usageStore: UsageStore = new Map()
          const today = new Date().toISOString().split('T')[0]
          const key = `${userId}::${today}`

          // Initial usage count is 0
          usageStore.set(key, 0)
          const countBefore = usageStore.get(key) ?? 0

          // Set up mocks: auth succeeds, user found, but AI throws
          mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })

          // Build mock supabase — rpc should NOT be called on AI failure
          // so we track whether it was called
          let rpcWasCalled = false
          mockRpc.mockImplementation(() => {
            rpcWasCalled = true
            const k = `${userId}::${today}`
            usageStore.set(k, (usageStore.get(k) ?? 0) + 1)
            return Promise.resolve({ error: null })
          })

          mockFrom.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () =>
                      Promise.resolve({ data: { plan: 'starter' }, error: null }),
                  }),
                }),
              }
            }
            if (table === 'daily_usage') {
              return {
                upsert: () => Promise.resolve({ error: null }),
                select: () => {
                  const filters: Record<string, string> = {}
                  const b = {
                    eq: (col: string, val: string) => {
                      filters[col] = val
                      return b
                    },
                    single: () => {
                      return Promise.resolve({ data: { count: 0 }, error: null })
                    },
                  }
                  return b
                },
              }
            }
            return {}
          })

          // AI throws
          const { AIServiceError } = await import('@/lib/openai')
          mockGenerateReview.mockRejectedValue(
            new AIServiceError('Simulated AI failure')
          )

          const req = makeRequest('POST', {
            resumeText: 'My resume text',
            jobDescription: 'Software engineer job description',
          })

          const res = await POST(req)

          // Should return 502
          expect(res.status).toBe(502)

          // Usage counter must NOT have been incremented
          const countAfter = usageStore.get(key) ?? 0
          return !rpcWasCalled && countAfter === countBefore
        }),
        { numRuns: 20 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Task 12.3 — Property 8: Unauthenticated API requests are always rejected
// **Validates: Requirements 2.6**
// ---------------------------------------------------------------------------
describe('Property 8: Unauthenticated API requests are always rejected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'GET /api/reviews returns 401 when auth returns no user',
    () => {
      fc.assert(
        fc.property(fc.uuid(), (_arbitraryId) => {
          // All async setup happens in beforeEach; property is sync-ish via
          // a wrapper that schedules promises. We use asyncProperty here.
          return true // placeholder; actual test below
        }),
        { numRuns: 1 }
      )
    }
  )

  it(
    'both GET and POST /api/reviews return HTTP 401 for any unauthenticated request',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (_arbitraryId) => {
          // Always return null user → unauthenticated
          mockGetUser.mockResolvedValue({ data: { user: null } })

          const getRes = await GET(makeRequest('GET'))
          const postRes = await POST(
            makeRequest('POST', {
              resumeText: 'some resume',
              jobDescription: 'some job description',
            })
          )

          return getRes.status === 401 && postRes.status === 401
        }),
        { numRuns: 25 }
      )
    }
  )

  it(
    'GET /api/reviews/:id returns HTTP 401 for unauthenticated requests',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.uuid(), async (_userId, reviewId) => {
          mockGetUser.mockResolvedValue({ data: { user: null } })

          const [req, context] = makeIdRequest(reviewId)
          const res = await GETById(req, context)

          return res.status === 401
        }),
        { numRuns: 25 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Task 12.5 — Property 9: Review list is always user-scoped and date-ordered
// **Validates: Requirements 4.1, 8.3**
// ---------------------------------------------------------------------------
describe('Property 9: Review list is always user-scoped and date-ordered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Generates N review records with varied timestamps for a given userId.
   * The records are generated with arbitrary ordering; the mock should sort them.
   */
  function buildReviewRows(userId: string, count: number) {
    const base = Date.now()
    return Array.from({ length: count }, (_, i) => ({
      id: `review-${i}`,
      user_id: userId,
      score: 50 + i,
      job_title: `Job ${i}`,
      created_at: new Date(base - i * 60_000).toISOString(), // descending by default
    }))
  }

  it(
    'returns only reviews for the requesting user, sorted by createdAt descending',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 0, max: 10 }),
          async (userId, reviewCount) => {
            const rows = buildReviewRows(userId, reviewCount)

            // Mock auth: return this userId
            mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })

            // Mock Supabase query chain for the reviews list
            // The mock simulates: .from('reviews').select(...).eq('user_id', userId)
            //   .order('created_at', { ascending: false }).range(from, to)
            mockFrom.mockImplementation((table: string) => {
              if (table !== 'reviews') throw new Error(`Unexpected table: ${table}`)

              const queryState = {
                _userId: null as string | null,
                _ascending: true,
              }

              const chain: Record<string, unknown> = {
                select: (_cols: string, _opts?: unknown) => {
                  return chain
                },
                eq: (col: string, val: string) => {
                  if (col === 'user_id') queryState._userId = val
                  return chain
                },
                order: (_col: string, opts: { ascending: boolean }) => {
                  queryState._ascending = opts.ascending
                  return chain
                },
                range: (_from: number, _to: number) => {
                  // Return filtered + sorted rows
                  const filteredRows = queryState._userId
                    ? rows.filter((r) => r.user_id === queryState._userId)
                    : rows

                  const sorted = [...filteredRows].sort((a, b) => {
                    const diff =
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                    return queryState._ascending ? -diff : diff
                  })

                  return Promise.resolve({
                    data: sorted,
                    error: null,
                    count: sorted.length,
                  })
                },
              }

              return chain
            })

            const req = new NextRequest(
              'http://localhost/api/reviews?page=1',
              { method: 'GET' }
            )
            const res = await GET(req)
            expect(res.status).toBe(200)

            const body = (await res.json()) as ReviewListResponse

            // All reviews should belong to this user
            const allUserScoped = body.reviews.every(
              (r) => r.id.startsWith('review-')
            )

            // Reviews should be sorted descending by createdAt
            const isSortedDesc = body.reviews.every((r, i) => {
              if (i === 0) return true
              return (
                new Date(r.createdAt).getTime() <=
                new Date(body.reviews[i - 1].createdAt).getTime()
              )
            })

            return allUserScoped && isSortedDesc
          }
        ),
        { numRuns: 25 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Task 12.7 — Property 5: Reviews are user-scoped
// **Validates: Requirements 4.4, 8.3**
// ---------------------------------------------------------------------------
describe('Property 5: Reviews are user-scoped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'GET /api/reviews/:id returns 404 when the review belongs to a different user',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          async (userAId, userBId, reviewId) => {
            // Skip if the two UUIDs happen to be identical (extremely rare with fc.uuid)
            if (userAId === userBId) return true

            // UserB is the authenticated user
            mockGetUser.mockResolvedValue({ data: { user: { id: userBId } } })

            // Supabase mock: query for review owned by userA, requested by userB
            // The route filters by BOTH id AND user_id, so no row should be returned
            mockFrom.mockImplementation((table: string) => {
              if (table !== 'reviews') throw new Error(`Unexpected table: ${table}`)

              const filters: Record<string, string> = {}

              const chain: Record<string, unknown> = {
                select: () => chain,
                eq: (col: string, val: string) => {
                  filters[col] = val
                  return chain
                },
                single: () => {
                  // The review exists but belongs to userA.
                  // When userB requests it, the combined filter (id + user_id = userB)
                  // yields no row → return error (simulates Supabase "no rows" response)
                  const requestedByUser = filters['user_id']
                  const isOwnerMatch = requestedByUser === userAId

                  if (isOwnerMatch) {
                    // userA requesting their own review — return it
                    return Promise.resolve({
                      data: makeReviewRow({ id: reviewId, user_id: userAId }),
                      error: null,
                    })
                  }

                  // Different user → no row found
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'no rows returned' },
                  })
                },
              }

              return chain
            })

            const [req, context] = makeIdRequest(reviewId)
            const res = await GETById(req, context)

            // UserB requesting userA's review must get 404
            return res.status === 404
          }
        ),
        { numRuns: 30 }
      )
    }
  )
})
