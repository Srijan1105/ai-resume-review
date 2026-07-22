// Shared TypeScript types

export type Plan = 'starter' | 'pro'

export interface User {
  id: string
  email: string
  plan: Plan
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  subscriptionEndsAt: string | null
}

export interface KeywordMatch {
  keyword: string
  found: boolean
  context?: string
}

export interface Review {
  id: string
  userId: string
  resumeText: string
  jobDescription: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  keywordMatches: KeywordMatch[]
  jobTitle: string | null
  createdAt: string
}

export interface DailyUsage {
  userId: string
  date: string
  count: number
}

export interface ReviewSummary {
  id: string
  score: number
  jobTitle: string
  createdAt: string
}

export interface AIReviewResult {
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  keywordMatches: KeywordMatch[]
  jobTitle: string
}

// API Request / Response shapes

export interface CreateReviewRequest {
  resumeText: string       // max 8000 chars
  jobDescription: string   // max 4000 chars
}

export interface CreateReviewResponse {
  id: string
  score: number            // 0–100
  summary: string
  strengths: string[]
  improvements: string[]
  keywordMatches: KeywordMatch[]
  createdAt: string
}

export interface ReviewListResponse {
  reviews: ReviewSummary[]
  totalCount: number
}

export interface ReviewDetailResponse extends CreateReviewResponse {
  resumeSnippet: string            // first 500 chars of resume
  jobDescriptionSnippet: string    // first 500 chars of job description
}

export interface CheckoutRequest {
  priceId: string
}

export interface CheckoutResponse {
  url: string
}

export interface CancelResponse {
  cancelAt: string         // ISO date
}

export interface BillingStatusResponse {
  plan: Plan
  reviewsThisMonth: number
  reviewsLimit: number | null      // 3 for starter, null for pro (unlimited)
  stripeSubscriptionStatus?: string
  currentPeriodEnd?: string
}
