import { supabase } from '@/services/supabase'

export const DEFAULT_REFUND_POLICY = {
  return_window_days: 7,
  allow_partial_returns: true,
  return_shipping_paid_by: 'buyer',
  non_returnable_categories: [],
  policy_text: 'يمكن طلب الاسترجاع خلال 7 أيام من تاريخ الاستلام وفق حالة المنتج.',
}

const normalizePolicy = (policy) => ({
  ...DEFAULT_REFUND_POLICY,
  ...policy,
  return_window_days: Number(policy?.return_window_days ?? DEFAULT_REFUND_POLICY.return_window_days),
  allow_partial_returns: Boolean(policy?.allow_partial_returns ?? DEFAULT_REFUND_POLICY.allow_partial_returns),
  return_shipping_paid_by: policy?.return_shipping_paid_by || DEFAULT_REFUND_POLICY.return_shipping_paid_by,
  non_returnable_categories: Array.isArray(policy?.non_returnable_categories) ? policy.non_returnable_categories : [],
  policy_text: (policy?.policy_text || DEFAULT_REFUND_POLICY.policy_text).trim(),
})

const getVendorRefundPolicy = async (vendorId) => {
  const { data, error } = await supabase
    .from('refund_policies')
    .select('*')
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return { ...DEFAULT_REFUND_POLICY }
  }

  return normalizePolicy(data)
}

const upsertVendorRefundPolicy = async ({ vendorId, policy }) => {
  const normalized = normalizePolicy(policy)

  const { data, error } = await supabase
    .from('refund_policies')
    .upsert(
      {
        vendor_id: vendorId,
        ...normalized,
      },
      { onConflict: 'vendor_id' }
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return normalizePolicy(data)
}

export const refundPolicyService = {
  getVendorRefundPolicy,
  upsertVendorRefundPolicy,
  normalizePolicy,
}

export default refundPolicyService