import React, { useState, useEffect, useCallback, useRef, lazy, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { realtimeService } from '@/services/realtime'
import { ordersApi } from '@/modules/orders'
import ErrorBoundary from '@/components/ErrorBoundary'
import CommissionDashboard from '@/components/vendor/CommissionDashboard'
import StoreEvolutionNotification from '@/components/vendor/StoreEvolutionNotification'
import PartnershipRequests from '@/components/shared/PartnershipRequests'
import PendingOrdersPanel from '@/components/vendor/PendingOrdersPanel'
import RevenueChart from '@/components/vendor/RevenueChart'
import RecentOrdersWidget from '@/components/vendor/RecentOrdersWidget'
import VendorSetupChecklist from '@/components/vendor/VendorSetupChecklist'
import {
  Card,
  LoadingSpinner,
  VendorAlerts,
  VendorGuidelines,
  StarRating,
  Modal,
  StateSkeleton as Skeleton,
  ErrorState,
} from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  WalletIcon,
  ShoppingBagIcon,
  CubeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  UsersIcon,
  BellIcon,
  ClockIcon,
  SparklesIcon,
  CalendarIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
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
// MAIN COMPONENT
// ============================================================
const VendorDashboard = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  // Core state
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
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
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  // Action state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectOtherReason, setRejectOtherReason] = useState('')
  const [processingAction, setProcessingAction] = useState(null)

  // Notification state
  const [newOrderNotification, setNewOrderNotification] = useState(null)

  const storeStatus = useMemo(() => {
    if (profile?.store_paused) {
      return { label: 'متوقف مؤقتاً', tone: 'red' }
    }
    if (profile?.is_active) {
      return { label: 'مفعل', tone: 'green' }
    }
    return { label: 'قيد المراجعة', tone: 'amber' }
  }, [profile?.is_active, profile?.store_paused])

  const nextAction = useMemo(() => {
    if (!profile?.latitude || !profile?.longitude) {
      return {
        title: 'حدد موقع متجرك لإكمال التفعيل',
        actionLabel: 'إعداد الموقع',
        actionPath: '/vendor/location',
      }
    }
    if (profile?.driver_search_done !== true) {
      return {
        title: 'حدد تفضيلات التوصيل لإكمال الإعداد',
        actionLabel: 'إعداد التوصيل',
        actionPath: '/vendor/driver-preferences',
      }
    }
    if ((stats?.totalProducts || 0) === 0) {
      return {
        title: 'أضف أول منتج لبدء استقبال الطلبات',
        actionLabel: 'إضافة منتج',
        actionPath: '/vendor/products',
      }
    }
    if (pendingApprovalCount > 0) {
      return {
        title: 'منتجاتك قيد المراجعة من فريق الإدارة',
        actionLabel: 'مراجعة المنتجات',
        actionPath: '/vendor/products',
      }
    }
    return {
      title: 'متجرك جاهز لاستقبال الطلبات!',
      actionLabel: 'إدارة المتجر',
      actionPath: '/vendor/products',
    }
  }, [profile?.latitude, profile?.longitude, profile?.driver_search_done, stats?.totalProducts, pendingApprovalCount])

  // Compute setup completion percentage for checklist
  const setupProgress = useMemo(() => {
    const steps = [
      Boolean(profile?.agreement_accepted),
      Boolean(profile?.store_name),
      Boolean(profile?.latitude && profile?.longitude),
      profile?.driver_search_done === true,
      stats.totalProducts > 0,
      stats.totalProducts > 0 && pendingApprovalCount === 0,
    ]
    const done = steps.filter(Boolean).length
    return Math.round((done / steps.length) * 100)
  }, [profile, stats.totalProducts, pendingApprovalCount])

  // Refs
  const realtimeSubRef = useRef(null)
  const loadDashboardDataRef = useRef(null)

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================
  const loadDashboardData = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    setLoadError(null)
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const lowStockThreshold = profile?.low_stock_threshold || 10
      const [
        productsCountResult,
        lowStockResult,
        outOfStockResult,
        todayOrdersResult,
        yesterdayOrdersResult,
        pendingCountResult,
        prevPendingCountResult,
        monthOrdersResult,
        prevMonthOrdersResult,
        reviewsResult,
        pendingOrdersResult,
        recentOrdersResult,
        weekOrdersResult,
        pendingApprovalsResult,
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', profile.id),
        supabase
          .from('products')
          .select('id, name, available_quantity')
          .eq('vendor_id', profile.id)
          .eq('is_available', true)
          .lte('available_quantity', lowStockThreshold)
          .gt('available_quantity', 0)
          .order('available_quantity', { ascending: true })
          .limit(10),
        supabase
          .from('products')
          .select('id, name, available_quantity')
          .eq('vendor_id', profile.id)
          .eq('is_available', true)
          .eq('available_quantity', 0)
          .order('name', { ascending: true })
          .limit(10),
        supabase
          .from('orders')
          .select('total, status')
          .eq('vendor_id', profile.id)
          .gte('created_at', todayStart),
        supabase
          .from('orders')
          .select('total, status')
          .eq('vendor_id', profile.id)
          .gte('created_at', yesterdayStart)
          .lt('created_at', todayStart),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', profile.id)
          .eq('status', 'pending'),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', profile.id)
          .eq('status', 'pending')
          .gte('created_at', yesterdayStart)
          .lt('created_at', todayStart),
        supabase
          .from('orders')
          .select('total, status')
          .eq('vendor_id', profile.id)
          .gte('created_at', monthStart),
        supabase
          .from('orders')
          .select('total, status')
          .eq('vendor_id', profile.id)
          .gte('created_at', prevMonthStart)
          .lte('created_at', prevMonthEnd),
        supabase
          .from('reviews')
          .select('rating')
          .eq('vendor_id', profile.id)
          .is('deleted_at', null),
        supabase
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
          .limit(5),
        supabase
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
          .limit(10),
        supabase
          .from('orders')
          .select('total, status, created_at')
          .eq('vendor_id', profile.id)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: true }),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', profile.id)
          .eq('approval_status', 'pending'),
      ])

      const lowStock = lowStockResult.data || []
      const outOfStock = outOfStockResult.data || []
      const todayOrders = todayOrdersResult.data || []
      const yesterdayOrders = yesterdayOrdersResult.data || []
      const monthOrders = monthOrdersResult.data || []
      const prevMonthOrders = prevMonthOrdersResult.data || []
      const reviews = reviewsResult.data || []
      const pendingOrdersData = pendingOrdersResult.data || []
      const recentOrdersData = recentOrdersResult.data || []
      const weekOrders = weekOrdersResult.data || []
      const pendingApprovals = pendingApprovalsResult.count || 0

      setLowStockProducts(lowStock)
      setOutOfStockProducts(outOfStock)
      setPendingOrders(pendingOrdersData)
      setRecentOrders(recentOrdersData)
      setPendingApprovalCount(pendingApprovals)

      const dailySales = todayOrders
        .filter((o) => o.status !== 'vendor_rejected' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const dailySalesPrev = yesterdayOrders
        .filter((o) => o.status !== 'vendor_rejected' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const newOrders = pendingCountResult.count || 0
      const newOrdersPrev = prevPendingCountResult.count || 0

      const monthlyRevenue = monthOrders
        .filter((o) => o.status === 'delivered' || o.status === 'vendor_accepted' || o.status === 'on_the_way')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const monthlyRevenuePrev = prevMonthOrders
        .filter((o) => o.status === 'delivered' || o.status === 'vendor_accepted' || o.status === 'on_the_way')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const totalReviews = reviews.length
      const storeRating = totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0

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
        return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'fr-MA', {
          weekday: 'short',
        })
      })
      const chartValues = Object.values(dailyTotals)

      setSalesChartData({
        labels: chartLabels,
        datasets: [
          {
            label: 'مبيعات يومية (MAD)',
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
        totalProducts: productsCountResult.count || 0,
        lowStockCount: lowStock?.length || 0,
        outOfStockCount: outOfStock?.length || 0,
      })
    } catch (error) {
      logger.error('Error loading dashboard data:', error)
      setLoadError(error)
      toast.error(t('vendor.dashboard.errors.loadFailed', 'تعذر تحميل بيانات لوحة التحكم'))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.low_stock_threshold, t, i18n.language])

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
        newLabels.push(d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'fr-MA', {
          weekday: 'short',
        }))
      }
      setSalesChartData(prev => ({
        ...prev,
        labels: newLabels,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return { expired: false, text: `${hours}س ${mins}د`, urgent: minutes < 30 }
    }
    return { expired: false, text: `${mins}د`, urgent: minutes < 15 }
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
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, index) => <Skeleton.Card key={index} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton.Card key={index} />)}
        </div>
        <Skeleton.Card className="min-h-[320px]" />
        <Skeleton.Table rows={4} columns={4} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="pb-20">
        <ErrorState
          title="تعذر تحميل لوحة التحكم"
          description={loadError?.message || 'حدث خطأ أثناء جلب بيانات متجرك. حاول مرة أخرى.'}
          onRetry={loadDashboardData}
          retryLabel="إعادة المحاولة"
        />
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
      title: t('vendor.dashboard.stats.dailySales', 'مبيعات اليوم'),
      value: formatPrice(stats.dailySales),
      icon: WalletIcon,
      bgLight: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: dailyTrend,
      trendLabel: t('vendor.dashboard.stats.vsYesterday', 'مقارنة بالأمس'),
    },
    {
      title: t('vendor.dashboard.stats.newOrders', 'طلبات جديدة'),
      value: stats.newOrders.toString(),
      icon: ShoppingBagIcon,
      bgLight: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: ordersTrend,
      trendLabel: t('vendor.dashboard.stats.vsYesterday', 'مقارنة بالأمس'),
      badge: stats.newOrders > 0 ? stats.newOrders : null,
    },
    {
      title: t('vendor.dashboard.stats.monthlyRevenue', 'مبيعات الشهر'),
      value: formatPrice(stats.monthlyRevenue),
      icon: CalendarIcon,
      bgLight: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: revenueTrend,
      trendLabel: t('vendor.dashboard.stats.vsLastMonth', 'مقارنة بالشهر الماضي'),
    },
    {
      title: t('vendor.dashboard.stats.storeRating', 'تقييم المتجر'),
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
    <div className="min-w-0 overflow-x-hidden pb-20" data-testid="vendor-dashboard-page">
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
                {t('vendor.dashboard.notifications.newOrderBanner', 'تم استلام طلب جديد')}
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
            aria-label="إغلاق"
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

      {/* Store status (design-aligned) */}
      <Card className="mb-4 border border-green-200 bg-green-50 p-4 rounded-2xl" data-testid="vendor-dashboard-status-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-green-700">
              <TruckIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-sm font-bold text-gray-900">حالة المتجر</p>
              <p className="mt-1 text-xs text-gray-600 leading-5">
                أكمل الخطوات التالية لتفعيل متجرك والبدء في استقبال الطلبات.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              storeStatus.tone === 'green'
                ? 'bg-green-100 text-green-700'
                : storeStatus.tone === 'red'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            <ClockIcon className="w-4 h-4" aria-hidden="true" />
            {storeStatus.label}
          </span>
        </div>
      </Card>

      {profile?.driver_search_done === false && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <InformationCircleIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">اختر تفضيلات التوصيل لإكمال إعداد المتجر.</p>
              <p className="text-sm text-blue-700 mt-1">
                هذا يساعدنا على توجيه الطلبات إلى السائقين الملائمين ويتجنّب توقف الإعداد في وقت مبكر.
              </p>
              <button
                type="button"
                onClick={() => navigate('/vendor/driver-preferences')}
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                حدد تفضيلات التوصيل
              </button>
            </div>
          </div>
        </div>
      )}

      <VendorSetupChecklist
        items={[
          {
            key: 'contract',
            label: 'توقيع العقد',
            description: 'وقّع العقد الرقمي لتفعيل متجرك.',
            complete: Boolean(profile?.agreement_accepted),
            path: '/vendor/digital-contract',
          },
          {
            key: 'storeInfo',
            label: 'معلومات المتجر',
            description: 'أضف اسم المتجر وبيانات التواصل الأساسية.',
            complete: Boolean(profile?.store_name),
            path: '/vendor/profile',
          },
          {
            key: 'location',
            label: 'الموقع',
            description: 'أكمل تحديد موقع متجرك على الخريطة.',
            complete: Boolean(profile?.latitude && profile?.longitude),
            path: '/vendor/location',
          },
          {
            key: 'delivery',
            label: 'التوصيل',
            description: 'اختر تفضيلات التوصيل المناسبة لمتجرك.',
            complete: profile?.driver_search_done === true,
            path: '/vendor/driver-preferences',
          },
          {
            key: 'firstProduct',
            label: 'إضافة أول منتج',
            description: 'أضف منتجاً واحداً على الأقل لبدء البيع.',
            complete: stats.totalProducts > 0,
            path: '/vendor/products',
          },
          {
            key: 'approval',
            label: 'انتظار الموافقة',
            description: stats.totalProducts > 0
              ? 'فريق الإدارة يراجع منتجاتك حالياً.'
              : 'سيتجه هذا العنصر إلى الانتظار بعد إضافة منتج.',
            complete: stats.totalProducts > 0 && pendingApprovalCount === 0,
            pending: stats.totalProducts > 0 && pendingApprovalCount > 0,
            path: '/vendor/products',
          },
        ]}
        title="إعداد المتجر"
        subtitle="تابع المراحل الأساسية لتفعيل المتجر بسرعة وثقة."
        progress={setupProgress}
        nextAction={
          !profile?.agreement_accepted
            ? { title: 'وقّع العقد الرقمي', label: 'توقيع العقد', path: '/vendor/digital-contract' }
            : !profile?.store_name
              ? { title: 'أكمل معلومات المتجر', label: 'إعداد المتجر', path: '/vendor/profile' }
              : !profile?.latitude || !profile?.longitude
                ? { title: 'حدد موقع المتجر', label: 'تحديد الموقع', path: '/vendor/location' }
                : profile?.driver_search_done !== true
                  ? { title: 'اختر تفضيلات التوصيل', label: 'إعداد التوصيل', path: '/vendor/driver-preferences' }
                  : stats.totalProducts === 0
                    ? { title: 'أضف أول منتج', label: 'إضافة منتج', path: '/vendor/products' }
                    : pendingApprovalCount > 0
                      ? { title: 'منتجاتك قيد المراجعة', label: 'مراجعة المنتجات', path: '/vendor/products' }
                      : null
        }
      />

      {/* Next action (design-aligned) */}
      {nextAction && (
        <Card className="mb-6 border border-green-200 bg-green-50 p-4 rounded-2xl" data-testid="vendor-dashboard-next-action">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-900">{nextAction.title}</p>
              <p className="text-xs text-gray-600 mt-1">هذه الخطوة تساعد على تفعيل المتجر بسرعة.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(nextAction.actionPath)}
              className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-2xl"
              data-testid="vendor-dashboard-next-action-button"
            >
              <TruckIcon className="w-5 h-5" aria-hidden="true" />
              {nextAction.actionLabel}
            </button>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('vendor.dashboard.welcome', 'مرحباً، {{name}}', { name: profile?.store_name || profile?.first_name || 'بائع' })}
              <span className="ml-1">👋</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('vendor.dashboard.subtitle', 'أكمل خطوات الإعداد وابدأ في استقبال الطلبات بسهولة.')}
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
      <RevenueChart
        salesChartData={salesChartData}
        chartOptions={chartOptions}
        LineComponent={Line}
        t={t}
      />

      {/* ============================================================
          SECTION 4: QUICK ORDER ACTIONS
          ============================================================ */}
      <PendingOrdersPanel
        pendingOrders={pendingOrders}
        processingAction={processingAction}
        getTimeRemaining={getTimeRemaining}
        onAcceptOrder={handleAcceptOrder}
        onRejectOrder={handleRejectClick}
        onViewOrder={(orderId) => navigate(`/orders/${orderId}`)}
        formatPrice={formatPrice}
        t={t}
      />

      {/* ============================================================
          SECTION 5: RECENT ORDERS TABLE
          ============================================================ */}
      <RecentOrdersWidget
        recentOrders={recentOrders}
        formatPrice={formatPrice}
        locale={i18n.language === 'ar' ? 'ar-MA' : 'fr-MA'}
        onViewOrder={(orderId) => navigate(`/orders/${orderId}`)}
        onViewAll={() => navigate('/vendor/orders')}
        t={t}
      />

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
        title={t('vendor.dashboard.rejectModal.title', 'رفض الطلب')}
      >
        <div className="space-y-4">
          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                {t('vendor.dashboard.rejectModal.warning', 'رفض الطلب سيُشعِر المشتري ولا يمكن التراجع عنه.')}
              </p>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendor.dashboard.rejectModal.reason', 'سبب الرفض')}
            </label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[48px]"
            >
              <option value="">{t('vendor.dashboard.rejectModal.selectReason', 'اختر سبباً')}</option>
              <option value="out_of_stock">
                {t('vendor.dashboard.rejectModal.reasons.outOfStock', 'نفاد الكمية')}
              </option>
              <option value="quality_issue">
                {t('vendor.dashboard.rejectModal.reasons.quality', 'مشكلة في الجودة')}
              </option>
              <option value="capacity_full">
                {t('vendor.dashboard.rejectModal.reasons.capacity', 'القدرة الاستيعابية ممتلئة')}
              </option>
              <option value="delivery_unavailable">
                {t('vendor.dashboard.rejectModal.reasons.delivery', 'التوصيل غير متاح')}
              </option>
              <option value="pricing_error">
                {t('vendor.dashboard.rejectModal.reasons.pricing', 'خطأ في التسعير')}
              </option>
              <option value="other">
                {t('vendor.dashboard.rejectModal.reasons.other', 'سبب آخر')}
              </option>
            </select>
          </div>

          {/* Other Reason Text */}
          {rejectReason === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('vendor.dashboard.rejectModal.otherReason', 'اكتب السبب')}
              </label>
              <textarea
                value={rejectOtherReason}
                onChange={(e) => setRejectOtherReason(e.target.value)}
                placeholder={t('vendor.dashboard.rejectModal.otherPlaceholder', 'اشرح السبب...')}
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
              {t('common.cancel', 'إلغاء')}
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
                  {t('common.submitting', 'جاري المعالجة...')}
                </span>
              ) : (
                t('vendor.dashboard.rejectModal.confirmReject', 'تأكيد الرفض')
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
