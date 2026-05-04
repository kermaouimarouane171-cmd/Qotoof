import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const DEFAULT_RESTRICTION_DAYS = 30

const roundAmount = (value) => Number(Number(value || 0).toFixed(2))

const normalizeTrustProfile = (data = {}) => ({
  trustScore: Number(data.trust_score ?? 100),
  completedOrdersCount: Number(data.completed_orders_count ?? 0),
  failedPaymentsCount: Number(data.failed_payments_count ?? 0),
  codEligible: Boolean(data.cod_eligible),
  codRestrictedUntil: data.cod_restricted_until || null,
})

const getBuyerTrustProfile = async (userId) => {
  if (!userId) {
    return normalizeTrustProfile()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('trust_score, completed_orders_count, failed_payments_count, cod_eligible, cod_restricted_until')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.error('Failed to load buyer trust profile:', error)
    throw error
  }

  return normalizeTrustProfile(data)
}

const checkCodEligibility = async (userId) => {
  const profile = await getBuyerTrustProfile(userId)
  const restrictedUntilDate = profile.codRestrictedUntil ? new Date(profile.codRestrictedUntil) : null
  const isRestricted = Boolean(restrictedUntilDate && restrictedUntilDate > new Date())
  const meetsCompletionRequirement = profile.completedOrdersCount >= 3
  const meetsScoreRequirement = profile.trustScore >= 70
  const eligibleByRules = meetsCompletionRequirement && meetsScoreRequirement && !isRestricted
  const eligible = eligibleByRules && (profile.codEligible || eligibleByRules)

  let reason = ''
  if (!meetsCompletionRequirement) {
    reason = 'الدفع عند الاستلام يتطلب 3 طلبات مكتملة على الأقل.'
  } else if (!meetsScoreRequirement) {
    reason = 'درجة الثقة الحالية أقل من الحد الأدنى المطلوب للدفع عند الاستلام.'
  } else if (isRestricted) {
    reason = `تم تقييد الدفع عند الاستلام حتى ${restrictedUntilDate.toLocaleDateString('ar-MA')}.`
  }

  return {
    ...profile,
    eligible,
    reason,
  }
}

const getVendorPaymentPolicies = async (vendorIds = []) => {
  if (!vendorIds.length) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, store_name, payment_policy_full, payment_policy_split, payment_policy_cod')
    .in('id', vendorIds)

  if (error) {
    logger.error('Failed to load vendor payment policies:', error)
    throw error
  }

  return (data || []).map((vendor) => ({
    id: vendor.id,
    storeName: vendor.store_name || 'Vendor',
    full: vendor.payment_policy_full ?? true,
    split: vendor.payment_policy_split ?? true,
    cod: vendor.payment_policy_cod ?? false,
  }))
}

const resolveAvailablePaymentTypes = ({ vendorPolicies = [], codEligibility }) => {
  if (!vendorPolicies.length) {
    return {
      full: true,
      split: true,
      cod: Boolean(codEligibility?.eligible),
      vendorCodSupported: true,
      codBlockedByTrust: !codEligibility?.eligible,
      hasAny: true,
    }
  }

  const full = vendorPolicies.every((vendor) => vendor.full)
  const split = vendorPolicies.every((vendor) => vendor.split)
  const vendorCodSupported = vendorPolicies.every((vendor) => vendor.cod)
  const cod = vendorCodSupported && Boolean(codEligibility?.eligible)

  return {
    full,
    split,
    cod,
    vendorCodSupported,
    codBlockedByTrust: vendorCodSupported && !codEligibility?.eligible,
    hasAny: full || split || cod,
  }
}

const buildPaymentPlan = ({ paymentType, payableAmount, paymentMethod = 'bank' }) => {
  const totalAmount = roundAmount(payableAmount)
  const selectedMethod = paymentMethod === 'paypal' ? 'paypal' : 'bank'

  if (paymentType === 'split') {
    const firstPaymentAmount = roundAmount(totalAmount / 2)
    return {
      paymentType: 'split',
      paymentMethod: selectedMethod,
      firstPaymentAmount,
      firstPaymentStatus: 'pending',
      secondPaymentAmount: roundAmount(totalAmount - firstPaymentAmount),
      secondPaymentStatus: 'pending',
      secondPaymentDueAt: null,
    }
  }

  if (paymentType === 'cod') {
    return {
      paymentType: 'cod',
      paymentMethod: 'cod',
      firstPaymentAmount: 0,
      firstPaymentStatus: 'verified',
      secondPaymentAmount: totalAmount,
      secondPaymentStatus: 'pending',
      secondPaymentDueAt: null,
    }
  }

  return {
    paymentType: 'full',
    paymentMethod: selectedMethod,
    firstPaymentAmount: totalAmount,
    firstPaymentStatus: 'pending',
    secondPaymentAmount: 0,
    secondPaymentStatus: 'verified',
    secondPaymentDueAt: null,
  }
}

const updateTrustScore = async (userId, change) => {
  const { error } = await supabase.rpc('update_trust_score', {
    p_user_id: userId,
    p_change: change,
  })

  if (error) {
    logger.error('Failed to update trust score:', error)
    throw error
  }
}

const syncCodEligibility = async (userId) => {
  const eligibility = await checkCodEligibility(userId)

  const { error } = await supabase
    .from('profiles')
    .update({
      cod_eligible: eligibility.eligible,
    })
    .eq('id', userId)

  if (error) {
    logger.error('Failed to sync COD eligibility:', error)
    throw error
  }

  return eligibility
}

const recordSuccessfulOrder = async (userId, trustDelta = 2) => {
  const profile = await getBuyerTrustProfile(userId)

  const { error } = await supabase
    .from('profiles')
    .update({
      completed_orders_count: profile.completedOrdersCount + 1,
    })
    .eq('id', userId)

  if (error) {
    logger.error('Failed to increment completed orders count:', error)
    throw error
  }

  await updateTrustScore(userId, trustDelta)
  return syncCodEligibility(userId)
}

const registerFailedPayment = async (
  userId,
  { penalty = 15, restrictionDays = DEFAULT_RESTRICTION_DAYS } = {}
) => {
  const profile = await getBuyerTrustProfile(userId)
  const restrictedUntil = new Date(Date.now() + restrictionDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({
      failed_payments_count: profile.failedPaymentsCount + 1,
      cod_eligible: false,
      cod_restricted_until: restrictedUntil,
    })
    .eq('id', userId)

  if (error) {
    logger.error('Failed to register failed payment:', error)
    throw error
  }

  await updateTrustScore(userId, -Math.abs(penalty))
  return syncCodEligibility(userId)
}

const trustScoreService = {
  buildPaymentPlan,
  checkCodEligibility,
  getBuyerTrustProfile,
  getVendorPaymentPolicies,
  recordSuccessfulOrder,
  registerFailedPayment,
  resolveAvailablePaymentTypes,
  syncCodEligibility,
  updateTrustScore,
}

export default trustScoreService