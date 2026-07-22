import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UsageMeter from '@/components/dashboard/UsageMeter'
import ReviewForm from '@/components/dashboard/ReviewForm'
import { Plan } from '@/types'

export default async function NewReviewPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const today = new Date().toISOString().split('T')[0]

  const [{ data: userRecord }, { data: usageRecord }] = await Promise.all([
    supabase.from('users').select('plan').eq('id', user.id).single(),
    supabase
      .from('daily_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single(),
  ])

  const plan: Plan = (userRecord?.plan as Plan) ?? 'starter'
  const usedToday: number = usageRecord?.count ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">New Review</h2>
        <p className="mt-1 text-sm text-gray-500">
          Paste your resume and the job description to get AI-powered feedback.
        </p>
      </div>

      <UsageMeter plan={plan} usedToday={usedToday} />

      <ReviewForm userPlan={plan} dailyUsageCount={usedToday} />
    </div>
  )
}
