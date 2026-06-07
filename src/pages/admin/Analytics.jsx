import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, Input, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'

const RANGE_OPTIONS = [
  { id: '7d', label: 'آخر 7 أيام', days: 7 },
  { id: '30d', label: 'آخر 30 يومًا', days: 30 },
  { id: '90d', label: 'آخر 90 يومًا', days: 90 },
  { id: 'custom', label: 'نطاق مخصص', days: null },
]

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#6b7280']

const formatDateKey = (date) => date.toISOString().slice(0, 10)

const AdminAnalyticsPage = () => {
  const { t } = useTranslation()
  const authLoading = useAuthStore((s) => s.loading)
  const authProfile = useAuthStore((s) => s.profile)

  const [loading, setLoading] = useState(true)
  const [rangeId, setRangeId] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [ordersOverTime, setOrdersOverTime] = useState([])
  const [revenueOverTime, setRevenueOverTime] = useState([])
  const [ordersByStatus, setOrdersByStatus] = useState([])
  const [topVendorsByRevenue, setTopVendorsByRevenue] = useState([])
  const [topBuyersByOrders, setTopBuyersByOrders] = useState([])
  const [driverPerformance, setDriverPerformance] = useState([])

  const isAdmin = authProfile?.role === 'admin'

  const rangeDates = useMemo(() => {
    const now = new Date()

    if (rangeId === 'custom' && customStart && customEnd) {
      const start = new Date(customStart)
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    const selected = RANGE_OPTIONS.find((item) => item.id === rangeId) || RANGE_OPTIONS[1]
    const end = now
    const start = new Date(now)
    start.setDate(start.getDate() - (selected.days || 30))
    return { start, end }
  }, [rangeId, customStart, customEnd])

  const loadAnalytics = async () => {
    if (!isAdmin) return

    if (rangeId === 'custom' && (!customStart || !customEnd)) {
      toast.error(t('admin.analytics.customRangeRequired', 'يرجى اختيار تاريخ البداية والنهاية'))
      return
    }

    setLoading(true)

    try {
      const startIso = rangeDates.start.toISOString()
      const endIso = rangeDates.end.toISOString()

      // Orders dataset used for time-series, status pie, vendors and buyers aggregations.
      const { data: ordersRows, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, created_at, buyer_id, vendor_id, total', { count: 'exact' })
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      if (ordersError) throw ordersError

      // Driver performance source.
      const { data: deliveriesRows, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('id, driver_id, status, created_at, accepted_at, completed_at', { count: 'exact' })
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      if (deliveriesError) {
        logger.warn('Deliveries table query failed for analytics:', deliveriesError)
      }

      const orders = ordersRows || []
      const deliveries = deliveriesRows || []

      const days = []
      const dayCursor = new Date(rangeDates.start)
      while (dayCursor <= rangeDates.end) {
        days.push(formatDateKey(dayCursor))
        dayCursor.setDate(dayCursor.getDate() + 1)
      }

      const countByDay = new Map(days.map((key) => [key, 0]))
      const revenueByDay = new Map(days.map((key) => [key, 0]))
      const statusMap = new Map()
      const vendorRevenueMap = new Map()
      const buyerOrdersMap = new Map()

      orders.forEach((order) => {
        const dayKey = formatDateKey(new Date(order.created_at))
        const revenue = Number(order.total_amount ?? order.total ?? 0) || 0

        countByDay.set(dayKey, (countByDay.get(dayKey) || 0) + 1)
        revenueByDay.set(dayKey, (revenueByDay.get(dayKey) || 0) + revenue)

        const status = order.status || 'unknown'
        statusMap.set(status, (statusMap.get(status) || 0) + 1)

        if (order.vendor_id) {
          vendorRevenueMap.set(order.vendor_id, (vendorRevenueMap.get(order.vendor_id) || 0) + revenue)
        }

        if (order.buyer_id) {
          buyerOrdersMap.set(order.buyer_id, (buyerOrdersMap.get(order.buyer_id) || 0) + 1)
        }
      })

      setOrdersOverTime(days.map((day) => ({ date: day, value: countByDay.get(day) || 0 })))
      setRevenueOverTime(days.map((day) => ({ date: day, value: revenueByDay.get(day) || 0 })))
      setOrdersByStatus(Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })))

      const vendorIds = Array.from(vendorRevenueMap.keys())
      const buyerIds = Array.from(buyerOrdersMap.keys())

      let vendorProfiles = []
      let buyerProfiles = []

      if (vendorIds.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, store_name, first_name, last_name')
          .in('id', vendorIds)
        vendorProfiles = data || []
      }

      if (buyerIds.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', buyerIds)
        buyerProfiles = data || []
      }

      const vendorNameById = new Map(vendorProfiles.map((item) => [
        item.id,
        item.store_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.id,
      ]))

      const buyerNameById = new Map(buyerProfiles.map((item) => [
        item.id,
        `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email || item.id,
      ]))

      const topVendors = Array.from(vendorRevenueMap.entries())
        .map(([vendorId, revenue]) => ({
          vendorId,
          vendor: vendorNameById.get(vendorId) || vendorId,
          revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      const topBuyers = Array.from(buyerOrdersMap.entries())
        .map(([buyerId, ordersCount]) => ({
          buyerId,
          buyer: buyerNameById.get(buyerId) || buyerId,
          ordersCount,
        }))
        .sort((a, b) => b.ordersCount - a.ordersCount)
        .slice(0, 5)

      setTopVendorsByRevenue(topVendors)
      setTopBuyersByOrders(topBuyers)

      const driverMap = new Map()

      deliveries
        .filter((delivery) => delivery.driver_id)
        .forEach((delivery) => {
          const row = driverMap.get(delivery.driver_id) || {
            driverId: delivery.driver_id,
            completed: 0,
            totalMinutes: 0,
            timedRuns: 0,
          }

          if (delivery.status === 'delivered' || delivery.status === 'completed') {
            row.completed += 1

            const startedAt = delivery.accepted_at || delivery.created_at
            const finishedAt = delivery.completed_at
            if (startedAt && finishedAt) {
              const minutes = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60)
              if (minutes > 0) {
                row.totalMinutes += minutes
                row.timedRuns += 1
              }
            }
          }

          driverMap.set(delivery.driver_id, row)
        })

      const driverIds = Array.from(driverMap.keys())
      let driverProfiles = []
      if (driverIds.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', driverIds)
        driverProfiles = data || []
      }

      const driverNameById = new Map(driverProfiles.map((item) => [
        item.id,
        `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.id,
      ]))

      const driverRows = Array.from(driverMap.values())
        .map((row) => ({
          driverId: row.driverId,
          driver: driverNameById.get(row.driverId) || row.driverId,
          completed: row.completed,
          avgTimeMinutes: row.timedRuns ? Math.round(row.totalMinutes / row.timedRuns) : 0,
        }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 8)

      setDriverPerformance(driverRows)
    } catch (error) {
      logger.error('Admin analytics load failed:', error)
      toast.error(t('admin.analytics.loadFailed', 'تعذر تحميل بيانات التحليلات'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadAnalytics()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, rangeId])

  const applyCustomRange = () => {
    if (!customStart || !customEnd) {
      toast.error(t('admin.analytics.customRangeRequired', 'يرجى اختيار تاريخ البداية والنهاية'))
      return
    }
    loadAnalytics()
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4" dir="rtl">
        <h2 className="text-lg font-semibold text-red-800 mb-1">
          {t('admin.analytics.forbiddenTitle', 'غير مصرح بالوصول')}
        </h2>
        <p className="text-sm text-red-700">
          {t('admin.analytics.forbiddenMessage', 'هذه الصفحة مخصصة للمشرفين فقط.')}
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" data-cy="admin-analytics-page">
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.analytics.title', 'لوحة التحليلات')}</h1>
          <p className="text-sm text-gray-600 mt-1">{t('admin.analytics.subtitle', 'مؤشرات الطلبات، الإيرادات، والأداء')}</p>
        </div>

        <div className="flex flex-wrap gap-2" data-cy="admin-analytics-range-selector">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={rangeId === option.id ? 'primary' : 'outline'}
              onClick={() => setRangeId(option.id)}
              data-cy={`admin-analytics-range-${option.id}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {rangeId === 'custom' && (
        <div className="grid gap-3 md:grid-cols-3 mb-4" data-cy="admin-analytics-custom-range">
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-cy="admin-analytics-custom-start" />
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-cy="admin-analytics-custom-end" />
          <Button type="button" variant="primary" onClick={applyCustomRange} data-cy="admin-analytics-custom-apply">
            {t('admin.analytics.applyRange', 'تطبيق النطاق')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-14">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="orders-over-time-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.ordersOverTime', 'الطلبات عبر الزمن')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ordersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name={t('admin.analytics.orders', 'الطلبات')} stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="revenue-over-time-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.revenueOverTime', 'الإيراد عبر الزمن')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPrice(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="value" name={t('admin.analytics.revenue', 'الإيراد')} stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="orders-by-status-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.ordersByStatus', 'الطلبات حسب الحالة')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={95} label>
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="top-vendors-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.topVendors', 'أفضل 5 باعة حسب الإيراد')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendorsByRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vendor" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPrice(value)} />
                  <Legend />
                  <Bar dataKey="revenue" name={t('admin.analytics.revenue', 'الإيراد')} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="top-buyers-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.topBuyers', 'أفضل 5 مشترين حسب عدد الطلبات')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBuyersByOrders}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="buyer" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ordersCount" name={t('admin.analytics.orders', 'الطلبات')} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-cy="driver-performance-chart">
            <h3 className="font-semibold text-gray-900 mb-3">{t('admin.analytics.driverPerformance', 'مؤشرات أداء السائقين')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="driver" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name={t('admin.analytics.deliveriesCompleted', 'التسليمات المكتملة')} fill="#22c55e" />
                  <Bar dataKey="avgTimeMinutes" name={t('admin.analytics.avgTime', 'متوسط الوقت بالدقائق')} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default AdminAnalyticsPage
