import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

type Provider = 'stripe' | 'cmi'
type PaymentStatus = 'succeeded' | 'failed' | 'refunded'

type PaymentStatusWriteRequest = {
  provider: Provider
  status: PaymentStatus
  referenceId: string
  orderId?: string
  failureReason?: string
  transactionId?: string
}

type PaymentStatusWriteResponse = {
  success: boolean
  updatedPayments?: number
  updatedOrders?: number
  paymentStatus?: PaymentStatus
  orderStatus?: string
  paymentReference?: string
  error?: string
}

const json = (req: Request, body: PaymentStatusWriteResponse, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  },
)

const allowedRoles = new Set(['admin', 'finance_manager'])

const statusToOrderStatus: Record<PaymentStatus, { status: string; payment_status?: string }> = {
  succeeded: { status: 'confirmed', payment_status: 'paid' },
  failed: { status: 'payment_failed', payment_status: 'failed' },
  refunded: { status: 'refunded' },
}

const parseBody = (body: unknown): PaymentStatusWriteRequest | null => {
  if (!body || typeof body !== 'object') return null
  const input = body as Record<string, unknown>

  const provider = input.provider
  const status = input.status
  const referenceId = typeof input.referenceId === 'string' ? input.referenceId.trim() : ''
  const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : undefined
  const failureReason = typeof input.failureReason === 'string' ? input.failureReason.trim() : undefined
  const transactionId = typeof input.transactionId === 'string' ? input.transactionId.trim() : undefined

  if ((provider !== 'stripe' && provider !== 'cmi') || (status !== 'succeeded' && status !== 'failed' && status !== 'refunded')) {
    return null
  }

  if (!referenceId) return null

  return { provider, status, referenceId, orderId, failureReason, transactionId }
}

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json(req, { success: false, error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { success: false, error: 'Supabase configuration missing' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(req, { success: false, error: 'Authentication required' }, 401)
    }

    const token = authHeader.slice('Bearer '.length)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return json(req, { success: false, error: 'Invalid or expired token' }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profileError || !profile || !allowedRoles.has(profile.role)) {
      return json(req, { success: false, error: 'Forbidden: admin or finance_manager role required' }, 403)
    }

    const body = parseBody(await req.json())
    if (!body) {
      return json(req, { success: false, error: 'Invalid payload' }, 400)
    }

    const paymentPatch: Record<string, unknown> = { status: body.status }
    if (body.status === 'succeeded') {
      paymentPatch.paid_at = new Date().toISOString()
      if (body.provider === 'cmi' && body.transactionId) {
        paymentPatch.cmi_transaction_id = body.transactionId
      }
    }
    if (body.status === 'failed' && body.failureReason) {
      paymentPatch.failure_reason = body.failureReason
    }
    if (body.status === 'refunded') {
      paymentPatch.refunded_at = new Date().toISOString()
    }

    const paymentFilterColumn = body.provider === 'stripe' ? 'stripe_payment_intent_id' : 'cmi_order_id'
    const orderFilterColumn = body.provider === 'stripe' ? 'stripe_payment_intent_id' : 'id'

    const { data: updatedPayments, error: paymentError } = await supabase
      .from('payments')
      .update(paymentPatch)
      .eq(paymentFilterColumn, body.referenceId)
      .select('id')

    if (paymentError) {
      return json(req, { success: false, error: paymentError.message }, 500)
    }

    const orderPatch = statusToOrderStatus[body.status]
    const orderReference = body.orderId || body.referenceId

    const { data: updatedOrders, error: orderError } = await supabase
      .from('orders')
      .update(orderPatch)
      .eq(orderFilterColumn, orderReference)
      .select('id')

    if (orderError) {
      return json(req, { success: false, error: orderError.message }, 500)
    }

    return json(req, {
      success: true,
      updatedPayments: updatedPayments?.length ?? 0,
      updatedOrders: updatedOrders?.length ?? 0,
      paymentStatus: body.status,
      orderStatus: orderPatch.status,
      paymentReference: body.referenceId,
    }, 200)
  } catch (error) {
    return json(req, {
      success: false,
      error: error instanceof Error ? error.message : 'Unhandled error',
    }, 500)
  }
})
