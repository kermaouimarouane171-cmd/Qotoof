import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  Card,
  Badge,
  EmptyState,
  ErrorState,
  StateSkeleton as Skeleton,
} from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  ResponsiveContainer,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts'
import {
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const RANGE_OPTIONS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
]

const DriverEarnings = () => {
  const { t } = useTranslation()
  const { profile, user } = useAuthStore()
  const driverId = profile?.id || user?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('30d')
  const [deliveries, setDeliveries] = useState([])

  const loadEarnings = useCallback(async () => {
    if (!driverId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('deliveries')
        .select(`
          id,
          status,
          delivery_price,
          distance_km,
          created_at,
          completed_at,
          order:orders(
            order_number,
            buyer:profiles!orders_buyer_id_fkey(first_name, last_name),
            vendor:profiles!orders_vendor_id_fkey(store_name)
          )
        `)
        .eq('driver_id', driverId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (loadError) {
      logger.error('Error loading driver earnings:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  const rangeStart = useMemo(() => {
    if (range === 'all') return null
    const now = new Date()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }, [range])

  const completedDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => delivery.completed_at || delivery.status === 'delivered')
  }, [deliveries])

  const filteredDeliveries = useMemo(() => {
    if (!rangeStart) return completedDeliveries
    return completedDeliveries.filter((delivery) => {
      const finishedAt = new Date(delivery.completed_at || delivery.created_at)
      return finishedAt >= rangeStart
    })
  }, [completedDeliveries, rangeStart])

  const totals = useMemo(() => {
    const dailyMap = new Map()
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - 6)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let totalEarnings = 0
    let todayEarnings = 0
    let weekEarnings = 0
    let monthEarnings = 0

    filteredDeliveries.forEach((delivery) => {
      const amount = Number(delivery.delivery_price || 0)
      const finishedAt = new Date(delivery.completed_at || delivery.created_at)
      const dayKey = finishedAt.toISOString().slice(0, 10)

      totalEarnings += amount
      if (finishedAt >= startOfToday) todayEarnings += amount
      if (finishedAt >= startOfWeek) weekEarnings += amount
      if (finishedAt >= startOfMonth) monthEarnings += amount

      const bucket = dailyMap.get(dayKey) || { date: dayKey, earnings: 0, deliveries: 0 }
      bucket.earnings += amount
      bucket.deliveries += 1
      dailyMap.set(dayKey, bucket)
    })

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    const averageEarnings = filteredDeliveries.length > 0 ? totalEarnings / filteredDeliveries.length : 0

    return {
      totalEarnings,
      todayEarnings,
      weekEarnings,
      monthEarnings,
      averageEarnings,
      chartData,
    }
  }, [filteredDeliveries])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton.Card key={index} />)}
        </div>
        <Skeleton.Card className="min-h-[360px]" />
        <Skeleton.Table rows={4} columns={4} />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        title={t('driver.earnings.loadFailed', 'Failed to load earnings')}
        description={t('driver.earnings.loadFailedDesc', 'We could not load your earnings summary. Try again.')}
        onRetry={loadEarnings}
        onGoBack={() => window.history.back()}
        retryLabel={t('common.retry', 'Retry')}
        backLabel={t('common.goBack', 'Go Back')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.earnings.title', 'Earnings')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('driver.earnings.subtitle', 'Track completed deliveries and delivery income over time')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                range === option.id
                  ? 'bg-green-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t(`driver.earnings.ranges.${option.id}`, option.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{t('driver.earnings.total', 'Total earnings')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(totals.totalEarnings)}</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3 text-green-600">
              <BanknotesIcon className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{t('driver.earnings.today', 'Today')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(totals.todayEarnings)}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{t('driver.earnings.thisWeek', 'This week')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(totals.weekEarnings)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <CalendarDaysIcon className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{t('driver.earnings.average', 'Avg. per delivery')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(totals.averageEarnings)}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-3 text-purple-600">
              <ChartBarIcon className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('driver.earnings.chartTitle', 'Earnings trend')}</h2>
              <p className="text-sm text-gray-500">{t('driver.earnings.chartSubtitle', 'Daily earnings for the selected range')}</p>
            </div>
            <button
              type="button"
              onClick={loadEarnings}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t('common.refresh', 'Refresh')}
            </button>
          </div>

          {totals.chartData.length === 0 ? (
            <EmptyState
              icon="shopping"
              title={t('driver.earnings.empty.title', 'No completed deliveries yet')}
              description={t('driver.earnings.empty.description', 'Completed deliveries will appear here once they are marked done.')}
            />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totals.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                  <YAxis tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    formatter={(value) => [formatPrice(value), t('driver.earnings.earnings', 'Earnings')]}
                    labelFormatter={(label) => label}
                  />
                  <Area type="monotone" dataKey="earnings" stroke="#16a34a" fill="#bbf7d0" fillOpacity={0.55} />
                  <Line type="monotone" dataKey="deliveries" stroke="#2563eb" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('driver.earnings.breakdownTitle', 'Quick breakdown')}</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">{t('driver.earnings.completedCount', 'Completed deliveries')}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{filteredDeliveries.length}</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-sm text-green-700">{t('driver.earnings.monthTotal', 'This month')}</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{formatPrice(totals.monthEarnings)}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-sm text-blue-700">{t('driver.earnings.rangeLabel', 'Current range')}</p>
              <p className="mt-1 text-base font-semibold text-blue-900">
                {t(`driver.earnings.ranges.${range}`, RANGE_OPTIONS.find((option) => option.id === range)?.label || range)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('driver.earnings.recentTitle', 'Recent completed deliveries')}</h2>
            <p className="text-sm text-gray-500">{t('driver.earnings.recentSubtitle', 'The latest deliveries that contributed to your earnings')}</p>
          </div>
        </div>

        {filteredDeliveries.length === 0 ? (
          <EmptyState
            icon="truck"
            title={t('driver.earnings.noRowsTitle', 'Nothing to show yet')}
            description={t('driver.earnings.noRowsDescription', 'Complete deliveries to build your earnings history.')}
          />
        ) : (
          <div className="space-y-3">
            {filteredDeliveries.slice(0, 6).map((delivery) => {
              const finishedAt = new Date(delivery.completed_at || delivery.created_at)
              const orderNumber = delivery.order?.order_number || delivery.id.slice(0, 8)
              const vendorName = delivery.order?.vendor?.store_name || t('common.vendor', 'Vendor')
              const buyerName = delivery.order?.buyer
                ? `${delivery.order.buyer.first_name || ''} ${delivery.order.buyer.last_name || ''}`.trim()
                : t('common.buyer', 'Buyer')

              return (
                <div key={delivery.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">#{orderNumber}</p>
                      <Badge className="bg-green-100 text-green-700">{t('driver.earnings.completed', 'Completed')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{vendorName} · {buyerName}</p>
                    <p className="mt-1 text-xs text-gray-400">{finishedAt.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                    <span className="text-gray-700">{formatPrice(delivery.delivery_price || 0)}</span>
                    <span className="text-gray-500">
                      {delivery.distance_km ? `${Number(delivery.distance_km).toFixed(1)} km` : t('driver.earnings.distanceUnknown', 'Distance unavailable')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

const DriverEarningsWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverEarnings">
    <DriverEarnings />
  </ErrorBoundary>
)

export default DriverEarningsWithErrorBoundary
