import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, StateSkeleton as Skeleton } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  StarIcon,
  TruckIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { logger } from '@/utils/logger'

const StatCard = ({ icon: Icon, iconBg, iconColor, value, label, sub, trend }) => (
  <Card className="p-5">
    <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {trend >= 0
          ? <ArrowTrendingUpIcon className="w-3 h-3" />
          : <ArrowTrendingDownIcon className="w-3 h-3" />}
        {Math.abs(trend)}% {trend >= 0 ? 'up' : 'down'} vs last month
      </div>
    )}
  </Card>
)

const DriverPerformance = () => {
  const { t } = useTranslation()
  const { profile, user } = useAuthStore()
  const driverId = profile?.id || user?.id

  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])

  const load = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, status, is_late, delivery_price, distance_km, created_at, delivered_at, completed_at, driver_rating')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setDeliveries(Array.isArray(data) ? data : [])
    } catch (err) {
      logger.error('Performance load error:', err)
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const completed = deliveries.filter(d => ['delivered', 'completed'].includes(d.status))
  const cancelled = deliveries.filter(d => d.status === 'cancelled')
  const total = deliveries.length
  const onTime = completed.filter(d => !d.is_late)

  const acceptanceRate = total > 0 ? Math.round(((total - cancelled.length) / total) * 100) : null
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : null
  const onTimeRate = completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : null
  const avgRating = completed.filter(d => d.driver_rating).length > 0
    ? (completed.filter(d => d.driver_rating).reduce((s, d) => s + Number(d.driver_rating), 0) / completed.filter(d => d.driver_rating).length).toFixed(1)
    : null

  const thisMonthCompleted = completed.filter(d => new Date(d.delivered_at || d.completed_at) >= startOfMonth)
  const lastMonthCompleted = completed.filter(d => {
    const dt = new Date(d.delivered_at || d.completed_at)
    return dt >= startOfLastMonth && dt <= endOfLastMonth
  })
  const deliveryTrend = lastMonthCompleted.length > 0
    ? Math.round(((thisMonthCompleted.length - lastMonthCompleted.length) / lastMonthCompleted.length) * 100)
    : null

  // Weekly chart: last 8 weeks
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (7 * (7 - i)))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59)
    const weekDeliveries = completed.filter(d => {
      const dt = new Date(d.delivered_at || d.completed_at)
      return dt >= weekStart && dt <= weekEnd
    })
    return {
      week: `W${i + 1}`,
      deliveries: weekDeliveries.length,
      earnings: weekDeliveries.reduce((s, d) => s + Number(d.delivery_price || 0), 0),
    }
  })

  // Rating distribution
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: completed.filter(d => Math.round(d.driver_rating) === star).length,
  }))
  const maxRatingCount = Math.max(...ratingCounts.map(r => r.count), 1)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)}
        </div>
        <Skeleton.Table rows={5} columns={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('driver.performance.title', 'Performance')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('driver.performance.subtitle', 'Your delivery statistics and metrics')}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircleIcon}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          value={acceptanceRate !== null ? `${acceptanceRate}%` : '—'}
          label={t('driver.performance.acceptanceRate', 'Acceptance Rate')}
          sub={`${total} ${t('driver.performance.totalAssigned', 'total assigned')}`}
        />
        <StatCard
          icon={TruckIcon}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          value={completionRate !== null ? `${completionRate}%` : '—'}
          label={t('driver.performance.completionRate', 'Completion Rate')}
          sub={`${completed.length} ${t('driver.performance.completed', 'completed')}`}
          trend={deliveryTrend}
        />
        <StatCard
          icon={ClockIcon}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={onTimeRate !== null ? `${onTimeRate}%` : '—'}
          label={t('driver.performance.onTimeRate', 'On-Time Rate')}
          sub={`${onTime.length} / ${completed.length} ${t('driver.performance.onTime', 'on time')}`}
        />
        <StatCard
          icon={StarIcon}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-500"
          value={avgRating !== null ? `${avgRating} / 5` : '—'}
          label={t('driver.performance.avgRating', 'Avg. Customer Rating')}
          sub={profile?.driver_rating ? `${t('driver.performance.profileRating', 'Profile rating')}: ${Number(profile.driver_rating).toFixed(1)}` : undefined}
        />
      </div>

      {/* Cancellation card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
            <XCircleIcon className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{cancelled.length}</p>
          <p className="text-sm text-gray-500">{t('driver.performance.cancellations', 'Cancellations')}</p>
        </Card>
        <Card className="p-5">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
            <BoltIcon className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{completed.filter(d => d.is_late).length}</p>
          <p className="text-sm text-gray-500">{t('driver.performance.lateDeliveries', 'Late Deliveries')}</p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <TruckIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatPrice(completed.reduce((s, d) => s + Number(d.delivery_price || 0), 0))}
          </p>
          <p className="text-sm text-gray-500">{t('driver.performance.totalEarnings', 'Total Earnings')}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t('driver.performance.thisMonth', 'This month')}: {formatPrice(thisMonthCompleted.reduce((s, d) => s + Number(d.delivery_price || 0), 0))}
          </p>
        </Card>
      </div>

      {/* Weekly Deliveries Chart */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-5">{t('driver.performance.weeklyTrend', 'Weekly Deliveries (last 8 weeks)')}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, t('driver.performance.deliveries', 'Deliveries')]} />
            <Area type="monotone" dataKey="deliveries" stroke="#16a34a" strokeWidth={2} fill="url(#delivGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Rating Distribution */}
      {ratingCounts.some(r => r.count > 0) && (
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('driver.performance.ratingDistribution', 'Customer Rating Distribution')}</h2>
          <div className="space-y-2">
            {ratingCounts.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-12 flex-shrink-0">{star} ⭐</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-amber-400 h-3 rounded-full transition-all"
                    style={{ width: `${(count / maxRatingCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Deliveries */}
      {completed.length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('driver.performance.recentDeliveries', 'Recent Completed Deliveries')}</h2>
          <div className="space-y-3">
            {completed.slice(0, 8).map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">#{d.id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(d.delivered_at || d.completed_at || d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.is_late ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {d.is_late ? t('driver.performance.late', 'Late') : t('driver.performance.onTimeLabel', 'On Time')}
                  </span>
                  {d.delivery_price && (
                    <span className="text-sm font-semibold text-green-600">{formatPrice(d.delivery_price)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

const DriverPerformanceWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverPerformance">
    <DriverPerformance />
  </ErrorBoundary>
)

export default DriverPerformanceWithErrorBoundary
