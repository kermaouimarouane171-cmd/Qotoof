import { PAYMENT_METHOD } from '@/constants/payment'

export const PAYMENT_METHOD_COLUMN = 'payment_method'
// Deprecated database column compatibility. All new writes must use payment_method only.
export const LEGACY_PAYMENT_METHOD_COLUMN = 'method'

let supabaseClientPromise = null

const getSupabaseClient = async () => {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@/services/supabase').then((module) => module.supabase)
  }

  return supabaseClientPromise
}

const PAYMENT_METHOD_NORMALIZATION = {
  bank: PAYMENT_METHOD.BANK_TRANSFER,
  bank_transfer: PAYMENT_METHOD.BANK_TRANSFER,
  cash: PAYMENT_METHOD.CASH,
  cash_on_delivery: PAYMENT_METHOD.CASH,
  cod: PAYMENT_METHOD.CASH,
  paypal: PAYMENT_METHOD.PAYPAL,
  cmi: PAYMENT_METHOD.CMI,
}

const PAYMENT_METHOD_FILTER_ALIASES = {
  [PAYMENT_METHOD.BANK_TRANSFER]: ['bank', 'bank_transfer'],
  [PAYMENT_METHOD.CASH]: ['cod', 'cash', 'cash_on_delivery'],
  [PAYMENT_METHOD.PAYPAL]: ['paypal'],
  [PAYMENT_METHOD.CMI]: ['cmi', 'card'],
}

export const normalizePaymentMethod = (value) => {
  if (value == null) return null

  const normalizedValue = String(value).trim().toLowerCase()
  if (!normalizedValue) return null

  return PAYMENT_METHOD_NORMALIZATION[normalizedValue] || normalizedValue
}

export const getPaymentMethodCandidates = (paymentMethod) => {
  const normalizedMethod = normalizePaymentMethod(paymentMethod)
  if (!normalizedMethod) return []

  return PAYMENT_METHOD_FILTER_ALIASES[normalizedMethod]
    ? [...PAYMENT_METHOD_FILTER_ALIASES[normalizedMethod]]
    : [normalizedMethod]
}

export const resolvePaymentMethod = (payment) => normalizePaymentMethod(
  payment?.[PAYMENT_METHOD_COLUMN]
  ?? payment?.paymentMethod
  ?? payment?.[LEGACY_PAYMENT_METHOD_COLUMN]
)

export const decoratePaymentRecord = (payment) => {
  if (!payment) return payment

  const paymentMethod = resolvePaymentMethod(payment)
  if (!paymentMethod) return payment

  return {
    ...payment,
    payment_method: paymentMethod,
    method: paymentMethod,
  }
}

export const buildPaymentWritePayload = (values = {}) => {
  const payload = { ...values }
  const paymentMethod = normalizePaymentMethod(
    payload.payment_method ?? payload.paymentMethod ?? payload.method
  )

  delete payload.paymentMethod
  delete payload.method

  if (paymentMethod) {
    payload.payment_method = paymentMethod
  }

  return payload
}

const buildPaymentMethodOrFilter = (paymentMethod) => {
  const candidates = getPaymentMethodCandidates(paymentMethod)
  if (candidates.length === 0) return ''

  return candidates.map((candidate) => `${PAYMENT_METHOD_COLUMN}.eq.${candidate}`).join(',')
}

export const applyPaymentMethodFilter = (query, paymentMethod) => {
  const orFilter = buildPaymentMethodOrFilter(paymentMethod)
  if (!orFilter) return query
  return query.or(orFilter)
}

export const insertPaymentRecord = async ({ client = null, payload, select = '*' } = {}) => {
  const activeClient = client || await getSupabaseClient()
  let query = activeClient.from('payments').insert(buildPaymentWritePayload(payload))

  if (select) {
    query = query.select(select).single()
  }

  const result = await query
  return {
    ...result,
    data: decoratePaymentRecord(result.data),
  }
}

export const getLatestPaymentRecordForOrder = async ({
  client = null,
  orderId,
  paymentMethod = null,
  select = '*',
  statuses,
  allowMissing = false,
} = {}) => {
  const activeClient = client || await getSupabaseClient()
  let query = activeClient
    .from('payments')
    .select(select)
    .eq('order_id', orderId)

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = statuses.length === 1
      ? query.eq('status', statuses[0])
      : query.in('status', statuses)
  }

  if (paymentMethod) {
    query = applyPaymentMethodFilter(query, paymentMethod)
  }

  query = query.order('created_at', { ascending: false }).limit(1)

  const result = await (allowMissing ? query.maybeSingle() : query.single())
  return {
    ...result,
    data: decoratePaymentRecord(result.data),
  }
}

export const getPaymentRecordById = async ({ client = null, paymentId, select = '*' } = {}) => {
  const activeClient = client || await getSupabaseClient()
  const result = await activeClient
    .from('payments')
    .select(select)
    .eq('id', paymentId)
    .single()

  return {
    ...result,
    data: decoratePaymentRecord(result.data),
  }
}

export const updatePaymentRecordById = async ({ client = null, paymentId, values, select = '*' } = {}) => {
  const activeClient = client || await getSupabaseClient()
  let query = activeClient
    .from('payments')
    .update(buildPaymentWritePayload(values))
    .eq('id', paymentId)

  if (select) {
    query = query.select(select).single()
  }

  const result = await query
  return {
    ...result,
    data: decoratePaymentRecord(result.data),
  }
}