# Requirements Document

## Introduction

AI Resume Reviewer is a SaaS application that allows users to paste a resume and a target job description, then receive structured, AI-powered feedback including a score (0–100), strengths, suggested improvements, and keyword match analysis. The platform supports two subscription tiers — Starter (free, 3 reviews/day) and Pro (unlimited) — backed by Stripe payments. It includes a marketing landing page, Supabase email+password authentication with persistent sessions, a review history dashboard, a billing and account management page, and Stripe webhook handling for subscription lifecycle events. The application deploys to Vercel.

## Glossary

- **System**: The AI Resume Reviewer Next.js application as a whole
- **Auth_Service**: The Supabase Auth subsystem responsible for user registration, login, and session management
- **Review_API**: The `/api/reviews` route handler responsible for creating and retrieving reviews
- **Rate_Limiter**: The `checkRateLimit` function that enforces per-plan daily usage limits
- **AI_Service**: The `generateReview` function that calls the OpenAI API and returns structured feedback
- **Webhook_Handler**: The `/api/webhooks/stripe` route handler that processes Stripe lifecycle events
- **Billing_API**: The billing route handlers (`/api/billing/checkout`, `/api/billing/cancel`, `/api/billing/status`)
- **Middleware**: The Next.js middleware responsible for session refresh and route protection
- **DB**: The Supabase Postgres database containing `users`, `reviews`, and `daily_usage` tables
- **Starter**: The free subscription plan allowing up to 3 reviews per calendar day
- **Pro**: The paid subscription plan ($19/month) allowing unlimited reviews per day
- **STARTER_DAILY_LIMIT**: The constant value of 3, representing the maximum reviews per day for Starter users
- **RLS**: Row-Level Security policies enforced at the Supabase Postgres level
- **Review**: A persisted record containing AI-generated feedback for a resume + job description pair
- **Checkout_Session**: A Stripe-hosted payment session created to upgrade a user to Pro

---

## Requirements

### Requirement 1: Marketing Landing Page

**User Story:** As a visitor, I want to see a marketing landing page, so that I can understand the product and sign up.

#### Acceptance Criteria

1. THE System SHALL render a landing page at `/` containing a hero section, a feature highlights section, a how-it-works section, a pricing section, and a footer.
2. THE System SHALL display two pricing tiers on the landing page: Starter (free) and Pro ($19/month).
3. WHEN a visitor clicks the primary call-to-action button on the landing page, THE System SHALL navigate the visitor to `/sign-up`.

---

### Requirement 2: Email and Password Authentication

**User Story:** As a visitor, I want to register and log in with my email and password, so that I can access the application and have my data saved.

#### Acceptance Criteria

1. WHEN a visitor submits a valid email and password on the sign-up page, THE Auth_Service SHALL create a new user account and establish an authenticated session.
2. WHEN a user submits valid credentials on the sign-in page, THE Auth_Service SHALL authenticate the user and establish a persistent session cookie.
3. WHILE a valid session cookie is present, THE Middleware SHALL allow access to protected dashboard routes without requiring re-authentication.
4. WHEN a session cookie is absent or has expired, THE Middleware SHALL redirect the request to `/sign-in`.
5. IF a visitor attempts to sign up with an email address that is already registered, THEN THE Auth_Service SHALL return an error indicating the email is already in use.
6. WHEN a request is made to any `/api/*` route without a valid authenticated session, THE System SHALL respond with HTTP 401.

---

### Requirement 3: Resume Review Submission

**User Story:** As an authenticated user, I want to paste my resume and a job description and receive AI-powered feedback, so that I can improve my job application.

#### Acceptance Criteria

1. WHEN an authenticated user submits a resume text and job description to `POST /api/reviews`, THE Review_API SHALL invoke the AI_Service and persist the resulting review.
2. IF the submitted resume text is empty or exceeds 8000 characters, THEN THE Review_API SHALL return HTTP 400 with a descriptive validation error.
3. IF the submitted job description is empty or exceeds 4000 characters, THEN THE Review_API SHALL return HTTP 400 with a descriptive validation error.
4. WHEN the AI_Service processes a valid resume and job description, THE AI_Service SHALL return a result containing a score in the range [0, 100], a summary, a non-empty strengths array, a non-empty improvements array, and a keyword matches array derived from the job description.
5. WHEN an authenticated user on the Starter plan has already submitted 3 reviews on the current calendar day, THE Rate_Limiter SHALL prevent further review submissions and THE Review_API SHALL respond with HTTP 429.
6. WHILE a user's plan is Pro, THE Rate_Limiter SHALL permit review submissions without any daily limit.
7. IF the AI_Service call fails or returns a malformed response, THEN THE Review_API SHALL return HTTP 502 and THE daily_usage counter SHALL remain unchanged.
8. WHEN a review is successfully created, THE Review_API SHALL increment the requesting user's daily usage counter by exactly 1 and persist the review to the DB.
9. IF the submitted resume text or job description contains HTML markup, THEN THE System SHALL strip the HTML before passing the text to the AI_Service.

---

### Requirement 4: Review History

**User Story:** As an authenticated user, I want to view a list of my past reviews, so that I can track my progress over time.

#### Acceptance Criteria

1. WHEN an authenticated user requests `GET /api/reviews`, THE Review_API SHALL return only reviews belonging to that user, ordered by creation date descending.
2. THE Review_API SHALL return review list results paginated at 20 items per page.
3. WHEN an authenticated user requests `GET /api/reviews/:id` for a review that belongs to them, THE Review_API SHALL return the full review detail.
4. IF an authenticated user requests `GET /api/reviews/:id` for a review that does not belong to them, THEN THE Review_API SHALL respond with HTTP 404.

---

### Requirement 5: Review Detail View

**User Story:** As an authenticated user, I want to view the full feedback for a specific past review, so that I can act on the AI's recommendations.

#### Acceptance Criteria

1. WHEN an authenticated user views a review detail, THE System SHALL display the score, summary, strengths list, improvements list, keyword matches, and snippets of the original resume and job description.
2. THE System SHALL display keyword matches indicating whether each keyword was found in the resume and, where available, the sentence in which it appeared.

---

### Requirement 6: Stripe Subscription Payments

**User Story:** As a Starter user, I want to upgrade to a Pro subscription via Stripe, so that I can perform unlimited reviews.

#### Acceptance Criteria

1. WHEN an authenticated user submits a valid `priceId` to `POST /api/billing/checkout`, THE Billing_API SHALL create a Stripe Checkout Session and return the hosted checkout URL.
2. WHEN Stripe sends a `checkout.session.completed` webhook event, THE Webhook_Handler SHALL verify the event signature and update the corresponding user's plan to Pro in the DB, storing the Stripe customer ID and subscription ID.
3. WHEN Stripe sends a `customer.subscription.deleted` webhook event, THE Webhook_Handler SHALL verify the event signature and downgrade the corresponding user's plan to Starter in the DB, setting subscription status to `canceled`.
4. IF the Stripe webhook request does not contain a valid signature, THEN THE Webhook_Handler SHALL respond with HTTP 400 and take no DB action.
5. WHEN THE Webhook_Handler receives a webhook event type it does not handle, THE Webhook_Handler SHALL respond with HTTP 200 and take no DB action.
6. WHEN THE Webhook_Handler processes the same Stripe event more than once, THE Webhook_Handler SHALL produce the same DB state as processing it once (idempotent behavior).

---

### Requirement 7: Billing and Account Management

**User Story:** As an authenticated user, I want to view and manage my subscription on a billing page, so that I can understand my plan status and make changes.

#### Acceptance Criteria

1. WHEN an authenticated user visits `/dashboard/billing`, THE System SHALL display their current plan (Starter or Pro), the number of reviews used today, and the daily limit (3 for Starter, unlimited for Pro).
2. WHILE a user's plan is Starter, THE System SHALL display an upgrade call-to-action on the billing page.
3. WHILE a user's plan is Pro, THE System SHALL display a subscription cancellation option on the billing page.
4. WHEN a Pro user submits a cancellation request to `POST /api/billing/cancel`, THE Billing_API SHALL schedule the subscription to cancel at the end of the current billing period via the Stripe API and return the cancellation date.
5. WHEN an authenticated user requests `GET /api/billing/status`, THE Billing_API SHALL return the user's current plan, daily review count, review limit, Stripe subscription status, and current period end date.

---

### Requirement 8: Data Isolation and Row-Level Security

**User Story:** As a user, I want my reviews and usage data to be private, so that other users cannot access my information.

#### Acceptance Criteria

1. THE DB SHALL enforce Row-Level Security on the `reviews` table such that a user can only read and write rows where `user_id` equals their authenticated user ID.
2. THE DB SHALL enforce Row-Level Security on the `daily_usage` table such that a user can only read and write rows where `user_id` equals their authenticated user ID.
3. THE Review_API SHALL not return review records belonging to a different user regardless of the request method or query parameters.

---

### Requirement 9: Vercel Deployment

**User Story:** As an operator, I want the application deployed to Vercel, so that it is publicly accessible on the internet.

#### Acceptance Criteria

1. THE System SHALL be deployable to Vercel using the Next.js 14 App Router configuration with all required environment variables configured as Vercel environment variables.
2. THE System SHALL serve the landing page, authentication pages, and dashboard pages from Vercel's edge network.
