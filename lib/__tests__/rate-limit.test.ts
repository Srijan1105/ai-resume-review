/**
 * Tests for checkRateLimit()
 *
 * Task 9.2 — Property 1: Starter users cannot exceed daily limit
 * Task 9.3 — Property 2: Pro users are never rate-limited
 * Task 9.4 — Unit tests for checkRateLimit boundary values
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { checkRateLimit } from '@/lib/rate-limit'
import { STARTER_DAILY_LIMIT } from '@/lib/constants'

// ---------------------------------------------------------------------------
// In-memory mock Supabase client
// ---------------------------------------------------------------------------
// The mock tracks rows as: Map<`${user_id}::${date}`, { user_id, date, count }>
// It implements the subset of the Supabase query API used by checkRateLimit:
//   supabase.from('daily_usage').upsert(...)
//   supabase.from('daily_usage').select('count').eq(...).eq(...).single()

type UsageRow = { user_id: string; date: string; count: number }

function createMockSupabase(initialCount: number = 0, userId?: string) {
  const today = new Date().toISOString().split('T')[0]
  const store = new Map<string, UsageRow>()

  // Pre-seed the store if a specific count is requested
  if (userId !== undefined) {
    store.set(`${userId}::${today}`, { user_id: userId, date: today, count: initialCount })
  }

  function rowKey(uid: string, date: string) {
    return `${uid}::${date}`
  }

  // Returns a chainable query builder that supports:
  //   .from('daily_usage')
  //   .upsert(row, { onConflict, ignoreDuplicates })
  //   .select('count').eq('user_id', uid).eq('date', d).single()
  const supabase = {
    from(table: string) {
      if (table !== 'daily_usage') throw new Error(`Unexpected table: ${table}`)

      return {
        // upsert: insert row if not present (ignoreDuplicates = true means ON CONFLICT DO NOTHING)
        upsert(
          row: UsageRow,
          opts: { onConflict: string; ignoreDuplicates: boolean }
        ) {
          const key = rowKey(row.user_id, row.date)
          if (opts.ignoreDuplicates) {
            // Only insert if the row doesn't exist yet
            if (!store.has(key)) {
              store.set(key, { ...row })
            }
          } else {
            // Overwrite (not used in checkRateLimit but included for completeness)
            store.set(key, { ...row })
          }
          return Promise.resolve({ error: null })
        },

        // select(...).eq(...).eq(...).single()
        select(_cols: string) {
          const filters: Record<string, string> = {}

          const builder = {
            eq(col: string, val: string) {
              filters[col] = val
              return builder
            },
            single() {
              const uid = filters['user_id']
              const date = filters['date']
              const key = rowKey(uid, date)
              const row = store.get(key)
              if (!row) {
                return Promise.resolve({
                  data: null,
                  error: { message: 'Row not found' },
                })
              }
              return Promise.resolve({ data: { count: row.count }, error: null })
            },
          }
          return builder
        },
      }
    },
  }

  return supabase as any
}

// ---------------------------------------------------------------------------
// Task 9.2 — Property 1: Starter users cannot exceed daily limit
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe('Property 1: Starter users cannot exceed daily limit', () => {
  it('4th call returns { allowed: false, remaining: 0 } for any userId', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const today = new Date().toISOString().split('T')[0]
        const store = new Map<string, UsageRow>()

        // Build a fresh mock for this userId that auto-increments on each call
        // (simulating the API route calling checkRateLimit before incrementing)
        // For this test we seed counts 0..2 manually then check the 4th call.
        // The mock does NOT auto-increment — checkRateLimit only reads.
        // We seed with count = 3 for the 4th call scenario.
        let callCount = 0

        function createCountingMock() {
          return {
            from(table: string) {
              return {
                upsert(row: UsageRow, opts: any) {
                  const key = `${row.user_id}::${row.date}`
                  if (opts.ignoreDuplicates) {
                    if (!store.has(key)) {
                      store.set(key, { ...row })
                    }
                  }
                  return Promise.resolve({ error: null })
                },
                select(_cols: string) {
                  const filters: Record<string, string> = {}
                  const builder = {
                    eq(col: string, val: string) {
                      filters[col] = val
                      return builder
                    },
                    single() {
                      const uid = filters['user_id']
                      const date = filters['date']
                      const key = `${uid}::${date}`
                      const row = store.get(key)
                      return Promise.resolve({
                        data: row ? { count: row.count } : null,
                        error: row ? null : { message: 'Row not found' },
                      })
                    },
                  }
                  return builder
                },
              }
            },
          } as any
        }

        const supabase = createCountingMock()

        // Simulate 3 allowed calls (each representing a full review cycle
        // where the API route increments count after checkRateLimit returns allowed)
        for (let i = 0; i < 3; i++) {
          const result = await checkRateLimit(supabase, userId, 'starter')
          // After each allowed call, simulate the API route incrementing the count
          const key = `${userId}::${today}`
          const row = store.get(key) ?? { user_id: userId, date: today, count: 0 }
          store.set(key, { ...row, count: row.count + 1 })
          callCount++
        }

        // 4th call: count is now 3 = STARTER_DAILY_LIMIT
        const fourth = await checkRateLimit(supabase, userId, 'starter')

        return fourth.allowed === false && fourth.remaining === 0
      }),
      { numRuns: 25 }
    )
  })
})

// ---------------------------------------------------------------------------
// Task 9.3 — Property 2: Pro users are never rate-limited
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------
describe('Property 2: Pro users are never rate-limited', () => {
  it('always returns { allowed: true } regardless of daily usage count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        async (userId, usageCount) => {
          // Build mock pre-seeded with the arbitrary usage count
          const supabase = createMockSupabase(usageCount, userId)
          const result = await checkRateLimit(supabase, userId, 'pro')
          return result.allowed === true
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Task 9.4 — Unit tests for checkRateLimit boundary values
// Requirements: 3.5, 3.6
// ---------------------------------------------------------------------------
describe('checkRateLimit — unit tests', () => {
  describe('Starter plan boundary values', () => {
    const userId = 'user-test-id'

    async function check(count: number) {
      const supabase = createMockSupabase(count, userId)
      return checkRateLimit(supabase, userId, 'starter')
    }

    it('count = 0 → allowed: true, remaining: 3', async () => {
      const result = await check(0)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3)
    })

    it('count = 1 → allowed: true, remaining: 2', async () => {
      const result = await check(1)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })

    it('count = 2 → allowed: true, remaining: 1', async () => {
      const result = await check(2)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('count = 3 → allowed: false, remaining: 0', async () => {
      const result = await check(3)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('count = 4 → allowed: false, remaining: 0', async () => {
      const result = await check(4)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('Pro plan', () => {
    it('always returns { allowed: true, remaining: Infinity } regardless of count', async () => {
      const userId = 'pro-user-id'
      for (const count of [0, 1, 3, 10, 100]) {
        const supabase = createMockSupabase(count, userId)
        const result = await checkRateLimit(supabase, userId, 'pro')
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(Infinity)
      }
    })

    it('pro plan does not access the database', async () => {
      // Mock with a broken DB to confirm pro path never calls it
      const brokenSupabase = {
        from() {
          throw new Error('DB should not be accessed for pro users')
        },
      } as any

      const result = await checkRateLimit(brokenSupabase, 'any-user', 'pro')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })
  })
})
