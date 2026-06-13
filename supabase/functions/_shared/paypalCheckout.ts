import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE')
  || (Deno.env.get('VITE_PAYMENT_MODE') === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

export const paypalCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const paypalJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...paypalCorsHeaders,
    },
  })

const buildAdminClient = () => createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')
type AdminClient = ReturnType<typeof buildAdminClient>

type PayPalCapture = {
  id?: string
  status?: string
  amount?: {
    value?: string
    currency_code?: string
  }
}

type PayPalPurchaseUnit = {
  reference_id?: string
  custom_id?: string
  payments?: {
    captures?: PayPalCapture[]
  }
}

export type PayPalOrderData = {
  id?: string
  status?: string
  purchase_units?: PayPalPurchaseUnit[]
} & Record<string, unknown>

const normalizePayPalStatus = (status: unknown) => String(status || '').trim().toUpperCase()

export const createAdminClient = ({ required = false }: { required?: boolean } = {}) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (required) {
      throw new Error('Missing Supabase environment variables')
    }
    return null
  }

  return buildAdminClient()
}

export const getPayPalAccessToken = async () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured')
  }

  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const rawBody = await response.text()
  const data = rawBody ? JSON.parse(rawBody) : {}

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Unable to get PayPal access token')
  }

  return data.access_token as string
}

const paypalApiRequest = async (
  path: string,
  {
    accessToken,
    method = 'GET',
    body,
  }: {
    accessToken: string
    method?: 'GET' | 'POST'
    body?: string
  },
) => {
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
    },
    ...(body ? { body } : {}),
  })

  const rawBody = await response.text()
  const data = rawBody ? JSON.parse(rawBody) : {}

  if (!response.ok) {
    throw new Error((data as { message?: string })?.message || 'PayPal API request failed')
  }

  return data as PayPalOrderData
}

export const getPayPalOrderDetails = async (accessToken: string, paypalOrderId: string) =>
  paypalApiRequest(`/v2/checkout/orders/${paypalOrderId}`, { accessToken })

export const capturePayPalOrder = async (accessToken: string, paypalOrderId: string) =>
  paypalApiRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    accessToken,
    method: 'POST',
    body: '{}',
  })

export const extractPayPalCaptures = (paypalOrderData: PayPalOrderData) =>
  paypalOrderData.purchase_units?.flatMap((unit) => unit?.payments?.captures || []) || []

export const resolveInternalOrderId = (paypalOrderData: PayPalOrderData) => {
  const targetUnit = paypalOrderData.purchase_units?.find((unit) => Boolean(unit?.reference_id || unit?.custom_id))
  return targetUnit?.reference_id || targetUnit?.custom_id || null
}

const resolvePayPalPaymentState = (paypalOrderData: PayPalOrderData) => {
  const paypalStatus = normalizePayPalStatus(paypalOrderData.status)
  const captureStatuses = extractPayPalCaptures(paypalOrderData).map((capture) => normalizePayPalStatus(capture.status))

  if (captureStatuses.includes('REFUNDED') || captureStatuses.includes('PARTIALLY_REFUNDED')) {
    return {
      paymentStatus: 'refunded',
      orderPaymentStatus: 'refunded',
    }
  }

  if (paypalStatus === 'COMPLETED' || captureStatuses.includes('COMPLETED')) {
    return {
      paymentStatus: 'completed',
      orderPaymentStatus: 'paid',
    }
  }

  if (
    ['VOIDED', 'CANCELLED', 'DECLINED', 'DENIED', 'FAILED', 'EXPIRED'].includes(paypalStatus)
    || captureStatuses.some((status) => ['DECLINED', 'DENIED', 'FAILED'].includes(status))
  ) {
    return {
      paymentStatus: 'failed',
      orderPaymentStatus: 'failed',
    }
  }

  return {
    paymentStatus: 'pending',
    orderPaymentStatus: 'pending',
  }
}

export const persistPayPalOrderState = async ({
  paypalOrderId,
  paypalOrderData,
  adminClient = null,
}: {
  paypalOrderId: string
  paypalOrderData: PayPalOrderData
  adminClient?: AdminClient | null
}) => {
  const resolvedState = resolvePayPalPaymentState(paypalOrderData)
  const internalOrderId = resolveInternalOrderId(paypalOrderData)
  const now = new Date().toISOString()
  const client = adminClient || createAdminClient()

  if (!client) {
    return {
      paymentId: null,
      internalOrderId,
      paymentStatus: resolvedState.paymentStatus,
      orderPaymentStatus: resolvedState.orderPaymentStatus,
    }
  }

  let paymentRecord: { id: string; order_id: string | null; status: string | null } | null = null

  const paymentByTransaction = await client
    .from('payments')
    .select('id, order_id, status')
    .eq('transaction_id', paypalOrderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paymentByTransaction.error) {
    throw paymentByTransaction.error
  }

  paymentRecord = paymentByTransaction.data

  if (!paymentRecord?.id && internalOrderId) {
    const paymentByOrder = await client
      .from('payments')
      .select('id, order_id, status')
      .eq('order_id', internalOrderId)
      .eq('payment_method', 'paypal')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentByOrder.error) {
      throw paymentByOrder.error
    }

    paymentRecord = paymentByOrder.data
  }

  let paymentStatus = resolvedState.paymentStatus
  let orderPaymentStatus = resolvedState.orderPaymentStatus

  if (paymentRecord?.status === 'refunded') {
    paymentStatus = 'refunded'
    orderPaymentStatus = 'refunded'
  } else if (
    paymentRecord?.status === 'completed'
    && paymentStatus !== 'completed'
    && paymentStatus !== 'refunded'
  ) {
    paymentStatus = 'completed'
    orderPaymentStatus = 'paid'
  }

  if (paymentRecord?.id) {
    const paymentUpdate: Record<string, unknown> = {
      status: paymentStatus,
      transaction_id: paypalOrderId,
      updated_at: now,
    }

    const { error: paymentUpdateError } = await client
      .from('payments')
      .update(paymentUpdate)
      .eq('id', paymentRecord.id)

    if (paymentUpdateError) {
      throw paymentUpdateError
    }
  }

  const orderIdToUpdate = paymentRecord?.order_id || internalOrderId

  if (orderIdToUpdate) {
    const { error: orderUpdateError } = await client
      .from('orders')
      .update({
        payment_intent_id: paypalOrderId,
        payment_status: orderPaymentStatus,
        updated_at: now,
      })
      .eq('id', orderIdToUpdate)

    if (orderUpdateError) {
      throw orderUpdateError
    }
  }

  return {
    paymentId: paymentRecord?.id || null,
    internalOrderId: orderIdToUpdate || null,
    paymentStatus,
    orderPaymentStatus,
  }
}

export const reconcilePayPalOrder = async ({
  paypalOrderId,
  adminClient = null,
  captureApprovedOrders = true,
}: {
  paypalOrderId: string
  adminClient?: AdminClient | null
  captureApprovedOrders?: boolean
}) => {
  const accessToken = await getPayPalAccessToken()
  const currentOrder = await getPayPalOrderDetails(accessToken, paypalOrderId)
  const currentStatus = normalizePayPalStatus(currentOrder.status)

  let finalOrder = currentOrder
  let action = 'inspected'

  if (captureApprovedOrders && currentStatus === 'APPROVED') {
    finalOrder = await capturePayPalOrder(accessToken, paypalOrderId)
    action = 'captured'
  }

  const persistedState = await persistPayPalOrderState({
    paypalOrderId,
    paypalOrderData: finalOrder,
    adminClient,
  })

  return {
    action,
    captures: extractPayPalCaptures(finalOrder),
    paypalOrder: finalOrder,
    persistedState,
  }
}