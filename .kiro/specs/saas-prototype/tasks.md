# Implementation Plan: AI Resume Reviewer SaaS

## Overview

Implement the AI Resume Reviewer SaaS from scratch using Next.js 14 (App Router), Tailwind CSS + shadcn/ui, Supabase (Postgres + Auth), OpenAI API, Stripe, and Vitest + fast-check. Tasks are ordered so each step builds on the previous, with integration at the end.

## Tasks

- [x] 1. Project scaffolding and environment setup
  - Bootstrap a new Next.js 14 App Router project with TypeScript and Tailwind CSS
  - Install all dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `openai`, `stripe`, `@stripe/stripe-js`, `zod`, `vitest`, `fast-check`, and add shadcn/ui
  - Create `.env.local.example` with all required environment variable keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_URL`)
  - Configure `vitest.config.ts` for the project (jsdom environment, path aliases)
  - Set up the directory structure as defined in the design: `app/`, `components/`, `lib/`, `types/`, `supabase/migrations/`
  - _Requirements: 9.1_

- [x] 2. Shared types and constants
  - Create `types/index.ts` with all shared TypeScript interfaces: `Plan`, `User`, `Review`, `KeywordMatch`, `DailyUsage`, `ReviewSummary`, `AIReviewResult`, and all API request/response shapes (`CreateReviewRequest`, `CreateReviewResponse`, `ReviewListResponse`, `ReviewDetailResponse`, `CheckoutRequest`, `CheckoutResponse`, `CancelResponse`, `BillingStatusResponse`)
  - Create `lib/constants.ts` exporting `STARTER_DAILY_LIMIT = 3`
  - _Requirements: 3.4, 3.5, 3.6, 7.1_

- [x] 3. Database schema and migrations
  - [x] 3.1 Write the initial SQL migration `supabase/migrations/001_initial_schema.sql`
    - Create `public.users` table extending `auth.users` with `plan`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_ends_at`, `created_at`, `updated_at` columns
    - Create `public.reviews` table with all columns, `CHECK (score >= 0 AND score <= 100)` constraint, and indexes on `user_id` and `created_at DESC`
    - Create `public.daily_usage` table with `UNIQUE(user_id, date)` constraint
    - Enable RLS on `reviews` and `daily_usage`; add policies: `user_id = auth.uid()` for SELECT and INSERT/UPDATE on both tables
    - Add a trigger or function to auto-insert a row into `public.users` on `auth.users` insert
    - _Requirements: 8.1, 8.2_

- [x] 4. Supabase client helpers
  - Create `lib/supabase/client.ts` — browser-side Supabase client using `createBrowserClient` from `@supabase/ssr`
  - Create `lib/supabase/server.ts` — server-side Supabase client using `createServerClient` from `@supabase/ssr` that reads/writes cookies from the Next.js `cookies()` store
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Next.js middleware for session refresh and route protection
  - Create `middleware.ts` at the project root
  - Use `createServerClient` to refresh the Supabase session cookie on every request
  - Protect all `/dashboard/*` routes: redirect unauthenticated requests to `/sign-in`
  - Pass through all other routes (including `/api/*`) without redirect
  - _Requirements: 2.3, 2.4_

- [x] 6. Authentication pages
  - [x] 6.1 Create `app/(auth)/sign-up/page.tsx` — email + password sign-up form
    - On submit call `supabase.auth.signUp({ email, password })`
    - Display inline error if email is already in use (Req 2.5)
    - On success redirect to `/dashboard`
    - _Requirements: 2.1, 2.5_

  - [x] 6.2 Create `app/(auth)/sign-in/page.tsx` — email + password sign-in form
    - On submit call `supabase.auth.signInWithPassword({ email, password })`
    - On success redirect to `/dashboard`
    - _Requirements: 2.2_

- [x] 7. Marketing landing page
  - [x] 7.1 Create landing page layout `app/(marketing)/layout.tsx` and page `app/(marketing)/page.tsx`
    - _Requirements: 1.1_

  - [x] 7.2 Build `components/landing/Hero.tsx` with headline, sub-headline, and "Get Started Free" CTA linking to `/sign-up`
    - _Requirements: 1.1, 1.3_

  - [x] 7.3 Build `components/landing/Features.tsx` (3-column feature highlights grid)
    - _Requirements: 1.1_

  - [x] 7.4 Build `components/landing/HowItWorks.tsx` (3-step visual section)
    - _Requirements: 1.1_

  - [x] 7.5 Build `components/landing/Pricing.tsx` displaying Starter (free) and Pro ($19/month) tiers
    - _Requirements: 1.1, 1.2_

  - [x] 7.6 Wire all landing sections into the page and add a footer
    - _Requirements: 1.1_

- [x] 8. Checkpoint — Ensure landing page and auth pages render without errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Rate limiting — `checkRateLimit`
  - [x] 9.1 Implement `lib/rate-limit.ts` — `checkRateLimit(userId, plan)` function
    - For `'pro'` plan: return `{ allowed: true, remaining: Infinity }` immediately
    - For `'starter'` plan: upsert `daily_usage` row for `(userId, today)` and compare `count` to `STARTER_DAILY_LIMIT`
    - Return `{ allowed: true, remaining: STARTER_DAILY_LIMIT - count }` if under limit, `{ allowed: false, remaining: 0 }` if at or over limit
    - Use atomic upsert to avoid double-counting on concurrent calls
    - _Requirements: 3.5, 3.6_

  - [x] 9.2 Write property test — Property 1: Starter users cannot exceed daily limit
    - **Property 1: Starter users cannot exceed daily limit**
    - Use `fc.assert` + `fc.asyncProperty` with a generated userId; simulate 3 `checkRateLimit` calls then assert 4th returns `{ allowed: false }`
    - **Validates: Requirements 3.5**

  - [x] 9.3 Write property test — Property 2: Pro users are never rate-limited
    - **Property 2: Pro users are never rate-limited**
    - Use `fc.assert` + `fc.asyncProperty` with arbitrary daily usage counts; assert `checkRateLimit(userId, 'pro')` always returns `{ allowed: true }`
    - **Validates: Requirements 3.6**

  - [x] 9.4 Write unit tests for `checkRateLimit`
    - Test boundary values: count = 0, 1, 2 (allowed), count = 3, 4 (blocked) for starter
    - Test pro plan always returns allowed regardless of count
    - _Requirements: 3.5, 3.6_

- [x] 10. OpenAI integration — `generateReview`
  - [x] 10.1 Create `lib/openai.ts` — `generateReview(resumeText, jobDescription)` function
    - Instantiate `OpenAI` client using `OPENAI_API_KEY` environment variable
    - Implement `buildReviewPrompt(resumeText, jobDescription)` to construct the system + user messages as described in the design
    - Call `openai.chat.completions.create` with `response_format: { type: 'json_object' }` and `model: 'gpt-4o-mini'` (or configurable)
    - Parse and validate the JSON response; throw `AIServiceError` if non-200 or malformed
    - Return a valid `AIReviewResult` with `score`, `summary`, `strengths`, `improvements`, `keywordMatches`, `jobTitle`
    - _Requirements: 3.4, 3.7_

  - [x] 10.2 Write property test — Property 3: AI review result is structurally valid
    - **Property 3: AI review result is structurally valid**
    - Use `fc.assert` + `fc.asyncProperty` with `fc.string({ minLength: 1, maxLength: 8000 })` and `fc.string({ minLength: 1, maxLength: 4000 })` to assert score in [0,100], `strengths.length >= 1`, `improvements.length >= 1`
    - **Validates: Requirements 3.4**

  - [x] 10.3 Write unit tests for `generateReview`
    - Mock OpenAI client; test successful structured response parsing
    - Test that `AIServiceError` is thrown on malformed/non-JSON response
    - Test that `buildReviewPrompt` output contains both resume and JD text
    - _Requirements: 3.4, 3.7_

- [x] 11. Input sanitization helper
  - Add an `stripHtml(text: string): string` utility in `lib/utils.ts` (or alongside `lib/openai.ts`) that removes all HTML tags before text is passed to the AI service
  - _Requirements: 3.9_

  - [x] 11.1 Write property test — Property 7: Input sanitization removes HTML before AI processing
    - **Property 7: Input sanitization removes HTML before AI processing**
    - Use `fc.assert` + `fc.property` with `fc.string()` arbitrarily injected with HTML tags; assert `stripHtml(text)` contains no `<` or `>` characters
    - **Validates: Requirements 3.9**

- [x] 12. Review API routes
  - [x] 12.1 Create `app/api/reviews/route.ts` — `POST /api/reviews` handler
    - Authenticate request using server Supabase client; return 401 if no session (Req 2.6)
    - Parse and validate request body with Zod: `resumeText` (1–8000 chars), `jobDescription` (1–4000 chars); return 400 on validation failure (Req 3.2, 3.3)
    - Call `stripHtml` on both inputs before further processing (Req 3.9)
    - Load user record from DB to obtain `plan`
    - Call `checkRateLimit`; return 429 with `{ error, upgradeUrl }` if not allowed (Req 3.5)
    - Call `generateReview`; return 502 if AI service errors — do NOT increment usage counter (Req 3.7)
    - Insert review into `reviews` table and upsert `daily_usage` counter (Req 3.8)
    - Return 201 with the created review
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7, 3.8, 3.9_

  - [x] 12.2 Write property test — Property 6: Usage counter only increments on successful AI response
    - **Property 6: Usage counter only increments on successful AI response**
    - Mock `generateReview` to throw; assert that after a failed review creation the `daily_usage` count is unchanged
    - **Validates: Requirements 3.7**

  - [x] 12.3 Write property test — Property 8: Unauthenticated API requests are always rejected
    - **Property 8: Unauthenticated API requests are always rejected**
    - Use `fc.assert` + `fc.property` over various route paths; assert that a request without a valid session always yields HTTP 401
    - **Validates: Requirements 2.6**

  - [x] 12.4 Create `app/api/reviews/route.ts` — `GET /api/reviews` handler
    - Authenticate; return 401 if no session
    - Query `reviews` where `user_id = auth.uid()`, ordered by `created_at DESC`, paginated at 20 items (use `?page=` query param)
    - Return `{ reviews: ReviewSummary[], totalCount }` (Req 4.1, 4.2)
    - _Requirements: 4.1, 4.2, 8.3_

  - [x] 12.5 Write property test — Property 9: Review list is always user-scoped and date-ordered
    - **Property 9: Review list is always user-scoped and date-ordered**
    - For a generated user, insert reviews with varied timestamps; assert `GET /api/reviews` returns only that user's reviews sorted by `createdAt` descending
    - **Validates: Requirements 4.1, 8.3**

  - [x] 12.6 Create `app/api/reviews/[id]/route.ts` — `GET /api/reviews/:id` handler
    - Authenticate; return 401 if no session
    - Fetch review by `id`; return 404 if review does not exist or `user_id` does not match authenticated user (Req 4.3, 4.4)
    - Return full `ReviewDetailResponse` including `resumeSnippet` (first 500 chars) and `jobDescriptionSnippet` (first 500 chars) (Req 5.1)
    - _Requirements: 4.3, 4.4, 5.1, 8.3_

  - [x] 12.7 Write property test — Property 5: Reviews are user-scoped
    - **Property 5: Reviews are user-scoped**
    - For two distinct generated user IDs, assert that `GET /api/reviews/:id` for a review owned by user A returns HTTP 404 when requested by user B
    - **Validates: Requirements 4.4, 8.3**

- [x] 13. Checkpoint — Ensure all review API and rate-limit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Dashboard layout and auth guard
  - Create `app/dashboard/layout.tsx` as a server component that verifies the session (redirects to `/sign-in` if absent) and renders a sidebar navigation with links to Dashboard, New Review, and Billing
  - Install and configure shadcn/ui sidebar or a custom sidebar component
  - _Requirements: 2.3, 2.4_

- [x] 15. Review submission UI
  - [x] 15.1 Build `components/dashboard/UsageMeter.tsx` — displays daily reviews used / limit (or "Unlimited" for Pro)
    - _Requirements: 7.1_

  - [x] 15.2 Build `components/dashboard/ReviewForm.tsx` client component
    - Accepts `userPlan` and `dailyUsageCount` props
    - Two textareas: resume (max 8000 chars) and job description (max 4000 chars) with character counters
    - Disable submit and show upgrade prompt when Starter user is at limit
    - On submit POST to `/api/reviews`; show loading state; redirect to `/dashboard/reviews/[id]` on success
    - Display 400/429/502 errors inline
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 15.3 Create `app/dashboard/new/page.tsx` server component
    - Load `plan` and today's `daily_usage.count` from DB for the authenticated user
    - Render `<ReviewForm>` and `<UsageMeter>` with those props
    - _Requirements: 3.1, 7.1_

- [x] 16. Review history list UI
  - [x] 16.1 Build `components/dashboard/ReviewCard.tsx` — displays score badge, job title, and date for a single review summary
    - _Requirements: 4.1_

  - [x] 16.2 Create `app/dashboard/page.tsx` server component
    - Fetch `GET /api/reviews` (page 1) for the authenticated user
    - Render list of `<ReviewCard>` components with pagination controls
    - _Requirements: 4.1, 4.2_

- [x] 17. Review detail UI
  - [x] 17.1 Build `components/dashboard/ReviewDetail.tsx` client component
    - Display score (large badge), summary, strengths list, improvements list, keyword matches table (keyword + found indicator + context snippet), resume snippet, and job description snippet
    - _Requirements: 5.1, 5.2_

  - [x] 17.2 Create `app/dashboard/reviews/[id]/page.tsx` server component
    - Fetch `GET /api/reviews/:id`; redirect to `/dashboard` if 404
    - Render `<ReviewDetail>` with the fetched data
    - _Requirements: 5.1, 5.2_

- [x] 18. Checkpoint — Ensure dashboard UI pages render and review flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Stripe client and billing API routes
  - [x] 19.1 Create `lib/stripe.ts` — instantiate Stripe client with `STRIPE_SECRET_KEY` and export reusable helpers
    - _Requirements: 6.1, 6.4, 7.4_

  - [x] 19.2 Create `app/api/billing/checkout/route.ts` — `POST /api/billing/checkout`
    - Authenticate; return 401 if no session
    - Validate `priceId` in request body
    - Create a Stripe Checkout Session (`mode: 'subscription'`, `metadata: { userId }`, success/cancel URLs)
    - Return `{ url }` (Req 6.1)
    - _Requirements: 6.1_

  - [x] 19.3 Create `app/api/billing/cancel/route.ts` — `POST /api/billing/cancel`
    - Authenticate; return 401 if no session
    - Look up user's `stripe_subscription_id` from DB
    - Call `stripe.subscriptions.update(id, { cancel_at_period_end: true })`
    - Return `{ cancelAt }` ISO date string (Req 7.4)
    - _Requirements: 7.4_

  - [x] 19.4 Create `app/api/billing/status/route.ts` — `GET /api/billing/status`
    - Authenticate; return 401 if no session
    - Query DB for user's plan, subscription fields, and today's `daily_usage.count`
    - Return `BillingStatusResponse` (Req 7.5)
    - _Requirements: 7.1, 7.5_

- [x] 20. Stripe webhook handler
  - [x] 20.1 Create `app/api/webhooks/stripe/route.ts` — `POST /api/webhooks/stripe`
    - Read raw request body (do NOT use `req.json()`)
    - Verify signature with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`; return 400 on failure (Req 6.4)
    - Handle `checkout.session.completed`: extract `metadata.userId`, update `public.users` to set `plan='pro'`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status='active'` (Req 6.2)
    - Handle `customer.subscription.deleted`: look up user by `stripe_customer_id`, set `plan='starter'`, `subscription_status='canceled'` (Req 6.3)
    - Return 200 for all other event types (Req 6.5)
    - All DB updates must be idempotent (upsert / SET produces same state on replay) (Req 6.6)
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 20.2 Write property test — Property 4: Webhook processing is idempotent
    - **Property 4: Webhook processing is idempotent**
    - Use `fc.assert` + `fc.asyncProperty` over valid Stripe event payloads; process each event N times (N ∈ [1, 5]) and assert the resulting DB state equals the state after processing once
    - **Validates: Requirements 6.6**

  - [x] 20.3 Write unit tests for `handleStripeWebhook`
    - Test `checkout.session.completed` → user plan set to `'pro'`
    - Test `customer.subscription.deleted` → user plan set to `'starter'`
    - Test invalid signature → 400 returned, no DB write
    - Test unknown event type → 200 returned, no DB write
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 21. Billing page UI
  - [x] 21.1 Build `components/dashboard/UsageMeter.tsx` update — reuse in billing page context if not already done in task 15.1
    - _Requirements: 7.1_

  - [x] 21.2 Create `app/dashboard/billing/page.tsx` server component
    - Fetch `GET /api/billing/status` for the authenticated user
    - Display current plan, reviews used today, and daily limit (Req 7.1)
    - For Starter users: show an "Upgrade to Pro" button that POSTs to `/api/billing/checkout` and redirects to the returned Stripe URL (Req 7.2)
    - For Pro users: show subscription status, period end date, and a "Cancel Subscription" button that POSTs to `/api/billing/cancel` and confirms the cancellation date (Req 7.3, 7.4)
    - Handle `?success=true` and `?canceled=true` query params to show a toast/banner (Req 6.1)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 22. Checkpoint — Ensure all billing and webhook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Vercel deployment configuration
  - Create `vercel.json` if needed (e.g., to configure the `stripe/route.ts` to use the `nodejs` runtime for raw body access)
  - Add a `next.config.js` (or `next.config.mjs`) ensuring the webhook route sets `bodyParser: false` / uses `export const runtime = 'nodejs'`
  - Document all required Vercel environment variables in `README.md` or `.env.local.example`
  - Ensure the project builds cleanly (`next build`) with no TypeScript errors
  - _Requirements: 9.1, 9.2_

- [ ] 24. Final wiring and integration
  - [x] 24.1 Wire sign-out functionality: add a sign-out button in the dashboard sidebar that calls `supabase.auth.signOut()` and redirects to `/`
    - _Requirements: 2.2_

  - [x] 24.2 Verify all `/api/*` routes return 401 for unauthenticated requests; add a shared `getAuthUser` helper in `lib/auth.ts` to DRY up session checks across API routes
    - _Requirements: 2.6_

  - [x] 24.3 Write integration tests for the full review creation flow
    - Sign up → session cookie set → POST `/api/reviews` → DB record created → GET `/api/reviews` returns it
    - Starter user at limit (3 reviews) → POST → 429
    - Stripe webhook `checkout.session.completed` → user plan updated to `'pro'` → POST `/api/reviews` allowed
    - _Requirements: 3.1, 3.5, 3.6, 6.2_

- [~] 25. Final checkpoint — Full test suite passes
  - Run `vitest --run` and ensure all unit, property, and integration tests pass.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements from `requirements.md` for traceability
- Correctness properties 1–9 from `design.md` are covered by PBT sub-tasks in tasks 9, 10, 11, 12, and 20
- Checkpoints at tasks 8, 13, 18, 22, and 25 ensure incremental validation at logical breakpoints
- Property tests use `fc.assert` + `fc.asyncProperty`/`fc.property` from the `fast-check` library
- Unit tests use `vitest` with mocked Supabase/OpenAI/Stripe clients where needed
- The Stripe webhook route must use the Node.js runtime (not Edge) to access the raw request body
