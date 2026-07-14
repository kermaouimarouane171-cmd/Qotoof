import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/store/authStore'

const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Free',
    name_ar: 'مجاني',
    price_monthly: 0,
    price_yearly: 0,
    max_products: 15,
    commission_rate: 5,
    features: ['15 منتجات', 'عمولة 5%', 'دعم عبر البريد', 'ظهور عادي في البحث'],
    is_active: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    name_ar: 'أساسي',
    price_monthly: 149,
    price_yearly: 1490,
    max_products: 75,
    commission_rate: 3,
    features: [
      '75 منتج',
      'عمولة 3%',
      'دعم عبر البريد والهاتف',
      'تحليلات أساسية',
      'شارة موثّق في البحث',
      'كوبونات وتخفيضات',
    ],
    is_active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    name_ar: 'احترافي',
    price_monthly: 299,
    price_yearly: 2990,
    max_products: null,
    commission_rate: 2,
    features: [
      'منتجات غير محدودة',
      'عمولة 2%',
      'دعم أولوية 24/7',
      'تحليلات متقدمة',
      'رفع جماعي (Excel)',
      'سائق مفضل',
      'تنبيهات المخزون',
      'شارة موثّق + أولوية في البحث',
      'كوبونات وتخفيضات',
    ],
    is_active: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    name_ar: 'مؤسسات',
    price_monthly: 599,
    price_yearly: 5990,
    max_products: null,
    commission_rate: 1,
    features: [
      'كل مميزات الاحترافي',
      'عمولة 1%',
      'مدير حساب مخصص',
      'API كامل',
      'تكامل مخصص',
      'صفحة متجر مخصصة',
      'أعلى أولوية في البحث',
    ],
    is_active: true,
  },
]

const PLAN_ORDER = { free: 0, basic: 1, pro: 2, professional: 2, enterprise: 3 }

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
      .select(
        'id, subscription_plan, subscription_status, subscription_start, subscription_end, grace_period_ends, trial_ends_at'
      )
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

    // Use actual columns that exist in the invoices table
    const { data, error } = await supabase
      .from('invoices')
      .select('id, grand_total, currency, status, created_at, issued_at, invoice_number')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.warn('[vendorSubscriptionService] getInvoices warning:', error.message)
      return []
    }

    // Normalize to the format expected by the UI
    return (data || []).map((inv) => ({
      id: inv.id,
      amount: inv.grand_total,
      currency: inv.currency,
      status: inv.status,
      created_at: inv.created_at,
      paid_at: inv.issued_at,
      subscription_plan: null,
    }))
  },

  /**
   * Create a PayPal checkout session for subscription upgrade.
   * Uses the existing create-paypal-order edge function with subscription metadata.
   * The orderId encodes vendorId and planId so the webhook can update the vendor's plan.
   */
  async createCheckoutSession({ planId, billingCycle = 'monthly' }) {
    if (!planId || planId === 'free') {
      throw new Error('Please choose a paid plan')
    }

    // Get current vendor ID from auth store
    const { user } = useAuthStore.getState()
    if (!user?.id) {
      throw new Error('Authentication required')
    }

    const origin = window.location.origin
    const successUrl = safeUrl(`${origin}/vendor/subscription?checkout=success`)
    const cancelUrl = safeUrl(`${origin}/vendor/subscription?checkout=cancel`)

    // Fetch the plan to get the price
    const plans = await this.getPlans()
    const plan = plans.find((p) => p.id === planId)

    if (!plan) {
      throw new Error('Plan not found')
    }

    const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly

    if (!amount || amount <= 0) {
      throw new Error('Invalid plan amount')
    }

    // Encode vendorId and planId in orderId so the webhook can identify subscription payments
    // Format: sub:vendorId:planId:billingCycle:timestamp
    const orderId = `sub:${user.id}:${planId}:${billingCycle}:${Date.now()}`

    // Use the existing PayPal order creation edge function
    // The subscription metadata tells the webhook to update the vendor's plan
    const { data, error } = await supabase.functions.invoke('create-paypal-order', {
      body: {
        orderId,
        amount,
        currency: 'MAD',
        customer: {
          email: '',
          name: '',
        },
        metadata: {
          platform: 'qotoof',
          type: 'subscription',
          planId,
          billingCycle,
          vendorId: user.id,
        },
        returnUrl: successUrl || undefined,
        cancelUrl: cancelUrl || undefined,
      },
    })

    if (error) throw error
    if (!data?.approvalUrl && !data?.orderId) {
      throw new Error('No PayPal approval URL returned')
    }

    return {
      url: data.approvalUrl,
      orderId: data.orderId,
    }
  },

  /**
   * Start a 14-day Pro trial for a new vendor.
   * Calls the start_vendor_trial database function.
   */
  async startFreeTrial(vendorId) {
    if (!vendorId) throw new Error('Vendor ID is required')

    const { error } = await supabase.rpc('start_vendor_trial', {
      p_vendor_id: vendorId,
    })

    if (error) throw error

    // Update auth store profile
    useAuthStore.setState((state) => ({
      ...state,
      profile: state.profile
        ? {
            ...state.profile,
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          }
        : state.profile,
    }))

    return { success: true }
  },

  /**
   * Check if the vendor is currently on a free trial.
   */
  async isOnTrial(vendorId) {
    if (!vendorId) return false

    const { data, error } = await supabase.rpc('is_vendor_on_trial', {
      p_vendor_id: vendorId,
    })

    if (error) {
      logger.warn('[vendorSubscriptionService] isOnTrial error:', error.message)
      return false
    }

    return Boolean(data)
  },

  /**
   * Check if the vendor has a paid plan (for feature gating).
   */
  async isPaidVendor(vendorId) {
    if (!vendorId) return false

    const { data, error } = await supabase.rpc('is_vendor_paid', {
      p_vendor_id: vendorId,
    })

    if (error) {
      logger.warn('[vendorSubscriptionService] isPaidVendor error:', error.message)
      return false
    }

    return Boolean(data)
  },

  /**
   * Check if the vendor has access to a specific feature tier.
   * @param {string} vendorId - Vendor UUID
   * @param {string} requiredTier - 'free', 'basic', 'pro', or 'enterprise'
   */
  async hasFeatureAccess(vendorId, requiredTier) {
    if (!vendorId || !requiredTier) return false

    const { data, error } = await supabase.rpc('vendor_has_feature', {
      p_vendor_id: vendorId,
      p_required_tier: requiredTier,
    })

    if (error) {
      logger.warn('[vendorSubscriptionService] hasFeatureAccess error:', error.message)
      return false
    }

    return Boolean(data)
  },
}

export default vendorSubscriptionService
