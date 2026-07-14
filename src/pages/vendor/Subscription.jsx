import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  CreditCardIcon,
  ArrowPathIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import vendorSubscriptionService from '@/services/vendorSubscriptionService'
import { logger } from '@/utils/logger'

const formatPrice = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('fr-MA')
}

const statusMeta = {
  active: { labelKey: 'vendor.subscription.status.active', classes: 'bg-green-100 text-green-700' },
  past_due: { labelKey: 'vendor.subscription.status.past_due', classes: 'bg-amber-100 text-amber-700' },
  grace_period: { labelKey: 'vendor.subscription.status.grace_period', classes: 'bg-orange-100 text-orange-700' },
  canceled: { labelKey: 'vendor.subscription.status.canceled', classes: 'bg-gray-200 text-gray-700' },
}

const Subscription = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [submittingPlan, setSubmittingPlan] = useState('')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [history, setHistory] = useState([])
  const [invoices, setInvoices] = useState([])

  const currentPlanId = subscription?.subscription_plan || profile?.subscription_plan || 'free'
  const currentStatus = subscription?.subscription_status || profile?.subscription_status || 'active'

  const cycleMultiplier = useMemo(() => (billingCycle === 'yearly' ? 12 : 1), [billingCycle])

  useEffect(() => {
    const checkoutState = searchParams.get('checkout')
    if (!checkoutState) return

    if (checkoutState === 'success') {
      toast.success(t('vendor.subscription.paymentCompleted', 'Payment completed. We are refreshing your subscription status...'))
    } else if (checkoutState === 'cancel') {
      toast(t('vendor.subscription.paymentCanceled', 'Payment canceled. You can choose another plan anytime.'), { icon: 'ℹ️' })
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('checkout')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const loadData = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const [plansData, subscriptionData, historyData, invoicesData] = await Promise.all([
        vendorSubscriptionService.getPlans(),
        vendorSubscriptionService.getCurrentSubscription(user.id),
        vendorSubscriptionService.getSubscriptionHistory(user.id),
        vendorSubscriptionService.getInvoices(user.id),
      ])

      setPlans(plansData)
      setSubscription(subscriptionData)
      setHistory(historyData)
      setInvoices(invoicesData)

      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile
          ? {
              ...state.profile,
              subscription_plan: subscriptionData?.subscription_plan || state.profile.subscription_plan,
              subscription_status: subscriptionData?.subscription_status || state.profile.subscription_status,
              subscription_end: subscriptionData?.subscription_end || state.profile.subscription_end,
              grace_period_ends: subscriptionData?.grace_period_ends || state.profile.grace_period_ends,
            }
          : state.profile,
      }))
    } catch (error) {
      logger.error('[Subscription] loadData error:', error)
      toast.error(t('vendor.subscription.loadFailed', 'Unable to load subscription data right now'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleUpgrade = async (planId) => {
    if (planId === 'free') return

    setSubmittingPlan(planId)
    try {
      const { url } = await vendorSubscriptionService.createCheckoutSession({
        planId,
        billingCycle,
      })

      window.location.assign(url)
    } catch (error) {
      logger.error('[Subscription] handleUpgrade error:', error)
      toast.error(error?.message || t('vendor.subscription.checkoutFailed', 'Unable to start checkout session'))
    } finally {
      setSubmittingPlan('')
    }
  }

  const statusInfo = statusMeta[currentStatus] || statusMeta.active

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor.subscription.title', 'Vendor Premium')}</h1>
          <p className="text-sm text-gray-600">{t('vendor.subscription.subtitle', 'Upgrade your store, unlock advanced growth tools, and reduce commission.')}</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="btn-outline inline-flex items-center gap-2"
          disabled={loading}
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('vendor.subscription.refresh', 'Refresh')}
        </button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-500">{t('vendor.subscription.currentPlan', 'Current Plan')}</p>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-xl font-semibold capitalize text-gray-900">{currentPlanId}</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.classes}`}>
                {t(statusInfo.labelKey)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {t('vendor.subscription.subscriptionEnds', 'Subscription ends:')} <span className="font-medium">{formatDate(subscription?.subscription_end)}</span>
            </p>
            {currentStatus === 'grace_period' && (
              <p className="text-sm text-orange-700 mt-1">
                {t('vendor.subscription.gracePeriodUntil', 'Grace period until:')} <span className="font-medium">{formatDate(subscription?.grace_period_ends)}</span>
              </p>
            )}
            {/* Free trial banner */}
            {subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > new Date() && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                <SparklesIcon className="w-4 h-4" />
                {t('vendor.subscription.trialActive', 'تجربة مجانية نشطة حتى:')} <span className="font-bold">{formatDate(subscription.trial_ends_at)}</span>
              </div>
            )}
          </div>

          <div className="bg-gray-100 rounded-xl p-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
              }`}
            >
              {t('vendor.subscription.monthly', 'Monthly')}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'yearly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
              }`}
            >
              {t('vendor.subscription.yearly', 'Yearly')}
            </button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id
            const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly
            const monthlyEquivalent = billingCycle === 'yearly' && Number(plan.price_yearly || 0) > 0
              ? Math.round(Number(plan.price_yearly || 0) / cycleMultiplier)
              : null

            return (
              <Card
                key={plan.id}
                className={`p-5 border-2 transition-all ${
                  isCurrent ? 'border-green-500 shadow-lg shadow-green-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 capitalize">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{plan.name_ar}</p>
                  </div>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      {t('vendor.subscription.currentBadge', 'Current')}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-extrabold text-gray-900">{formatPrice(price)}</p>
                  <p className="text-xs text-gray-500">
                    {t(billingCycle === 'yearly' ? 'vendor.subscription.perYear' : 'vendor.subscription.perMonth', billingCycle === 'yearly' ? 'per year' : 'per month')}
                    {monthlyEquivalent ? ` • ${t('vendor.subscription.monthlyEquivalent', '~{{price}}/month', { price: formatPrice(monthlyEquivalent) })}` : ''}
                  </p>
                </div>

                <div className="mt-4 space-y-1 text-sm text-gray-700">
                  <p className="font-medium">{t('vendor.subscription.maxProducts', 'Max products:')} {plan.max_products || t('vendor.subscription.unlimited', 'Unlimited')}</p>
                  <p className="font-medium">{t('vendor.subscription.commission', 'Commission:')} {plan.commission_rate}%</p>
                </div>

                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {(plan.features || []).map((feature) => (
                    <li key={`${plan.id}-${feature}`} className="flex items-start gap-2">
                      <BoltIcon className="w-4 h-4 mt-0.5 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`mt-5 w-full ${isCurrent ? 'btn-secondary' : 'btn-primary'} inline-flex items-center justify-center gap-2`}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || plan.id === 'free' || submittingPlan === plan.id}
                >
                  {submittingPlan === plan.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <CreditCardIcon className="w-4 h-4" />
                  )}
                  {isCurrent ? t('vendor.subscription.currentPlanButton', 'Current Plan') : plan.id === 'free' ? t('vendor.subscription.includedButton', 'Included') : t('vendor.subscription.upgradeButton', 'Upgrade')}
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('vendor.subscription.recentBilling', 'Recent Billing')}</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-500">{t('vendor.subscription.noInvoices', 'No invoices yet.')}</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{invoice.subscription_plan}</p>
                    <p className="text-xs text-gray-500">{formatDate(invoice.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(invoice.amount)}</p>
                    <p className="text-xs text-gray-500 capitalize">{invoice.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('vendor.subscription.planActivity', 'Plan Activity')}</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">{t('vendor.subscription.noActivity', 'No subscription activity yet.')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{item.change_type.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-gray-500">{item.reason || `${item.old_plan || 'none'} -> ${item.new_plan}`}</p>
                  </div>
                  <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Subscription
