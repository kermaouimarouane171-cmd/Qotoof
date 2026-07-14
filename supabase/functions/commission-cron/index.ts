import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_COMMISSION_RATE = 0.03
const PAYMENT_DEADLINE_DAYS = 7

/**
 * Get the commission rate for a vendor based on their subscription plan.
 * Falls back to DEFAULT_COMMISSION_RATE (3%) if the plan can't be determined.
 */
const getVendorCommissionRate = async (supabase: ReturnType<typeof createClient>, vendorId: string): Promise<number> => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', vendorId)
      .single()

    if (!profileError && profile?.subscription_plan) {
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('commission_rate')
        .eq('id', profile.subscription_plan)
        .eq('is_active', true)
        .single()

      if (!planError && plan?.commission_rate != null) {
        return Number(plan.commission_rate) / 100
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_COMMISSION_RATE
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('COMMISSION_CRON_SECRET') || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

const isAuthorized = (req: Request) => {
  // FAIL-CLOSED: if no secret is configured, reject all requests.
  // This prevents the function from being openly accessible if the
  // secret is accidentally unset or deleted.
  if (!CRON_SECRET) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${CRON_SECRET}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing Supabase environment variables' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const now = new Date()
    const forceMonthClose = new URL(req.url).searchParams.get('forceMonthClose') === 'true'

    let monthCloseProcessed = 0
    let dueSoonNotified = 0
    let dueTodayNotified = 0
    let frozenAccounts = 0

    if (now.getDate() === 1 || forceMonthClose) {
      const endedMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endedMonth = endedMonthDate.getMonth() + 1
      const endedYear = endedMonthDate.getFullYear()

      const dueDate = new Date(now.getFullYear(), now.getMonth(), 1)
      dueDate.setDate(dueDate.getDate() + PAYMENT_DEADLINE_DAYS)

      const { data: monthlyRows, error: monthlyError } = await supabase
        .from('vendor_monthly_sales')
        .select('*')
        .eq('month', endedMonth)
        .eq('year', endedYear)
        .gt('total_sales', 0)

      if (monthlyError) throw monthlyError

      for (const row of monthlyRows || []) {
        const vendorRate = await getVendorCommissionRate(supabase, row.vendor_id)
        const commissionDue = Number((Number(row.total_sales || 0) * vendorRate).toFixed(2))
        const isPaid = Number(row.commission_paid || 0) >= commissionDue

        const { error: updateError } = await supabase
          .from('vendor_monthly_sales')
          .update({
            commission_due: commissionDue,
            status: isPaid ? 'paid' : 'pending',
            due_date: isPaid ? row.due_date : dueDate.toISOString(),
          })
          .eq('id', row.id)

        if (updateError) throw updateError

        await supabase.from('commission_notifications').insert({
          vendor_id: row.vendor_id,
          monthly_sale_id: row.id,
          type: 'month_end',
        })

        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        await supabase.from('vendor_monthly_sales').upsert(
          {
            vendor_id: row.vendor_id,
            month: currentMonth,
            year: currentYear,
            total_sales: 0,
            commission_rate: vendorRate,
            commission_due: 0,
            commission_paid: 0,
            status: 'active',
          },
          { onConflict: 'vendor_id,month,year' }
        )

        monthCloseProcessed += 1
      }
    }

    const { data: pendingRows, error: pendingError } = await supabase
      .from('vendor_monthly_sales')
      .select('*')
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    for (const row of pendingRows || []) {
      const due = row.due_date ? new Date(row.due_date).getTime() : null
      if (!due) continue

      const diffDays = Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24))

      if (diffDays === 3) {
        await supabase.from('commission_notifications').insert({
          vendor_id: row.vendor_id,
          monthly_sale_id: row.id,
          type: 'due_soon',
        })
        dueSoonNotified += 1
      }

      if (diffDays === 0) {
        await supabase.from('commission_notifications').insert({
          vendor_id: row.vendor_id,
          monthly_sale_id: row.id,
          type: 'due_today',
        })
        dueTodayNotified += 1
      }

      if (diffDays < 0) {
        const { error: overdueError } = await supabase
          .from('vendor_monthly_sales')
          .update({ status: 'overdue' })
          .eq('id', row.id)

        if (overdueError) throw overdueError

        const { error: freezeError } = await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('id', row.vendor_id)

        if (freezeError) throw freezeError

        await supabase.from('commission_notifications').insert({
          vendor_id: row.vendor_id,
          monthly_sale_id: row.id,
          type: 'account_frozen',
        })

        frozenAccounts += 1
      }
    }

    return json({
      success: true,
      month_close_processed: monthCloseProcessed,
      due_soon_notified: dueSoonNotified,
      due_today_notified: dueTodayNotified,
      frozen_accounts: frozenAccounts,
      ran_at: new Date().toISOString(),
    })
  } catch (error) {
    return json({ success: false, error: error?.message || 'Unknown error' }, 500)
  }
})
