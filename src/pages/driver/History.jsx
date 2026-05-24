import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Card, Badge, EmptyState, ErrorState, StateSkeleton as Skeleton } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  ClockIcon,
  TruckIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const DELIVERIES_PER_PAGE = 10

const DriverHistory = () => {
  const { t } = useTranslation()
  const { profile, user } = useAuthStore()
  const driverId = profile?.id || user?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const getDateRange = useCallback(() => {
    const now = new Date()
    let startDate = null
    let endDate = null

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        endDate = now
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        endDate = now
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        endDate = now
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(`${customEndDate}T23:59:59`)
        }
        break
      default:
        break
    }

    return {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
    }
  }, [customEndDate, customStartDate, dateFilter])

  const loadHistory = useCallback(async () => {
    if (!driverId) return

    setLoading(true)
    setError(null)

    try {
      const { startDate, endDate } = getDateRange()

      let query = supabase
        .from('deliveries')
        .select(
          `
          id,
          delivery_number,
          status,
          delivery_price,
          distance_km,
          delivery_address,
          is_late,
          created_at,
          delivered_at,
          completed_at,
          order:orders(
            order_number,
            vendor:profiles!orders_vendor_id_fkey(store_name),
            buyer:profiles!orders_buyer_id_fkey(first_name, last_name)
          )
        `,
          { count: 'exact' }
        )
        .eq('driver_id', driverId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate)
      }

      const from = (page - 1) * DELIVERIES_PER_PAGE
      const to = from + DELIVERIES_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error: queryError, count } = await query

      if (queryError) throw queryError

      setDeliveries(Array.isArray(data) ? data : [])
      setTotalCount(count || 0)
    } catch (loadError) {
      logger.error('Error loading delivery history:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [driverId, getDateRange, page, statusFilter])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const statusColors = {
    delivered: 'bg-green-100 text-green-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const statusLabels = {
    delivered: t('driver.history.statuses.delivered', 'Delivered'),
    completed: t('driver.history.statuses.delivered', 'Delivered'),
    cancelled: t('driver.history.statuses.cancelled', 'Cancelled'),
  }

  const metrics = useMemo(() => {
    const totalEarnings = deliveries.reduce((sum, delivery) => sum + Number(delivery.delivery_price || 0), 0)
    const deliveredCount = deliveries.filter((delivery) => ['delivered', 'completed'].includes(delivery.status)).length
    const cancelledCount = deliveries.filter((delivery) => delivery.status === 'cancelled').length
    const avgEarnings = deliveries.length > 0 ? totalEarnings / deliveries.length : 0

    return { totalEarnings, deliveredCount, cancelledCount, avgEarnings }
  }, [deliveries])

  const totalPages = Math.max(1, Math.ceil(totalCount / DELIVERIES_PER_PAGE))

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton.Card key={index} />)}
        </div>
        <Skeleton.Table rows={DELIVERIES_PER_PAGE} columns={4} />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        title={t('driver.history.loadFailed', 'Failed to load delivery history')}
        description={t('driver.history.loadFailedDesc', 'We could not load your delivery records. Please try again.')}
        onRetry={loadHistory}
        onGoBack={() => window.history.back()}
        retryLabel={t('common.retry', 'Retry')}
        backLabel={t('common.goBack', 'Go Back')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('driver.history.title', 'Delivery History')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} {t('driver.history.totalDeliveries', 'total deliveries')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t('common.refresh', 'Refresh')}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <FunnelIcon className="h-4 w-4" />
            {t('driver.history.filters', 'Filters')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">{t('driver.history.totalEarnings', 'Total earnings')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(metrics.totalEarnings)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">{t('driver.history.completed', 'Completed')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.deliveredCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">{t('driver.history.cancelled', 'Cancelled')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.cancelledCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">{t('driver.history.average', 'Average per delivery')}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(metrics.avgEarnings)}</p>
        </Card>
      </div>

      {showFilters && (
        <Card className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="input-label">{t('driver.history.dateRange', 'Date Range')}</label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setPage(1)
                }}
                className="input"
              >
                <option value="all">{t('driver.history.dates.all', 'All Time')}</option>
                <option value="today">{t('driver.history.dates.today', 'Today')}</option>
                <option value="week">{t('driver.history.dates.thisWeek', 'This Week')}</option>
                <option value="month">{t('driver.history.dates.thisMonth', 'This Month')}</option>
                <option value="custom">{t('driver.history.dates.custom', 'Custom Range')}</option>
              </select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div>
                  <label className="input-label">{t('driver.history.startDate', 'Start Date')}</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value)
                      setPage(1)
                    }}
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">{t('driver.history.endDate', 'End Date')}</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value)
                      setPage(1)
                    }}
                    className="input"
                  />
                </div>
              </>
            )}

            <div>
              <label className="input-label">{t('driver.history.status', 'Status')}</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="input"
              >
                <option value="all">{t('driver.history.statuses.all', 'All Statuses')}</option>
                <option value="delivered">{t('driver.history.statuses.delivered', 'Delivered')}</option>
                <option value="completed">{t('driver.history.statuses.delivered', 'Delivered')}</option>
                <option value="cancelled">{t('driver.history.statuses.cancelled', 'Cancelled')}</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {deliveries.length === 0 ? (
        <EmptyState
          icon="truck"
          title={t('driver.history.noDeliveries', 'No deliveries yet')}
          description={t('driver.history.noDeliveriesDesc', 'Complete your first delivery to see it here.')}
        />
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <Card key={delivery.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {delivery.delivery_number || `Delivery #${delivery.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {delivery.order?.vendor?.store_name || t('common.vendor', 'Vendor')} → {delivery.order?.buyer?.first_name} {delivery.order?.buyer?.last_name}
                  </p>
                </div>
                <Badge className={statusColors[delivery.status] || 'bg-gray-100 text-gray-700'}>
                  {statusLabels[delivery.status] || delivery.status}
                </Badge>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {delivery.delivery_address && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{delivery.delivery_address}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {new Date(delivery.completed_at || delivery.delivered_at || delivery.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {delivery.delivery_price && (
                  <span className="font-semibold text-green-600">
                    {formatPrice(delivery.delivery_price)}
                  </span>
                )}
                {delivery.distance_km && (
                  <span className="flex items-center gap-1">
                    <TruckIcon className="h-4 w-4" />
                    {Number(delivery.distance_km).toFixed(1)} km
                  </span>
                )}
              </div>

              {delivery.status === 'delivered' && delivery.is_late && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-yellow-700">
                    ⚠️ {t('driver.history.deliveredLate', 'Delivered later than estimated')}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && deliveries.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 p-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-100"
            aria-label={t('driver.history.previousPage', 'Previous page')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <span className="px-4 text-sm text-gray-600">
            {t('driver.history.pageInfo', 'Page {{current}} of {{total}}', {
              current: page,
              total: totalPages,
            })}
          </span>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 p-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-100"
            aria-label={t('driver.history.nextPage', 'Next page')}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}

const DriverHistoryWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverHistory">
    <DriverHistory />
  </ErrorBoundary>
)

export default DriverHistoryWithErrorBoundary
