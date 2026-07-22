/**
 * Tests for generateReview() and buildReviewPrompt()
 *
 * Task 10.2 — Property 3: AI review result is structurally valid
 * Task 10.3 — Unit tests for generateReview
 *
 * Validates: Requirements 3.4, 3.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { AIReviewResult } from '@/types'

// ---------------------------------------------------------------------------
// Mock the 'openai' module before importing lib/openai
// ---------------------------------------------------------------------------

// We capture a mutable reference to the mock implementation so individual
// tests can control what `chat.completions.create` returns.
const mockCreate = vi.fn()

vi.mock('openai', () => {
  // The default export is the OpenAI class
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
  return { default: MockOpenAI }
})

// Import AFTER mocking so the module picks up the mock
import { generateReview, buildReviewPrompt, AIServiceError } from '@/lib/openai'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal but valid AIReviewResult JSON string for mocking.
 */
function makeValidResponseContent(overrides: Partial<AIReviewResult> = {}): string {
  const result: AIReviewResult = {
    score: 75,
    summary: 'A solid resume with good alignment.',
    jobTitle: 'Software Engineer',
    strengths: ['Strong technical background', 'Good communication skills'],
    improvements: ['Add more metrics', 'Tailor summary to role'],
    keywordMatches: [{ keyword: 'TypeScript', found: true, context: 'Used TypeScript daily' }],
    ...overrides,
  }
  return JSON.stringify(result)
}

/**
 * Returns a fake OpenAI completion response wrapping the given content string.
 */
function makeCompletion(content: string) {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Reset module-level _client between tests so mocks take effect cleanly
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetModules()
  mockCreate.mockReset()
  // Ensure OPENAI_API_KEY is set so getClient() doesn't throw
  process.env.OPENAI_API_KEY = 'test-api-key'
})

// ---------------------------------------------------------------------------
// Task 10.2 — Property 3: AI review result is structurally valid
// **Validates: Requirements 3.4**
// ---------------------------------------------------------------------------
describe('Property 3: AI review result is structurally valid', () => {
  it(
    'score in [0,100], strengths.length >= 1, improvements.length >= 1 for any valid resume+JD inputs',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 8000 }),
          fc.string({ minLength: 1, maxLength: 4000 }),
          // Generate a score in [0, 100] so the mock response varies
          fc.integer({ min: 0, max: 100 }),
          async (resumeText, jobDescription, score) => {
            mockCreate.mockResolvedValueOnce(
              makeCompletion(
                makeValidResponseContent({
                  score,
                  strengths: ['Strength 1'],
                  improvements: ['Improvement 1'],
                })
              )
            )

            const result = await generateReview(resumeText, jobDescription)

            return (
              typeof result.score === 'number' &&
              result.score >= 0 &&
              result.score <= 100 &&
              Array.isArray(result.strengths) &&
              result.strengths.length >= 1 &&
              Array.isArray(result.improvements) &&
              result.improvements.length >= 1
            )
          }
        ),
        { numRuns: 50 }
      )
    }
  )
})

// ---------------------------------------------------------------------------
// Task 10.3 — Unit tests for generateReview
// Requirements: 3.4, 3.7
// ---------------------------------------------------------------------------
describe('generateReview — unit tests', () => {

  // 1. Successful response parsing
  describe('successful response parsing', () => {
    it('returns a valid AIReviewResult when OpenAI returns well-formed JSON', async () => {
      const expected: AIReviewResult = {
        score: 82,
        summary: 'Excellent match for the role.',
        jobTitle: 'Frontend Developer',
        strengths: ['React expertise', 'Strong portfolio'],
        improvements: ['More open source contributions', 'Add testing experience'],
        keywordMatches: [
          { keyword: 'React', found: true, context: 'Built React applications' },
          { keyword: 'GraphQL', found: false },
        ],
      }

      mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(expected)))

      const result = await generateReview('My resume text', 'Frontend Developer at Acme')

      expect(result.score).toBe(82)
      expect(result.summary).toBe('Excellent match for the role.')
      expect(result.jobTitle).toBe('Frontend Developer')
      expect(result.strengths).toEqual(['React expertise', 'Strong portfolio'])
      expect(result.improvements).toEqual([
        'More open source contributions',
        'Add testing experience',
      ])
      expect(result.keywordMatches).toHaveLength(2)
      expect(result.keywordMatches[0]).toEqual({
        keyword: 'React',
        found: true,
        context: 'Built React applications',
      })
      expect(result.keywordMatches[1]).toEqual({ keyword: 'GraphQL', found: false })
    })
  })

  // 2. AIServiceError on malformed / non-JSON response
  describe('non-JSON response throws AIServiceError', () => {
    it('throws AIServiceError when OpenAI returns "not json"', async () => {
      mockCreate.mockResolvedValue(makeCompletion('not json'))

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Failed to parse OpenAI response as JSON/)
    })

    it('throws AIServiceError when OpenAI returns empty string', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })

      await expect(generateReview('resume', 'job description')).rejects.toThrow(AIServiceError)
    })

    it('throws AIServiceError when OpenAI returns null content', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] })

      await expect(generateReview('resume', 'job description')).rejects.toThrow(AIServiceError)
    })
  })

  // 3. AIServiceError on missing required fields / out-of-range values
  describe('missing or invalid fields throw AIServiceError', () => {
    it('throws AIServiceError when score is out of range (> 100)', async () => {
      mockCreate.mockResolvedValue(
        makeCompletion(makeValidResponseContent({ score: 150 }))
      )

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Invalid score/)
    })

    it('throws AIServiceError when score is out of range (< 0)', async () => {
      mockCreate.mockResolvedValue(
        makeCompletion(makeValidResponseContent({ score: -5 }))
      )

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Invalid score/)
    })

    it('throws AIServiceError when strengths is empty array', async () => {
      mockCreate.mockResolvedValue(
        makeCompletion(makeValidResponseContent({ strengths: [] }))
      )

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Invalid strengths/)
    })

    it('throws AIServiceError when improvements is empty array', async () => {
      mockCreate.mockResolvedValue(
        makeCompletion(makeValidResponseContent({ improvements: [] }))
      )

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Invalid improvements/)
    })

    it('throws AIServiceError when score field is missing entirely', async () => {
      const noScore = { summary: 'ok', jobTitle: 'Dev', strengths: ['s'], improvements: ['i'], keywordMatches: [] }
      mockCreate.mockResolvedValue(makeCompletion(JSON.stringify(noScore)))

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/Invalid score/)
    })

    it('throws AIServiceError when response is a JSON string, not an object', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('"just a string"'))

      await expect(generateReview('resume', 'job description')).rejects.toThrow(AIServiceError)
    })
  })

  // 4. buildReviewPrompt output contains both resume and JD text
  describe('buildReviewPrompt', () => {
    it('contains the resume text in the user message', () => {
      const resume = 'My unique resume content XYZ123'
      const jd = 'Senior Engineer at Tech Corp'
      const messages = buildReviewPrompt(resume, jd)

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage!.content).toContain(resume)
    })

    it('contains the job description text in the user message', () => {
      const resume = 'Candidate resume text'
      const jd = 'Unique job description ABC987'
      const messages = buildReviewPrompt(resume, jd)

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage!.content).toContain(jd)
    })

    it('includes a system message', () => {
      const messages = buildReviewPrompt('resume', 'jd')
      const systemMessage = messages.find((m) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(typeof systemMessage!.content).toBe('string')
      expect((systemMessage!.content as string).length).toBeGreaterThan(0)
    })

    it('returns an array with exactly 2 messages (system + user)', () => {
      const messages = buildReviewPrompt('resume text', 'job description text')
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })
  })

  // 5. AIServiceError thrown when OpenAI API call throws
  describe('OpenAI API call failure throws AIServiceError', () => {
    it('wraps network errors as AIServiceError', async () => {
      mockCreate.mockRejectedValue(new Error('Network timeout'))

      const err = await generateReview('resume', 'job description').catch((e) => e)
      expect(err).toBeInstanceOf(AIServiceError)
      expect(err.message).toMatch(/OpenAI API call failed/)
    })

    it('wraps rate limit errors from OpenAI as AIServiceError', async () => {
      const rateLimitError = new Error('429 Too Many Requests')
      mockCreate.mockRejectedValueOnce(rateLimitError)

      await expect(generateReview('resume', 'job description')).rejects.toThrow(AIServiceError)
    })

    it('wraps unexpected thrown values as AIServiceError', async () => {
      mockCreate.mockRejectedValueOnce('string error')

      await expect(generateReview('resume', 'job description')).rejects.toThrow(AIServiceError)
    })
  })
})
