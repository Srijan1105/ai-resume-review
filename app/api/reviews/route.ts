import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReview, AIServiceError } from "@/lib/openai";
import { stripHtml } from "@/lib/utils";
import type { CreateReviewResponse, ReviewSummary } from "@/types";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const createReviewSchema = z.object({
  resumeText: z
    .string()
    .min(1, "Resume text is required")
    .max(8000, "Resume text must be 8000 characters or fewer"),
  jobDescription: z
    .string()
    .min(1, "Job description is required")
    .max(4000, "Job description must be 4000 characters or fewer"),
});

// ---------------------------------------------------------------------------
// POST /api/reviews — Create a new review
// Requirements: 3.1, 3.2, 3.3, 3.5, 3.7, 3.8, 3.9
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authenticate — Req 2.6
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body — Req 3.2, 3.3
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  // 3. Strip HTML from both inputs — Req 3.9
  const resumeText = stripHtml(parsed.data.resumeText);
  const jobDescription = stripHtml(parsed.data.jobDescription);

  // 4. Load user record to obtain plan (auto-provision in public.users if missing)
  let { data: userRecord } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord) {
    const { data: newRecord } = await supabase
      .from("users")
      .upsert({ id: user.id, email: user.email ?? "", plan: "starter" }, { onConflict: "id" })
      .select("plan")
      .maybeSingle();

    userRecord = newRecord ?? { plan: "starter" };
  }

  const plan = (userRecord?.plan ?? "starter") as "starter" | "pro";

  // 5. Rate limit check — Req 3.5
  const rateCheck = await checkRateLimit(supabase, user.id, plan);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: "Daily review limit reached. Upgrade to Pro for unlimited reviews.",
        upgradeUrl: "/dashboard/billing",
      },
      { status: 429 }
    );
  }

  // 6. Call AI service — Req 3.7 (do NOT increment usage on failure)
  let aiResult;
  try {
    aiResult = await generateReview(resumeText, jobDescription);
  } catch (err) {
    if (err instanceof AIServiceError) {
      return NextResponse.json(
        { error: "AI service unavailable. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "AI service unavailable. Please try again." },
      { status: 502 }
    );
  }

  // 7. Insert review into reviews table — Req 3.8
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      resume_text: resumeText,
      job_description: jobDescription,
      score: aiResult.score,
      summary: aiResult.summary,
      strengths: aiResult.strengths,
      improvements: aiResult.improvements,
      keyword_matches: aiResult.keywordMatches,
      job_title: aiResult.jobTitle,
    })
    .select("id, score, summary, strengths, improvements, keyword_matches, created_at")
    .single();

  if (reviewError || !review) {
    return NextResponse.json(
      { error: "Failed to save review" },
      { status: 500 }
    );
  }

  // 8. Upsert daily_usage counter — Req 3.8
  //    Read-then-write: increment count by 1 for (user_id, today)
  const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'

  // Use a raw SQL RPC or upsert with increment.
  // Safest portable approach: upsert with count=1 on insert, count+1 on conflict.
  const { error: usageError } = await supabase.rpc("increment_daily_usage", {
    p_user_id: user.id,
    p_date: today,
  });

  if (usageError) {
    // Fall back to read-then-write if RPC is unavailable
    const { data: existing } = await supabase
      .from("daily_usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const newCount = (existing?.count ?? 0) + 1;

    await supabase.from("daily_usage").upsert(
      { user_id: user.id, date: today, count: newCount },
      { onConflict: "user_id,date" }
    );
  }

  // 9. Return 201 with the created review — matches CreateReviewResponse shape
  const response: CreateReviewResponse = {
    id: review.id,
    score: review.score,
    summary: review.summary,
    strengths: review.strengths,
    improvements: review.improvements,
    keywordMatches: review.keyword_matches,
    createdAt: review.created_at,
  };

  return NextResponse.json(response, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/reviews — List reviews for authenticated user (paginated)
// Requirements: 4.1, 4.2, 8.3
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse ?page= query param (default: 1)
  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get("page");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // 3. Query reviews scoped to authenticated user, ordered by created_at DESC
  const { data: rows, error, count } = await supabase
    .from("reviews")
    .select("id, score, job_title, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }

  // 4. Map to ReviewSummary shape and return
  const reviews: ReviewSummary[] = (rows ?? []).map((row) => ({
    id: row.id,
    score: row.score,
    jobTitle: row.job_title ?? "",
    createdAt: row.created_at,
  }));

  return NextResponse.json({
    reviews,
    totalCount: count ?? 0,
  });
}
