import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { realtimeService } from '@/services/realtime'
import { ordersApi } from '@/services/deliveries'
import ErrorBoundary from '@/components/ErrorBoundary'
import CommissionDashboard from '@/components/vendor/CommissionDashboard'
import StoreEvolutionNotification from '@/components/vendor/StoreEvolutionNotification'
import PartnershipRequests from '@/components/shared/PartnershipRequests'
import {
  Card,
  LoadingSpinner,
  VendorAlerts,
  VendorGuidelines,
  StarRating,
  Modal,
} from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ClockIcon,
  CubeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserIcon,
  EyeIcon,
  TruckIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  SparklesIcon,
  CalendarIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { ChartSkeleton } from '@/components/ui'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

// Lazy load chart components for better initial load performance
const Line = lazy(() =>
  import('react-chartjs-2').then(async (mod) => {
    const {
      Chart: ChartJS,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
      Filler,
    } = await import('chart.js')
    ChartJS.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
      Filler
    )
    return { default: mod.Line }
  })
)

const VendorLocationSetup = React.lazy(() => import('./LocationSetup'))

// ============================================================
// STATUS CONFIG
// ============================================================
const STATUS_CONFIG = {
  pending: {
    label: 'vendor.orders.statuses.pending',
    labelDefault: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    icon: ClockIcon,
  },
  vendor_accepted: {
    label: 'vendor.orders.statuses.confirmed',
    labelDefault: 'Confirmed',
    color: 'bg-blue-100 text-blue-800 border border-blue-200',
    icon: CheckIcon,
  },
  vendor_rejected: {
    label: 'vendor.orders.statuses.cancelled',
    labelDefault: 'Rejected',
    color: 'bg-red-100 text-red-800 border border-red-200',
    icon: XMarkIcon,
  },
  driver_assigned: {
    label: 'vendor.orders.statuses.processing',
    labelDefault: 'Processing',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    icon: TruckIcon,
  },
  on_the_way: {
    label: 'vendor.orders.statuses.shipped',
    labelDefault: 'Shipped',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    icon: TruckIcon,
  },
  delivered: {
    label: 'vendor.orders.statuses.delivered',
    labelDefault: 'Delivered',
    color: 'bg-green-100 text-green-800 border border-green-200',
    icon: CheckIcon,
  },
  cancelled: {
    label: 'vendor.orders.statuses.cancelled',
    labelDefault: 'Cancelled',
    color: 'bg-red-100 text-red-800 border border-red-200',
    icon: XMarkIcon,
  },
}

// ============================================================
// HELPER: Days ago label
// ============================================================
const getDayLabel = (dateStr) => {
  const date = new Date(dateStr)
  const today = new Date()
  const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

// ============================================================
// MAIN COMPONENT
// ============================================================
const VendorDashboard = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  // Core state
  const [loading, setLoading] = useState(true)
  const [needsLocation, setNeedsLocation] = useState(false)

  // Stats state
  const [stats, setStats] = useState({
    dailySales: 0,
    dailySalesPrev: 0,
    newOrders: 0,
    newOrdersPrev: 0,
    monthlyRevenue: 0,
    monthlyRevenuePrev: 0,
    storeRating: 0,
    totalReviews: 0,
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  })

  // Data state
  const [pendingOrders, setPendingOrders] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [outOfStockProducts, setOutOfStockProducts] = useState([])
  const [salesChartData, setSalesChartData] = useState({ labels: [], datasets: [] })

  // Action state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectOtherReason, setRejectOtherReason] = useState('')
  const [processingAction, setProcessingAction] = useState(null)

  // Notification state
  const [newOrderNotification, setNewOrderNotification] = useState(null)

  // Refs
  const realtimeSubRef = useRef(null)
  const loadDashboardDataRef = useRef(null)

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================
  const loadDashboardData = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

      // ---- 1. Products count ----
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('vendor_id', profile.id)
        .range(0, 0)

      // ---- 2. Low stock products (< threshold units, default 10) ----
      const lowStockThreshold = profile?.low_stock_threshold || 10
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name, available_quantity')
        .eq('vendor_id', profile.id)
        .eq('is_available', true)
        .lte('available_quantity', lowStockThreshold)
        .gt('available_quantity', 0)
        .order('available_quantity', { ascending: true })
        .limit(10)

      setLowStockProducts(lowStock || [])

      // ---- 3. Out of stock products ----
      const { data: outOfStock } = await supabase
        .from('products')
        .select('id, name, available_quantity')
        .eq('vendor_id', profile.id)
        .eq('is_available', true)
        .eq('available_quantity', 0)
        .order('name', { ascending: true })
        .limit(10)

      setOutOfStockProducts(outOfStock || [])

      // ---- 4. Daily sales (today) ----
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('vendor_id', profile.id)
        .gte('created_at', todayStart)

      const dailySales = (todayOrders || [])
        .filter((o) => o.status !== 'vendor_rejected' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      // ---- 5. Daily sales (yesterday) ----
      const { data: yesterdayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('vendor_id', profile.id)
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart)

      const dailySalesPrev = (yesterdayOrders || [])
        .filter((o) => o.status !== 'vendor_rejected' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      // ---- 6. New (pending) orders ----
      const { data: pendingData } = await supabase
        .from('orders')
        .select('id, status')
        .eq('vendor_id', profile.id)
        .eq('status', 'pending')

      const newOrders = pendingData?.length || 0

      // Previous day pending
      const { data: prevPending } = await supabase
        .from('orders')
        .select('id')
        .eq('vendor_id', profile.id)
        .eq('status', 'pending')
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart)

      const newOrdersPrev = prevPending?.length || 0

      // ---- 7. Monthly revenue ----
      const { data: monthOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('vendor_id', profile.id)
        .gte('created_at', monthStart)

      const monthlyRevenue = (monthOrders || [])
        .filter((o) => o.status === 'delivered' || o.status === 'vendor_accepted' || o.status === 'on_the_way')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      // Previous month revenue
      const { data: prevMonthOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('vendor_id', profile.id)
        .gte('created_at', prevMonthStart)
        .lte('created_at', prevMonthEnd)

      const monthlyRevenuePrev = (prevMonthOrders || [])
        .filter((o) => o.status === 'delivered' || o.status === 'vendor_accepted' || o.status === 'on_the_way')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      // ---- 8. Store rating ----
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('vendor_id', profile.id)
        .eq('is_flagged', false)
        .is('deleted_at', null)

      const totalReviews = reviews?.length || 0
      const storeRating = totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0

      // ---- 9. Pending orders (for quick actions) ----
      const { data: pendingOrdersData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          created_at,
          shipping_address,
          shipping_city,
          buyer_notes,
          buyer:profiles!orders_buyer_id_fkey(first_name, last_name, phone),
          items:order_items(
            id,
            quantity,
            unit_price,
            product:products(id, name)
          )
        `)
        .eq('vendor_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

      setPendingOrders(pendingOrdersData || [])

      // ---- 10. Recent orders (for table) ----
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          status,
          created_at,
          buyer:profiles!orders_buyer_id_fkey(first_name, last_name)
        `)
        .eq('vendor_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setRecentOrders(recentOrdersData || [])

      // ---- 11. 7-day sales chart data ----
      const { data: weekOrders } = await supabase
        .from('orders')
        .select('total, status, created_at')
        .eq('vendor_id', profile.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: true })

      // Build daily buckets
      const dailyTotals = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = d.toISOString().split('T')[0]
        dailyTotals[key] = 0
      }

      (weekOrders || []).forEach((order) => {
        if (order.status !== 'vendor_rejected' && order.status !== 'cancelled') {
          const key = order.created_at.split('T')[0]
          if (dailyTotals[key] !== undefined) {
            dailyTotals[key] += order.total || 0
          }
        }
      })

      const chartLabels = Object.keys(dailyTotals).map((key) => {
        const d = new Date(key)
        return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
          weekday: 'short',
        })
      })
      const chartValues = Object.values(dailyTotals)

      setSalesChartData({
        labels: chartLabels,
        datasets: [
          {
            label: 'Daily Sales (MAD)',
            data: chartValues,
            borderColor: '#16a34a',
            backgroundColor: (context) => {
              // SECURITY: Check if ctx exists to prevent crash
              const ctx = context.chart?.ctx
              if (!ctx) return 'rgba(22, 163, 74, 0.1)' // Fallback solid color

              const gradient = ctx.createLinearGradient(0, 0, 0, 250)
              gradient.addColorStop(0, 'rgba(22, 163, 74, 0.15)')
              gradient.addColorStop(1, 'rgba(22, 163, 74, 0)')
              return gradient
            },
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#16a34a',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#16a34a',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3,
          },
        ],
      })

      // ---- Update stats ----
      setStats({
        dailySales,
        dailySalesPrev,
        newOrders,
        newOrdersPrev,
        monthlyRevenue,
        monthlyRevenuePrev,
        storeRating,
        totalReviews,
        totalProducts: productCount || 0,
        lowStockCount: lowStock?.length || 0,
        outOfStockCount: outOfStock?.length || 0,
      })
    } catch (error) {
      logger.error('Error loading dashboard data:', error)
      toast.error(t('vendor.dashboard.errors.loadFailed', 'Failed to load dashboard data'))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, t, i18n.language])

  // Keep ref up-to-date so realtime callbacks always call the latest version
  useEffect(() => {
    loadDashboardDataRef.current = loadDashboardData
  }, [loadDashboardData])

  // ============================================================
  // INITIAL LOAD
  // ============================================================
  useEffect(() => {
    if (profile?.id) {
      if (!profile.latitude || !profile.longitude) {
        setNeedsLocation(true)
      }
      loadDashboardData()
      realtimeService.initialize()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (profile?.id && profile?.driver_search_done === false) {
      navigate('/vendor/driver-preferences')
    }
  }, [navigate, profile?.driver_search_done, profile?.id])

  // ============================================================
  // UPDATE CHART LABELS ON LANGUAGE CHANGE
  // ============================================================
  useEffect(() => {
    if (salesChartData.labels.length > 0) {
      // Regenerate labels with new language
      const now = new Date()
      const newLabels = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        newLabels.push(d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
          weekday: 'short',
        }))
      }
      setSalesChartData(prev => ({
        ...prev,
        labels: newLabels,
      }))
    }
  }, [i18n.language])
  // (salesChartData.labels is derived from i18n.language and need not re-run on labels change)

  // ============================================================
  // REALTIME: New order notifications
  // ============================================================
  useEffect(() => {
    if (!profile?.id) return

    realtimeSubRef.current = realtimeService.subscribeToVendorOrders(
      profile.id,
      async (payload) => {
        logger.info('Realtime order update:', payload)

        // Show notification for new pending orders
        if (payload.eventType === 'INSERT' || payload.new?.status === 'pending') {
          setNewOrderNotification({
            id: payload.new?.id,
            orderNumber: payload.new?.order_number,
            total: payload.new?.total,
            time: new Date().toISOString(),
          })
          toast.success(t('vendor.dashboard.notifications.newOrder', 'New order received!'), {
            icon: '🛒',
            duration: 5000,
          })
        }

        // Reload dashboard using ref to avoid stale closure
        await loadDashboardDataRef.current()
      }
    )

    return () => {
      if (realtimeSubRef.current) {
        // Handle both function and object with unsubscribe method
        if (typeof realtimeSubRef.current === 'function') {
          realtimeSubRef.current()
        } else if (typeof realtimeSubRef.current.unsubscribe === 'function') {
          realtimeSubRef.current.unsubscribe()
        }
        realtimeSubRef.current = null
      }
    }
  }, [profile?.id, t]) // ✅ Removed loadDashboardData from dependencies to prevent memory leaks

  // ============================================================
  // QUICK ORDER ACTIONS
  // ============================================================
  const handleAcceptOrder = async (orderId) => {
    setProcessingAction(orderId)
    try {
      await ordersApi.acceptOrder(orderId)
      toast.success(t('vendor.dashboard.notifications.orderAccepted', 'Order accepted successfully!'))

      // Remove from pending list
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))

      // Reload stats
      await loadDashboardData()
    } catch (error) {
      logger.error('Error accepting order:', error)
      toast.error(t('vendor.dashboard.errors.acceptFailed', 'Failed to accept order'))
    } finally {
      setProcessingAction(null)
    }
  }

  const handleRejectClick = (orderId) => {
    setSelectedOrderId(orderId)
    setRejectReason('')
    setRejectOtherReason('')
    setRejectModalOpen(true)
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason) {
      toast.error(t('vendor.dashboard.errors.selectReason', 'Please select a reason'))
      return
    }
    if (rejectReason === 'other' && !rejectOtherReason.trim()) {
      toast.error(t('vendor.dashboard.errors.enterReason', 'Please enter a reason'))
      return
    }

    const reason = rejectReason === 'other' ? rejectOtherReason : rejectReason
    setProcessingAction(selectedOrderId)

    try {
      await ordersApi.rejectOrder(selectedOrderId, reason)
      toast.success(t('vendor.dashboard.notifications.orderRejected', 'Order rejected'))

      // Remove from pending list
      setPendingOrders((prev) => prev.filter((o) => o.id !== selectedOrderId))

      // Reload stats
      await loadDashboardData()
      setRejectModalOpen(false)
    } catch (error) {
      logger.error('Error rejecting order:', error)
      toast.error(t('vendor.dashboard.errors.rejectFailed', 'Failed to reject order'))
    } finally {
      setProcessingAction(null)
    }
  }

  // ============================================================
  // COMPUTED: Trend direction
  // ============================================================
  const getTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? { direction: 'up', percent: 100 } : { direction: 'flat', percent: 0 }
    const percent = Math.round(((current - previous) / previous) * 100)
    return {
      direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
      percent: Math.abs(percent),
    }
  }

  // ============================================================
  // TIME REMAINING (1 hour max to respond)
  // ============================================================
  const getTimeRemaining = (createdAt) => {
    const created = new Date(createdAt)
    const deadline = new Date(created.getTime() + 60 * 60 * 1000) // 1 hour
    const now = new Date()
    const remaining = deadline - now

    if (remaining <= 0) return { expired: true, text: 'Expired' }

    const minutes = Math.floor(remaining / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return { expired: false, text: `${hours}h ${mins}m`, urgent: minutes < 30 }
    }
    return { expired: false, text: `${mins}m`, urgent: minutes < 15 }
  }

  // ============================================================
  // CHART OPTIONS
  // ============================================================
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => `${formatPrice(context.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.04)', drawBorder: false },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (value) => formatPrice(value, { showSymbol: false }),
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 11 } },
      },
    },
  }

  // ============================================================
  // CONDITIONAL RENDERS
  // ============================================================
  if (needsLocation) {
    return (
      <React.Suspense fallback={<LoadingSpinner size="lg" />}>
        <VendorLocationSetup onComplete={() => setNeedsLocation(false)} />
      </React.Suspense>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================================
  // STAT CARDS DATA
  // ============================================================
  const dailyTrend = getTrend(stats.dailySales, stats.dailySalesPrev)
  const ordersTrend = getTrend(stats.newOrders, stats.newOrdersPrev)
  const revenueTrend = getTrend(stats.monthlyRevenue, stats.monthlyRevenuePrev)

  const statCards = [
    {
      title: t('vendor.dashboard.stats.dailySales', 'Today\'s Sales'),
      value: formatPrice(stats.dailySales),
      icon: CurrencyDollarIcon,
      bgLight: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: dailyTrend,
      trendLabel: t('vendor.dashboard.stats.vsYesterday', 'vs yesterday'),
    },
    {
      title: t('vendor.dashboard.stats.newOrders', 'New Orders'),
      value: stats.newOrders.toString(),
      icon: ShoppingBagIcon,
      bgLight: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: ordersTrend,
      trendLabel: t('vendor.dashboard.stats.vsYesterday', 'vs yesterday'),
      badge: stats.newOrders > 0 ? stats.newOrders : null,
    },
    {
      title: t('vendor.dashboard.stats.monthlyRevenue', 'Monthly Revenue'),
      value: formatPrice(stats.monthlyRevenue),
      icon: CalendarIcon,
      bgLight: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: revenueTrend,
      trendLabel: t('vendor.dashboard.stats.vsLastMonth', 'vs last month'),
    },
    {
      title: t('vendor.dashboard.stats.storeRating', 'Store Rating'),
      value: stats.storeRating.toFixed(1),
      icon: StarSolid,
      bgLight: 'bg-yellow-50',
      iconColor: 'text-yellow-500',
      isRating: true,
      ratingCount: stats.totalReviews,
    },
  ]

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      {profile?.store_paused && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">المتجر في وضع الطوارئ</p>
              <p className="text-sm text-red-700 mt-1">
                المنتجات النشطة مخفية حاليًا من السوق حتى إلغاء وضع الطوارئ من صفحة الإعدادات.
              </p>
              {profile?.store_paused_reason && (
                <p className="text-xs text-red-700 mt-2">السبب: {profile.store_paused_reason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Order Notification Banner */}
      {newOrderNotification && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <BellIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-900 text-sm">
                {t('vendor.dashboard.notifications.newOrderBanner', 'New Order Received!')}
              </p>
              <p className="text-xs text-green-700">
                {newOrderNotification.orderNumber || newOrderNotification.id?.slice(0, 8)}
                {' — '}
                {formatPrice(newOrderNotification.total)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewOrderNotification(null)}
            className="p-1.5 hover:bg-green-100 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}

      {/* Vendor Alerts */}
      <div className="mb-6">
        <VendorAlerts />
      </div>

      {/* Vendor Guidelines */}
      <div className="mb-6">
        <VendorGuidelines
          alreadyAccepted={profile?.vendor_guidelines_accepted}
          onAccept={async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ vendor_guidelines_accepted: true })
                .eq('id', profile.id)
              if (error) throw error
              toast.success(t('vendor.dashboard.notifications.guidelinesAccepted', 'Vendor guidelines accepted'))
            } catch (error) {
              logger.error('Error accepting guidelines:', error)
              toast.error(t('common.error', 'An error occurred'))
            }
          }}
        />
      </div>

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('vendor.dashboard.welcome', 'Welcome back, {{name}}!', {
                name: profile?.first_name || profile?.store_name,
              })}
              <span className="ml-1">👋</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('vendor.dashboard.subtitle', 'Here\'s what\'s happening with your store.')}
            </p>
          </div>
          {profile?.store_name && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
              <SparklesIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">{profile.store_name}</span>
            </div>
          )}
        </div>
      </div>

      <StoreEvolutionNotification vendorId={profile?.id} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/vendor/driver-preferences')}
          className="rounded-2xl border border-gray-200 bg-white p-5 text-right hover:border-green-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">إعداد السائق المفضل</p>
              <p className="text-xs text-gray-500">حدد هل تريد سائقاً ثابتاً لمتجرك.</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">حدّث خيارك الحالي أو غيّره قبل إنشاء طلبات شراكة جديدة.</p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/vendor/find-driver')}
          className="rounded-2xl border border-gray-200 bg-white p-5 text-right hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">البحث عن سائق</p>
              <p className="text-xs text-gray-500">استعرض السائقين وأرسل طلب شراكة مباشر.</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">يمكنك مراجعة الطلبات الواردة والصادرة من نفس القسم بالأسفل.</p>
        </button>
      </div>

      <PartnershipRequests currentUserId={profile?.id} currentRole="vendor" className="mb-6" />

      <CommissionDashboard vendorId={profile?.id} />

      {/* ============================================================
          SECTION 1: STATISTICS CARDS
          ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6 sm:mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 ${stat.bgLight} rounded-xl flex items-center justify-center`}>
                {stat.isRating ? (
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                ) : (
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                )}
              </div>
              {stat.badge && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                  {stat.badge}
                </span>
              )}
            </div>

            {/* Value */}
            {stat.isRating ? (
              <div className="mb-1">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  <StarRating rating={parseFloat(stat.value)} maxRating={5} size="sm" />
                  <span className="text-xs text-gray-400 ml-1">({stat.ratingCount})</span>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
            )}

            {/* Title */}
            <p className="text-sm text-gray-500 mb-2">{stat.title}</p>

            {/* Trend Arrow */}
            {stat.trend && (
              <div className="flex items-center gap-1">
                {stat.trend.direction === 'up' ? (
                  <ArrowUpIcon className="w-3.5 h-3.5 text-green-500" />
                ) : stat.trend.direction === 'down' ? (
                  <ArrowDownIcon className="w-3.5 h-3.5 text-red-500" />
                ) : null}
                <span
                  className={`text-xs font-medium ${
                    stat.trend.direction === 'up'
                      ? 'text-green-600'
                      : stat.trend.direction === 'down'
                      ? 'text-red-600'
                      : 'text-gray-400'
                  }`}
                >
                  {stat.trend.direction === 'up' ? '+' : stat.trend.direction === 'down' ? '-' : ''}
                  {stat.trend.percent}% {stat.trendLabel}
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ============================================================
          SECTION 2: STOCK ALERTS
          ============================================================ */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* Out of Stock */}
            {outOfStockProducts.length > 0 && (
              <Card className="p-4 sm:p-5 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {t('vendor.dashboard.stockAlerts.outOfStock', 'Out of Stock')} ({outOfStockProducts.length})
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {outOfStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-2.5 bg-red-50 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <CubeIcon className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-red-600 font-medium">
                          {t('vendor.dashboard.stockAlerts.zeroStock', '0 units available')}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/vendor/products`)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 min-h-[36px]"
                      >
                        {t('vendor.dashboard.stockAlerts.restock', 'Restock')}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Low Stock */}
            {lowStockProducts.length > 0 && (
              <Card className="p-4 sm:p-5 border-l-4 border-l-yellow-500">
                <div className="flex items-center gap-2 mb-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {t('vendor.dashboard.stockAlerts.lowStock', 'Low Stock')} ({lowStockProducts.length})
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-2.5 bg-yellow-50 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <CubeIcon className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-yellow-700 font-medium">
                          {product.available_quantity} {t('vendor.dashboard.stockAlerts.unitsLeft', 'units left')}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/vendor/products`)}
                        className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-white border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors flex-shrink-0 min-h-[36px]"
                      >
                        {t('vendor.dashboard.stockAlerts.update', 'Update')}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          SECTION 3: SALES CHART (7 Days)
          ============================================================ */}
      <Card className="p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              {t('vendor.dashboard.charts.salesTrend', 'Sales Trend')}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {t('vendor.dashboard.charts.last7Days', 'Last 7 days')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg">
            <ArrowUpIcon className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium text-green-700">
              {t('vendor.dashboard.charts.live', 'Live')}
            </span>
          </div>
        </div>
        <div className="h-56 sm:h-64">
          {salesChartData.labels.length > 0 ? (
            <Suspense fallback={<ChartSkeleton />}>
              <Line data={salesChartData} options={chartOptions} />
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-400">
                {t('vendor.dashboard.charts.noData', 'No sales data yet for this period')}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ============================================================
          SECTION 4: QUICK ORDER ACTIONS
          ============================================================ */}
      {pendingOrders.length > 0 && (
        <Card className="p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-green-100">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {t('vendor.dashboard.quickActions.title', 'Quick Order Actions')}
                </h3>
                <p className="text-xs text-gray-500">
                  {t('vendor.dashboard.quickActions.subtitle', '{{count}} orders awaiting your response', {
                    count: pendingOrders.length,
                  })}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {pendingOrders.length}
            </span>
          </div>

          <div className="space-y-4">
            {pendingOrders.map((order) => {
              const timeRemaining = getTimeRemaining(order.created_at)
              return (
                <div
                  key={order.id}
                  className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-colors"
                >
                  {/* Order Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-green-600 text-sm">
                        {order.order_number || order.id?.slice(0, 8)}
                      </span>
                      {timeRemaining.expired ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          {t('vendor.dashboard.quickActions.expired', 'Expired')}
                        </span>
                      ) : timeRemaining.urgent ? (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full animate-pulse">
                          {timeRemaining.text} {t('vendor.dashboard.quickActions.left', 'left')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          {timeRemaining.text} {t('vendor.dashboard.quickActions.left', 'left')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-gray-900">{formatPrice(order.total)}</span>
                  </div>

                  {/* Buyer Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">
                        {order.buyer?.first_name} {order.buyer?.last_name}
                      </span>
                    </div>
                    {order.shipping_city && (
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{order.shipping_city}</span>
                      </div>
                    )}
                    {order.buyer?.phone && (
                      <a
                        href={`tel:${order.buyer.phone}`}
                        className="flex items-center gap-1.5 text-green-600 hover:underline"
                      >
                        <PhoneIcon className="w-3.5 h-3.5" />
                        {order.buyer.phone}
                      </a>
                    )}
                  </div>

                  {/* Product Thumbnails */}
                  {order.items && order.items.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {order.items.slice(0, 4).map((item) => {
                        const productImage = item.product?.image_url
                        const productName = item.product?.name || 'Product'
                        return (
                          <div key={item.id} className="flex-shrink-0 w-14 text-center">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 mb-1">
                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={productName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <CubeIcon className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate" title={productName}>
                              {productName}
                            </p>
                            <p className="text-xs text-gray-400">×{item.quantity}</p>
                          </div>
                        )
                      })}
                      {order.items.length > 4 && (
                        <div className="flex-shrink-0 w-14 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-500">
                              +{order.items.length - 4}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptOrder(order.id)}
                      disabled={processingAction === order.id || timeRemaining.expired}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px] shadow-sm shadow-green-200"
                    >
                      {processingAction === order.id ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <CheckIcon className="w-5 h-5" />
                      )}
                      {t('vendor.dashboard.quickActions.accept', 'Accept')}
                    </button>
                    <button
                      onClick={() => handleRejectClick(order.id)}
                      disabled={processingAction === order.id || timeRemaining.expired}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px] shadow-sm shadow-red-200"
                    >
                      {processingAction === order.id ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <XMarkIcon className="w-5 h-5" />
                      )}
                      {t('vendor.dashboard.quickActions.reject', 'Reject')}
                    </button>
                    <button
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="px-4 py-3 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                      aria-label="View details"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ============================================================
          SECTION 5: RECENT ORDERS TABLE
          ============================================================ */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {t('vendor.dashboard.recentOrders.title', 'Recent Orders')}
          </h3>
          <button
            onClick={() => navigate('/vendor/orders')}
            className="text-sm text-green-600 font-medium hover:underline"
          >
            {t('common.viewAll', 'View All')}
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t('vendor.orders.orderId', 'Order ID')}</th>
                <th>{t('vendor.orders.buyer', 'Buyer')}</th>
                <th>{t('vendor.orders.total', 'Total')}</th>
                <th>{t('vendor.orders.status', 'Status')}</th>
                <th>{t('vendor.orders.date', 'Date')}</th>
                <th>{t('vendor.dashboard.recentOrders.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    {t('vendor.dashboard.recentOrders.noOrders', 'No orders yet')}
                  </td>
                </tr>
              ) : (
                recentOrders.slice(0, 8).map((order) => {
                  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                  const Icon = config.icon
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="font-semibold text-green-600 text-sm">
                          {order.order_number || order.id?.slice(0, 8)}
                        </span>
                      </td>
                      <td className="font-medium text-sm">
                        {order.buyer?.first_name} {order.buyer?.last_name}
                      </td>
                      <td className="font-semibold text-sm">{formatPrice(order.total)}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${config.color}`}>
                          <Icon className="w-3 h-3" />
                          {t(config.label, config.labelDefault)}
                        </span>
                      </td>
                      <td className="text-gray-500 text-sm">
                        {new Date(order.created_at).toLocaleDateString(
                          i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="text-sm text-green-600 hover:underline font-medium"
                        >
                          {t('vendor.dashboard.recentOrders.view', 'View')}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden space-y-3">
          {recentOrders.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-sm">
              {t('vendor.dashboard.recentOrders.noOrders', 'No orders yet')}
            </p>
          ) : (
            recentOrders.slice(0, 5).map((order) => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const Icon = config.icon
              return (
                <div
                  key={order.id}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-green-600 text-sm">
                      {order.order_number || order.id?.slice(0, 8)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${config.color}`}>
                      <Icon className="w-3 h-3" />
                      {t(config.label, config.labelDefault)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {order.buyer?.first_name} {order.buyer?.last_name}
                    </span>
                    <span className="font-bold text-gray-900">{formatPrice(order.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(order.created_at).toLocaleDateString(
                      i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US',
                      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}
                  </p>
                  <button
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="w-full mt-3 py-2.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors min-h-[44px]"
                  >
                    {t('vendor.dashboard.recentOrders.viewDetails', 'View Details')}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* ============================================================
          REJECT ORDER MODAL
          ============================================================ */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false)
          setRejectReason('')
          setRejectOtherReason('')
        }}
        size="md"
        title={t('vendor.dashboard.rejectModal.title', 'Reject Order')}
      >
        <div className="space-y-4">
          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                {t('vendor.dashboard.rejectModal.warning', 'Rejecting an order will notify the buyer and cannot be undone.')}
              </p>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendor.dashboard.rejectModal.reason', 'Reason for rejection')}
            </label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[48px]"
            >
              <option value="">{t('vendor.dashboard.rejectModal.selectReason', 'Select a reason')}</option>
              <option value="out_of_stock">
                {t('vendor.dashboard.rejectModal.reasons.outOfStock', 'Out of stock')}
              </option>
              <option value="quality_issue">
                {t('vendor.dashboard.rejectModal.reasons.quality', 'Quality issue')}
              </option>
              <option value="capacity_full">
                {t('vendor.dashboard.rejectModal.reasons.capacity', 'Full capacity')}
              </option>
              <option value="delivery_unavailable">
                {t('vendor.dashboard.rejectModal.reasons.delivery', 'Delivery unavailable')}
              </option>
              <option value="pricing_error">
                {t('vendor.dashboard.rejectModal.reasons.pricing', 'Pricing error')}
              </option>
              <option value="other">
                {t('vendor.dashboard.rejectModal.reasons.other', 'Other')}
              </option>
            </select>
          </div>

          {/* Other Reason Text */}
          {rejectReason === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('vendor.dashboard.rejectModal.otherReason', 'Please specify')}
              </label>
              <textarea
                value={rejectOtherReason}
                onChange={(e) => setRejectOtherReason(e.target.value)}
                placeholder={t('vendor.dashboard.rejectModal.otherPlaceholder', 'Describe the reason...')}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none min-h-[80px]"
                rows={3}
                maxLength={500}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setRejectModalOpen(false)
                setRejectReason('')
                setRejectOtherReason('')
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[48px]"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={processingAction === selectedOrderId}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
            >
              {processingAction === selectedOrderId ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.submitting', 'Processing...')}
                </span>
              ) : (
                t('vendor.dashboard.rejectModal.confirmReject', 'Confirm Rejection')
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const VendorDashboardWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorDashboard">
    <VendorDashboard />
  </ErrorBoundary>
)

export default VendorDashboardWithErrorBoundary
