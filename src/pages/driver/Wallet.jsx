import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, StateSkeleton as Skeleton } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  CreditCardIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

const DriverWallet = () => {
  const { t } = useTranslation()
  const { profile, user } = useAuthStore()
  const driverId = profile?.id || user?.id

  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])
  const [dateRange, setDateRange] = useState('all')

  const load = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, delivery_number, status, delivery_price, created_at, delivered_at, completed_at, payout_status, order:orders(order_number, buyer:profiles!orders_buyer_id_fkey(first_name, last_name))')
        .eq('driver_id', driverId)
        .in('status', ['delivered', 'completed'])
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (err) {
      logger.error('Wallet load error:', err)
      toast.error(t('driver.wallet.loadFailed', 'Failed to load wallet data'))
    } finally {
      setLoading(false)
    }
  }, [driverId, t])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const filterDate = (d) => {
    const dt = new Date(d.delivered_at || d.completed_at || d.created_at)
    if (dateRange === 'today') return dt.toDateString() === now.toDateString()
    if (dateRange === 'week') return dt >= new Date(now.getTime() - 7 * 86400000)
    if (dateRange === 'month') return dt >= new Date(now.getTime() - 30 * 86400000)
    return true
  }

  const filtered = deliveries.filter(filterDate)
  const pending = filtered.filter(d => !d.payout_status || d.payout_status === 'pending')
  const paid = filtered.filter(d => d.payout_status === 'paid')

  const totalEarned = filtered.reduce((s, d) => s + Number(d.delivery_price || 0), 0)
  const pendingBalance = pending.reduce((s, d) => s + Number(d.delivery_price || 0), 0)
  const paidOut = paid.reduce((s, d) => s + Number(d.delivery_price || 0), 0)

  const paypalEmail = profile?.paypal_email
  const paypalVerified = profile?.paypal_verified

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
        <Skeleton.Table rows={8} columns={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.wallet.title', 'Wallet')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('driver.wallet.subtitle', 'Your earnings and payout history')}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* PayPal Status Banner */}
      <div className={`rounded-xl p-4 flex items-start gap-3 border ${paypalVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <CreditCardIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${paypalVerified ? 'text-green-600' : 'text-amber-600'}`} />
        <div>
          <p className={`text-sm font-medium ${paypalVerified ? 'text-green-900' : 'text-amber-900'}`}>
            {paypalVerified
              ? t('driver.wallet.paypalVerified', 'PayPal account verified')
              : t('driver.wallet.paypalNotVerified', 'PayPal account not yet verified')}
          </p>
          <p className={`text-xs mt-0.5 ${paypalVerified ? 'text-green-700' : 'text-amber-700'}`}>
            {paypalEmail
              ? paypalEmail
              : t('driver.wallet.noPaypal', 'No PayPal email set — go to Settings to add one')}
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <BanknotesIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{formatPrice(totalEarned)}</p>
          <p className="text-sm text-gray-500">{t('driver.wallet.totalEarned', 'Total Earned')}</p>
          <p className="text-xs text-gray-400 mt-1">{filtered.length} {t('driver.wallet.deliveries', 'deliveries')}</p>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
            <ClockIcon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatPrice(pendingBalance)}</p>
          <p className="text-sm text-gray-500">{t('driver.wallet.pendingBalance', 'Pending Balance')}</p>
          <p className="text-xs text-gray-400 mt-1">{pending.length} {t('driver.wallet.awaitingPayout', 'awaiting payout')}</p>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <CheckCircleIcon className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatPrice(paidOut)}</p>
          <p className="text-sm text-gray-500">{t('driver.wallet.paidOut', 'Paid Out')}</p>
          <p className="text-xs text-gray-400 mt-1">{paid.length} {t('driver.wallet.transactions', 'transactions')}</p>
        </Card>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: t('driver.wallet.dates.all', 'All Time') },
          { value: 'today', label: t('driver.wallet.dates.today', 'Today') },
          { value: 'week', label: t('driver.wallet.dates.week', 'Last 7 days') },
          { value: 'month', label: t('driver.wallet.dates.month', 'Last 30 days') },
        ].map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDateRange(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              dateRange === opt.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Earnings Ledger */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t('driver.wallet.ledger', 'Earnings Ledger')}</h2>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{t('driver.wallet.noEntries', 'No earnings in this period')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => {
              const isPaid = d.payout_status === 'paid'
              const date = new Date(d.delivered_at || d.completed_at || d.created_at)
              return (
                <div key={d.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-blue-100' : 'bg-amber-100'}`}>
                      {isPaid
                        ? <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                        : <ClockIcon className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {d.delivery_number || `#${d.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {d.order?.buyer?.first_name && (
                          <span className="ml-1">· {d.order.buyer.first_name} {d.order.buyer.last_name}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+{formatPrice(d.delivery_price || 0)}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPaid ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isPaid
                        ? t('driver.wallet.paid', 'Paid')
                        : t('driver.wallet.pending', 'Pending')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Payout Info */}
      <Card className="p-6 bg-gray-50">
        <h2 className="font-semibold text-gray-900 mb-3">{t('driver.wallet.payoutInfo', 'How Payouts Work')}</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {t('driver.wallet.payoutStep1', 'Earnings are added after each completed delivery')}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {t('driver.wallet.payoutStep2', 'Payouts are processed by the admin team via PayPal')}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {t('driver.wallet.payoutStep3', 'Ensure your PayPal email in Settings is correct and verified')}
          </li>
        </ul>
      </Card>
    </div>
  )
}

const DriverWalletWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverWallet">
    <DriverWallet />
  </ErrorBoundary>
)

export default DriverWalletWithErrorBoundary
