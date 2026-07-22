-- ============================================================
-- 001_initial_schema.sql
-- Initial database schema for AI Resume Reviewer SaaS
-- ============================================================

-- ------------------------------------------------------------
-- public.users
-- Extends auth.users with plan, billing, and timestamp fields
-- ------------------------------------------------------------
CREATE TABLE public.users (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  TEXT NOT NULL,
  plan                   TEXT NOT NULL DEFAULT 'starter',   -- 'starter' | 'pro'
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT,                              -- 'active' | 'canceled' | NULL
  subscription_ends_at   TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- public.reviews
-- Stores AI-generated resume review records per user
-- ------------------------------------------------------------
CREATE TABLE public.reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resume_text     TEXT NOT NULL,
  job_description TEXT NOT NULL,
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  summary         TEXT NOT NULL,
  strengths       JSONB NOT NULL DEFAULT '[]',      -- string[]
  improvements    JSONB NOT NULL DEFAULT '[]',      -- string[]
  keyword_matches JSONB NOT NULL DEFAULT '[]',      -- KeywordMatch[]
  job_title       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_user_id    ON public.reviews(user_id);
CREATE INDEX idx_reviews_created_at ON public.reviews(created_at DESC);

-- ------------------------------------------------------------
-- public.daily_usage
-- Tracks per-user daily review submission counts
-- ------------------------------------------------------------
CREATE TABLE public.daily_usage (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

-- reviews: users can only read and write their own rows
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_own"
  ON public.reviews
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "reviews_insert_own"
  ON public.reviews
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_own"
  ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- daily_usage: users can only read and write their own rows
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_usage_select_own"
  ON public.daily_usage
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "daily_usage_insert_own"
  ON public.daily_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_usage_update_own"
  ON public.daily_usage
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- Trigger: auto-insert into public.users on auth.users insert
-- Keeps public.users in sync with Supabase Auth signups
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
