import OpenAI from 'openai'
import type { AIReviewResult, KeywordMatch } from '@/types'

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

/**
 * Thrown when the OpenAI API call fails or returns a response that cannot be
 * parsed / validated into a well-formed `AIReviewResult`.
 */
export class AIServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AIServiceError'
  }
}

// ---------------------------------------------------------------------------
// OpenAI client (lazily initialised so the module can be imported in tests
// without a real key)
// ---------------------------------------------------------------------------

let _clientInfo: { client: OpenAI; model: string } | null = null

function getClient(): { client: OpenAI; model: string } {
  const groqKey = process.env.GROQ_API_KEY
  const openAIKey = process.env.OPENAI_API_KEY

  if (groqKey || (openAIKey && openAIKey.startsWith('gsk_'))) {
    const apiKey = groqKey || openAIKey
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    return { client, model: 'llama-3.3-70b-versatile' }
  }

  if (!openAIKey) {
    throw new AIServiceError('Neither OPENAI_API_KEY nor GROQ_API_KEY environment variable is set. Please set your API key in Vercel environment variables.')
  }

  const client = new OpenAI({ apiKey: openAIKey })
  return { client, model: 'gpt-4o-mini' }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  'You are an expert career coach and ATS specialist.\n' +
  'Analyze the resume against the job description.\n' +
  'Respond ONLY with valid JSON matching the schema provided.'

const RESPONSE_SCHEMA = `{
  "score": "number (0-100)",
  "summary": "string (2-3 sentences)",
  "jobTitle": "string (inferred from JD)",
  "strengths": "string[] (3-5 items)",
  "improvements": "string[] (3-5 items)",
  "keywordMatches": [{ "keyword": "string", "found": "boolean", "context": "string (optional)" }]
}`

/**
 * Builds the OpenAI messages array for a resume review request.
 *
 * @param resumeText     - The candidate's resume text (sanitised, no HTML).
 * @param jobDescription - The target job description (sanitised, no HTML).
 * @returns An array of `{ role, content }` messages ready for the Chat API.
 */
export function buildReviewPrompt(
  resumeText: string,
  jobDescription: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const userPrompt =
    '## Job Description\n' +
    jobDescription +
    '\n\n## Resume\n' +
    resumeText +
    '\n\n## Response Schema\n' +
    RESPONSE_SCHEMA

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

function isKeywordMatch(value: unknown): value is KeywordMatch {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.keyword === 'string' &&
    typeof v.found === 'boolean' &&
    (v.context === undefined || typeof v.context === 'string')
  )
}

/**
 * Validates a parsed JSON object and asserts it conforms to `AIReviewResult`.
 * Throws `AIServiceError` if any required field is missing or has an
 * unexpected type / out-of-range value.
 */
function validateReviewResult(raw: unknown): AIReviewResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new AIServiceError('AI response is not a JSON object')
  }

  const obj = raw as Record<string, unknown>

  // --- score ---
  if (typeof obj.score !== 'number' || obj.score < 0 || obj.score > 100) {
    throw new AIServiceError(
      `Invalid score: expected number in [0, 100], got ${JSON.stringify(obj.score)}`
    )
  }

  // --- summary ---
  if (typeof obj.summary !== 'string') {
    throw new AIServiceError(
      `Invalid summary: expected string, got ${typeof obj.summary}`
    )
  }

  // --- jobTitle ---
  if (typeof obj.jobTitle !== 'string') {
    throw new AIServiceError(
      `Invalid jobTitle: expected string, got ${typeof obj.jobTitle}`
    )
  }

  // --- strengths ---
  if (!Array.isArray(obj.strengths) || obj.strengths.length === 0) {
    throw new AIServiceError('Invalid strengths: expected a non-empty array')
  }

  // --- improvements ---
  if (!Array.isArray(obj.improvements) || obj.improvements.length === 0) {
    throw new AIServiceError('Invalid improvements: expected a non-empty array')
  }

  // --- keywordMatches ---
  if (!Array.isArray(obj.keywordMatches)) {
    throw new AIServiceError('Invalid keywordMatches: expected an array')
  }
  if (!obj.keywordMatches.every(isKeywordMatch)) {
    throw new AIServiceError(
      'Invalid keywordMatches: each item must have { keyword: string, found: boolean, context?: string }'
    )
  }

  return {
    score: obj.score,
    summary: obj.summary,
    jobTitle: obj.jobTitle,
    strengths: obj.strengths as string[],
    improvements: obj.improvements as string[],
    keywordMatches: obj.keywordMatches as KeywordMatch[],
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Calls the OpenAI Chat Completions API to generate a structured resume review.
 *
 * @param resumeText     - Sanitised resume text (1–8 000 chars).
 * @param jobDescription - Sanitised job description (1–4 000 chars).
 * @returns A validated `AIReviewResult`.
 * @throws `AIServiceError` when the API call fails or the response is
 *         malformed / fails validation.
 */
export async function generateReview(
  resumeText: string,
  jobDescription: string
): Promise<AIReviewResult> {
  const messages = buildReviewPrompt(resumeText, jobDescription)

  let rawContent: string | null

  try {
    const { client, model } = getClient()
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
    })

    rawContent = completion.choices[0]?.message?.content ?? null
  } catch (err) {
    throw new AIServiceError(
      `OpenAI API call failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  if (!rawContent) {
    throw new AIServiceError('OpenAI returned an empty response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch (err) {
    throw new AIServiceError(
      `Failed to parse OpenAI response as JSON: ${rawContent.slice(0, 200)}`,
      err
    )
  }

  return validateReviewResult(parsed)
}
