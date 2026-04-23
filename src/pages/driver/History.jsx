import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner, Badge } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DELIVERIES_PER_PAGE = 10

const DriverHistory = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState('all') // all, today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Status filter state
  const [statusFilter, setStatusFilter] = useState('all') // all, delivered, cancelled

  useEffect(() => {
    loadHistory()
  }, [user, page, dateFilter, statusFilter, customStartDate, customEndDate])

  const getDateRange = useCallback(() => {
    const now = new Date()
    let startDate, endDate

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        endDate = now.toISOString()
        break
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDate = weekAgo.toISOString()
        endDate = now.toISOString()
        break
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        startDate = monthAgo.toISOString()
        endDate = now.toISOString()
        break
      }
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate).toISOString()
          endDate = new Date(customEndDate + 'T23:59:59').toISOString()
        }
        break
      default:
        return { startDate: null, endDate: null }
    }

    return { startDate, endDate }
  }, [dateFilter, customStartDate, customEndDate])

  const loadHistory = async () => {
    if (!user) return

    try {
      setLoading(true)

      const { startDate, endDate } = getDateRange()

      // Build query with filters
      let query = supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(order_number, vendor:profiles!orders_vendor_id_fkey(store_name), buyer:profiles!orders_buyer_id_fkey(first_name, last_name)),
          *,
          count: deliveries.count
        `, { count: 'exact' })
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply date filter
      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate)
      }

      // Apply pagination
      const from = (page - 1) * DELIVERIES_PER_PAGE
      const to = from + DELIVERIES_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      setDeliveries(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      logger.error('Error loading delivery history:', error)
      toast.error(t('driver.history.loadFailed', 'Failed to load delivery history'))
    } finally {
      setLoading(false)
    }
  }

  const statusColors = {
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const statusLabels = {
    delivered: t('driver.history.statuses.delivered', 'Delivered'),
    cancelled: t('driver.history.statuses.cancelled', 'Cancelled'),
  }

  const totalPages = Math.ceil(totalCount / DELIVERIES_PER_PAGE)

  if (loading && deliveries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('driver.history.title', 'Delivery History')}
          </h1>
          <p className="text-gray-500 mt-1">
            {totalCount} {t('driver.history.totalDeliveries', 'total deliveries')}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FunnelIcon className="w-4 h-4" />
          {t('driver.history.filters', 'Filters')}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Filter */}
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

            {/* Custom Date Range */}
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

            {/* Status Filter */}
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
                <option value="cancelled">{t('driver.history.statuses.cancelled', 'Cancelled')}</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <Card className="p-12 text-center">
          <ClockIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('driver.history.noDeliveries', 'No deliveries yet')}
          </h3>
          <p className="text-gray-500">
            {t('driver.history.noDeliveriesDesc', 'Complete your first delivery to see it here.')}
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <Card
                key={delivery.id}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {delivery.delivery_number || `Delivery #${delivery.id.slice(0, 8)}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {delivery.order?.vendor?.store_name || 'Vendor'} → {delivery.order?.buyer?.first_name} {delivery.order?.buyer?.last_name}
                    </p>
                  </div>
                  <Badge className={statusColors[delivery.status] || 'bg-gray-100 text-gray-700'}>
                    {statusLabels[delivery.status] || delivery.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                  {delivery.delivery_address && (
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{delivery.delivery_address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {new Date(delivery.delivered_at || delivery.created_at).toLocaleDateString(undefined, {
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
                      <TruckIcon className="w-4 h-4" />
                      {delivery.distance_km.toFixed(1)} km
                    </span>
                  )}
                </div>

                {delivery.status === 'delivered' && delivery.is_late && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      ⚠️ {t('driver.history.deliveredLate', 'Delivered later than estimated')}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                aria-label={t('driver.history.previousPage', 'Previous page')}
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>

              <span className="text-sm text-gray-600 px-4">
                {t('driver.history.pageInfo', 'Page {{current}} of {{total}}', {
                  current: page,
                  total: totalPages,
                })}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                aria-label={t('driver.history.nextPage', 'Next page')}
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
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
