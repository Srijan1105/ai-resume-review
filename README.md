# AI Resume Reviewer SaaS

An AI-powered resume review application built with Next.js 14, Supabase, OpenAI, and Stripe.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database & Auth**: Supabase (Postgres + Auth)
- **AI**: OpenAI API (`gpt-4o-mini`)
- **Payments**: Stripe
- **Testing**: Vitest + fast-check (property-based testing)
- **Deployment**: Vercel

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL editor
3. Copy your project URL and keys into `.env.local`

### 4. Set up Stripe

1. Create a product and recurring price in your Stripe dashboard
2. Copy the price ID into `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`
3. Set up a webhook endpoint pointing to `https://your-domain.com/api/webhooks/stripe`
4. Listen for: `checkout.session.completed`, `customer.subscription.deleted`
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`

### 5. Run locally

```bash
npm run dev
```

### 6. Run tests

```bash
npm test
```

---

## Required Environment Variables

Configure all of the following as environment variables in Vercel (Settings → Environment Variables):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose client-side) |
| `OPENAI_API_KEY` | OpenAI API key |
| `STRIPE_SECRET_KEY` | Stripe secret key (server-only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | Stripe Price ID for the Pro plan |
| `NEXT_PUBLIC_URL` | Your production URL (e.g. `https://your-app.vercel.app`) |

## Deploying to Vercel

1. Push to GitHub and import the repository in Vercel
2. Add all environment variables listed above
3. Deploy — Vercel auto-detects Next.js and configures the build

> **Note**: The Stripe webhook route (`app/api/webhooks/stripe/route.ts`) uses
> `export const runtime = 'nodejs'` to access the raw request body for signature
> verification. This is handled at the route level and requires no additional
> `vercel.json` configuration.

## Project Structure

```
├── app/
│   ├── (marketing)/        # Landing page (/)
│   ├── (auth)/             # Sign-up and sign-in pages
│   ├── dashboard/          # Protected dashboard pages
│   └── api/                # API route handlers
├── components/
│   ├── landing/            # Marketing page components
│   ├── dashboard/          # Dashboard UI components
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── supabase/           # Supabase client helpers
│   ├── openai.ts           # AI review generation
│   ├── rate-limit.ts       # Daily usage rate limiter
│   ├── stripe.ts           # Stripe client
│   └── constants.ts        # App-wide constants
├── types/                  # Shared TypeScript types
├── supabase/
│   └── migrations/         # Database schema migrations
└── .env.local.example      # Environment variable template
```
