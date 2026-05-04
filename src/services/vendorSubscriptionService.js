import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Free',
    name_ar: 'مجاني',
    price_monthly: 0,
    price_yearly: 0,
    max_products: 10,
    commission_rate: 5,
    features: ['10 products', '5% commission', 'Email support'],
    is_active: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    name_ar: 'أساسي',
    price_monthly: 99,
    price_yearly: 990,
    max_products: 50,
    commission_rate: 3,
    features: ['50 products', '3% commission', 'Email + phone support', 'Basic analytics'],
    is_active: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    name_ar: 'احترافي',
    price_monthly: 249,
    price_yearly: 2490,
    max_products: null,
    commission_rate: 2,
    features: ['Unlimited products', '2% commission', 'Priority support 24/7', 'Advanced analytics'],
    is_active: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    name_ar: 'مؤسسات',
    price_monthly: 499,
    price_yearly: 4990,
    max_products: null,
    commission_rate: 1,
    features: ['All professional features', '1% commission', 'Dedicated account manager', 'API access'],
    is_active: true,
  },
]

const PLAN_ORDER = { free: 0, basic: 1, professional: 2, enterprise: 3 }

const normalizePlan = (plan) => ({
  ...plan,
  features: Array.isArray(plan.features)
    ? plan.features
    : typeof plan.features === 'string'
      ? [plan.features]
      : [],
})

const sortPlans = (a, b) => (PLAN_ORDER[a.id] ?? 99) - (PLAN_ORDER[b.id] ?? 99)

const safeUrl = (url) => {
  if (!url) return null

  try {
    return new URL(url).toString()
  } catch {
    return null
  }
}

export const vendorSubscriptionService = {
  async getPlans() {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)

      if (error) {
        logger.warn('[vendorSubscriptionService] getPlans fallback:', error.message)
        return FALLBACK_PLANS.map(normalizePlan).sort(sortPlans)
      }

      if (!Array.isArray(data) || data.length === 0) {
        return FALLBACK_PLANS.map(normalizePlan).sort(sortPlans)
      }

      return data.map(normalizePlan).sort(sortPlans)
    } catch (error) {
      logger.error('[vendorSubscriptionService] getPlans error:', error)
      return FALLBACK_PLANS.map(normalizePlan).sort(sortPlans)
    }
  },

  async getCurrentSubscription(vendorId) {
    if (!vendorId) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id, subscription_plan, subscription_status, subscription_start, subscription_end, grace_period_ends')
      .eq('id', vendorId)
      .single()

    if (error) throw error

    return data
  },

  async getSubscriptionHistory(vendorId, limit = 6) {
    if (!vendorId) return []

    const { data, error } = await supabase
      .from('subscription_history')
      .select('id, old_plan, new_plan, change_type, amount, reason, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.warn('[vendorSubscriptionService] getSubscriptionHistory warning:', error.message)
      return []
    }

    return data || []
  },

  async getInvoices(vendorId, limit = 6) {
    if (!vendorId) return []

    const { data, error } = await supabase
      .from('invoices')
      .select('id, amount, currency, status, created_at, paid_at, subscription_plan')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.warn('[vendorSubscriptionService] getInvoices warning:', error.message)
      return []
    }

    return data || []
  },

  async createCheckoutSession({ planId, billingCycle = 'monthly' }) {
    if (!planId || planId === 'free') {
      throw new Error('Please choose a paid plan')
    }

    const origin = window.location.origin
    const successUrl = safeUrl(`${origin}/vendor/subscription?checkout=success`)
    const cancelUrl = safeUrl(`${origin}/vendor/subscription?checkout=cancel`)

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        planId,
        billingCycle,
        successUrl,
        cancelUrl,
      },
    })

    if (error) throw error
    if (!data?.url) throw new Error('No checkout URL returned from Stripe session')

    return data
  },
}

export default vendorSubscriptionService
