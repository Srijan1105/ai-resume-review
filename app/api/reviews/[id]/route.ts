import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ReviewDetailResponse } from "@/types";

// ---------------------------------------------------------------------------
// GET /api/reviews/:id — Fetch a single review for the authenticated user
// Requirements: 4.3, 4.4, 5.1, 8.3
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authenticate — Req 2.6
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // 2. Fetch review by id and verify ownership — Req 4.3, 4.4
  const { data: review, error } = await supabase
    .from("reviews")
    .select(
      "id, user_id, score, summary, strengths, improvements, keyword_matches, created_at, resume_text, job_description"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // 3. Build response with snippets — Req 5.1
  const response: ReviewDetailResponse = {
    id: review.id,
    score: review.score,
    summary: review.summary,
    strengths: review.strengths,
    improvements: review.improvements,
    keywordMatches: review.keyword_matches,
    createdAt: review.created_at,
    resumeSnippet: (review.resume_text as string).slice(0, 500),
    jobDescriptionSnippet: (review.job_description as string).slice(0, 500),
  };

  return NextResponse.json(response);
}
