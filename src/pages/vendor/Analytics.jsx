import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { jsPDF } from 'jspdf'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  ArrowDownTrayIcon,
  CalendarIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import {
  DATE_RANGES,
  buildAnalyticsCsvRows,
  buildAnalyticsPdfSummary,
  buildCategoryDistributionData,
  buildOrdersChartData,
  buildRatingsTrendData,
  buildRevenueChartData,
  buildStatusBreakdown,
  buildTimeBuckets,
  buildTopProductMetrics,
  buildTopProductsChartData,
  calculateVendorAnalyticsMetrics,
  resolveVendorAnalyticsRange,
} from '@/services/vendorAnalytics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const EMPTY_ANALYTICS = {
  revenueData: { labels: [], datasets: [] },
  ordersData: { labels: [], datasets: [] },
  ratingsTrendData: { labels: [], datasets: [] },
  topRevenueData: { labels: [], datasets: [] },
  topQuantityData: { labels: [], datasets: [] },
  categoryData: { labels: [], datasets: [] },
  keyMetrics: {
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    repeatCustomers: 0,
    avgDeliveryTime: 0,
    fulfillmentRate: 0,
    avgReviewResponseHours: 0,
    reviewReplyRate: 0,
    averageRating: 0,
    lowStockProducts: 0,
  },
  topProductsByRevenue: [],
  topProductsByQuantity: [],
  statusBreakdown: [],
  rawOrders: [],
  rawProducts: [],
  rawReviews: [],
  topCustomers: [],
  prevKeyMetrics: { totalRevenue: null, totalOrders: null, avgOrderValue: null },
  activeRangeLabel: '',
}

const buildMoneyChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${formatPrice(context.parsed.y)}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      ticks: {
        callback: (value) => formatPrice(value),
      },
    },
    x: {
      grid: { display: false },
    },
  },
})

const buildCountChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      ticks: {
        precision: 0,
      },
    },
    x: {
      grid: { display: false },
    },
  },
})

const buildRatingChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      min: 0,
      max: 5,
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      ticks: {
        stepSize: 1,
      },
    },
    x: {
      grid: { display: false },
    },
  },
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
    tooltip: {
      callbacks: {
        label: (context) => `${context.label}: ${formatPrice(context.parsed)}`,
      },
    },
  },
}

const VendorAnalytics = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [selectedRange, setSelectedRange] = useState('30d')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [appliedCustomRange, setAppliedCustomRange] = useState({ from: '', to: '' })
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS)

  const isCustomRange = selectedRange === 'custom'
  const currentPreset = DATE_RANGES.find((range) => range.id === selectedRange)

  const loadAnalytics = useCallback(async () => {
    if (!user?.id) {
      setAnalytics(EMPTY_ANALYTICS)
      setLoading(false)
      return
    }

    if (isCustomRange && (!appliedCustomRange.from || !appliedCustomRange.to)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const resolvedRange = resolveVendorAnalyticsRange({
        selectedRange,
        customDateFrom: appliedCustomRange.from,
        customDateTo: appliedCustomRange.to,
      })

      const ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          total,
          status,
          created_at,
          delivered_at,
          buyer_id,
          vendor_amount,
          payment_received_amount,
          actual_sale_amount,
          vendor_confirmed_at,
          vendor_prepared_at,
          driver_assigned_at,
          order_items (
            id,
            product_id,
            quantity,
            unit_price
          )
        `)
        .eq('vendor_id', user.id)
        .gte('created_at', resolvedRange.startDate.toISOString())
        .lte('created_at', resolvedRange.endDate.toISOString())
        .order('created_at', { ascending: true })

      const productsQuery = supabase
        .from('products')
        .select('id, name, category, price_per_unit, stock_quantity, is_available, average_rating, reviews_count')
        .eq('vendor_id', user.id)

      const reviewsQuery = supabase
        .from('reviews')
        .select('id, rating, created_at, vendor_reply_at, product_id')
        .eq('vendor_id', user.id)
        .is('deleted_at', null)
        .gte('created_at', resolvedRange.startDate.toISOString())
        .lte('created_at', resolvedRange.endDate.toISOString())
        .order('created_at', { ascending: true })

      const [ordersResult, productsResult, reviewsResult] = await Promise.all([
        ordersQuery,
        productsQuery,
        reviewsQuery,
      ])

      if (ordersResult.error) throw ordersResult.error
      if (productsResult.error) throw productsResult.error
      if (reviewsResult.error) throw reviewsResult.error

      const orders = ordersResult.data || []
      const products = productsResult.data || []
      const reviews = reviewsResult.data || []

      // --- Previous period (same duration, shifted back) for delta comparison ---
      const duration = resolvedRange.endDate.getTime() - resolvedRange.startDate.getTime()
      const prevStartDate = new Date(resolvedRange.startDate.getTime() - duration)
      const prevEndDate = resolvedRange.startDate

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id, total, status, vendor_amount')
        .eq('vendor_id', user.id)
        .gte('created_at', prevStartDate.toISOString())
        .lte('created_at', prevEndDate.toISOString())

      const prevMetrics = calculateVendorAnalyticsMetrics({ orders: prevOrders || [], reviews: [], products })

      // --- Top customers by revenue ---
      const customerRevMap = {}
      for (const order of orders) {
        if (!order.buyer_id) continue
        customerRevMap[order.buyer_id] = (customerRevMap[order.buyer_id] || 0) + (order.vendor_amount || order.total || 0)
      }
      const topCustomerIds = Object.entries(customerRevMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, revenue]) => ({ id, revenue }))

      let topCustomers = topCustomerIds
      if (topCustomerIds.length > 0) {
        const { data: buyerProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', topCustomerIds.map((c) => c.id))
        topCustomers = topCustomerIds.map((c, idx) => {
          const profile = buyerProfiles?.find((p) => p.id === c.id)
          const name = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || `عميل ${idx + 1}`
            : `عميل ${idx + 1}`
          return { ...c, name }
        })
      }
      const { buckets, labels } = buildTimeBuckets({
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate,
        granularity: resolvedRange.granularity,
      })

      const topProductMetrics = buildTopProductMetrics({ orders, products })
      const topProductsByRevenue = topProductMetrics.slice(0, 5)
      const topProductsByQuantity = [...topProductMetrics]
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 5)

      setAnalytics({
        revenueData: buildRevenueChartData({
          orders,
          buckets,
          labels,
          label: t('vendor.analytics.revenue', 'الإيرادات'),
        }),
        ordersData: buildOrdersChartData({
          orders,
          buckets,
          labels,
          label: t('vendor.analytics.orders', 'الطلبات'),
        }),
        ratingsTrendData: buildRatingsTrendData({
          reviews,
          buckets,
          labels,
          label: t('vendor.analytics.averageRating', 'متوسط التقييم'),
        }),
        topRevenueData: buildTopProductsChartData({
          topProducts: topProductsByRevenue,
          label: t('vendor.analytics.topProductsByRevenue', 'الإيراد'),
          metric: 'revenue',
        }),
        topQuantityData: buildTopProductsChartData({
          topProducts: topProductsByQuantity,
          label: t('vendor.analytics.topProductsByQuantity', 'الكمية المباعة'),
          metric: 'quantity',
        }),
        categoryData: buildCategoryDistributionData({ topProducts: topProductMetrics }),
        keyMetrics: calculateVendorAnalyticsMetrics({ orders, reviews, products }),
        topProductsByRevenue,
        topProductsByQuantity,
        statusBreakdown: buildStatusBreakdown(orders),
        rawOrders: orders,
        rawProducts: products,
        rawReviews: reviews,
        topCustomers,
        prevKeyMetrics: {
          totalRevenue: prevMetrics.totalRevenue,
          totalOrders: prevMetrics.totalOrders,
          avgOrderValue: prevMetrics.avgOrderValue,
        },
        activeRangeLabel: resolvedRange.labelAr,
      })
    } catch (error) {
      logger.error('Error loading analytics:', error)
      toast.error('تعذر تحميل التحليلات حالياً')
    } finally {
      setLoading(false)
    }
  }, [user?.id, isCustomRange, appliedCustomRange.from, appliedCustomRange.to, selectedRange, t])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const handleApplyCustomRange = () => {
    if (!customDateFrom || !customDateTo) {
      toast.error('يرجى اختيار تاريخ البداية والنهاية')
      return
    }

    if (new Date(customDateFrom) > new Date(customDateTo)) {
      toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية')
      return
    }

    setAppliedCustomRange({ from: customDateFrom, to: customDateTo })
  }

  const handleExportCSV = async () => {
    setExportingCsv(true)
    try {
      const rows = buildAnalyticsCsvRows({ orders: analytics.rawOrders })
      if (rows.length === 0) {
        toast.error('لا توجد بيانات للتصدير')
        return
      }

      const headers = ['Order ID', 'Date', 'Status', 'Vendor Revenue (MAD)', 'Items Count', 'Buyer ID']
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => [
          row.orderId,
          row.date,
          row.status,
          row.totalRevenue,
          row.itemsCount,
          row.buyerId,
        ].map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vendor-analytics-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('تم تصدير التحليلات بصيغة CSV')
    } catch (error) {
      logger.error('Export CSV error:', error)
      toast.error('فشل تصدير CSV')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleExportPDF = async () => {
    setExportingPdf(true)
    try {
      if (analytics.rawOrders.length === 0 && analytics.rawReviews.length === 0) {
        toast.error('لا توجد بيانات كافية لتوليد PDF')
        return
      }

      const doc = new jsPDF()
      const summaryLines = buildAnalyticsPdfSummary({
        rangeLabel: analytics.activeRangeLabel || currentPreset?.labelAr || 'Selected Range',
        metrics: analytics.keyMetrics,
        topProducts: analytics.topProductsByRevenue,
      })

      doc.setFontSize(18)
      doc.text('Vendor Analytics Report', 14, 20)
      doc.setFontSize(11)

      let y = 32
      summaryLines.forEach((line) => {
        doc.text(String(line), 14, y)
        y += 7
        if (y > 275) {
          doc.addPage()
          y = 20
        }
      })

      doc.save(`vendor-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('تم إنشاء ملف PDF بنجاح')
    } catch (error) {
      logger.error('Export PDF error:', error)
      toast.error('فشل تصدير PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  const calcDelta = (current, prev) => {
    if (prev === null || prev === 0) return null
    return Math.round(((current - prev) / prev) * 100)
  }

  const DeltaBadge = ({ delta }) => {
    if (delta === null) return null
    const positive = delta >= 0
    return (
      <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
        {positive ? '▲' : '▼'} {Math.abs(delta)}%
      </span>
    )
  }

  return (
    <div>
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor.analytics.title', 'تحليلات البائع')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {analytics.activeRangeLabel || currentPreset?.labelAr || 'آخر 30 يوم'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            <select
              value={selectedRange}
              onChange={(event) => setSelectedRange(event.target.value)}
              className="input text-sm py-2 pr-8"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.id} value={range.id}>{range.labelAr}</option>
              ))}
              <option value="custom">تاريخ مخصص</option>
            </select>
          </div>

          {isCustomRange && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customDateFrom}
                onChange={(event) => setCustomDateFrom(event.target.value)}
                className="input text-sm py-2"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(event) => setCustomDateTo(event.target.value)}
                className="input text-sm py-2"
              />
              <button onClick={handleApplyCustomRange} className="btn-primary text-sm py-2 px-3">
                تطبيق
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            disabled={exportingCsv}
            className="btn-outline text-sm py-2 px-3 flex items-center gap-2 disabled:opacity-50"
          >
            {exportingCsv ? <LoadingSpinner size="sm" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
            CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="btn-outline text-sm py-2 px-3 flex items-center gap-2 disabled:opacity-50"
          >
            {exportingPdf ? <LoadingSpinner size="sm" /> : <DocumentArrowDownIcon className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <p className="text-sm text-green-600 mb-1">إجمالي الإيرادات</p>
          <p className="text-2xl font-bold text-green-900">{formatPrice(analytics.keyMetrics.totalRevenue)}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-green-500">{analytics.keyMetrics.totalOrders} طلب</p>
            <DeltaBadge delta={calcDelta(analytics.keyMetrics.totalRevenue, analytics.prevKeyMetrics.totalRevenue)} />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <p className="text-sm text-blue-600 mb-1">متوسط قيمة الطلب</p>
          <p className="text-2xl font-bold text-blue-900">{formatPrice(analytics.keyMetrics.avgOrderValue)}</p>
          <div className="flex justify-end mt-1">
            <DeltaBadge delta={calcDelta(analytics.keyMetrics.avgOrderValue, analytics.prevKeyMetrics.avgOrderValue)} />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <p className="text-sm text-purple-600 mb-1">العملاء المتكررون</p>
          <p className="text-2xl font-bold text-purple-900">{analytics.keyMetrics.repeatCustomers}%</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <p className="text-sm text-orange-600 mb-1">الالتزام بالتسليم</p>
          <p className="text-2xl font-bold text-orange-900">{analytics.keyMetrics.fulfillmentRate}%</p>
          <p className="text-xs text-orange-500 mt-1">متوسط {analytics.keyMetrics.avgDeliveryTime} يوم</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 col-span-2 xl:col-span-1">
          <p className="text-sm text-rose-600 mb-1">استجابة التقييمات</p>
          <p className="text-2xl font-bold text-rose-900">{analytics.keyMetrics.reviewReplyRate}%</p>
          <p className="text-xs text-rose-500 mt-1">متوسط {analytics.keyMetrics.avgReviewResponseHours} ساعة</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">اتجاه الإيرادات</h3>
          <div className="h-72">
            <Line data={analytics.revenueData} options={buildMoneyChartOptions()} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">اتجاه الطلبات</h3>
          <div className="h-72">
            <Line data={analytics.ordersData} options={buildCountChartOptions()} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">أعلى المنتجات بالإيراد</h3>
          <div className="h-72">
            <Bar data={analytics.topRevenueData} options={buildMoneyChartOptions()} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">أعلى المنتجات بالكمية المباعة</h3>
          <div className="h-72">
            <Bar data={analytics.topQuantityData} options={buildCountChartOptions()} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">اتجاه تقييمات العملاء</h3>
          <div className="h-72">
            <Line data={analytics.ratingsTrendData} options={buildRatingChartOptions()} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع الإيراد حسب الفئة</h3>
          <div className="h-72">
            <Doughnut data={analytics.categoryData} options={doughnutOptions} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">إشارات تجربة العملاء</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">متوسط التقييم</span>
              <span className="font-semibold text-gray-900">{analytics.keyMetrics.averageRating.toFixed(2)} / 5</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">نسبة الرد على التقييمات</span>
              <span className="font-semibold text-gray-900">{analytics.keyMetrics.reviewReplyRate}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">متوسط وقت الرد</span>
              <span className="font-semibold text-gray-900">{analytics.keyMetrics.avgReviewResponseHours} ساعة</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600">منتجات منخفضة المخزون</span>
              <span className="font-semibold text-gray-900">{analytics.keyMetrics.lowStockProducts}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">الطلبات حسب الحالة</h3>
          <div className="space-y-3">
            {analytics.statusBreakdown.length > 0 ? analytics.statusBreakdown.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600 capitalize">{status.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-500">لا توجد طلبات ضمن هذا النطاق الزمني</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ملخص أفضل المنتجات</h3>
          <div className="space-y-3">
            {analytics.topProductsByRevenue.length > 0 ? analytics.topProductsByRevenue.map((product, index) => (
              <div key={product.productId} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{index + 1}. {product.name}</span>
                  <span className="text-xs text-green-600 font-medium">{formatPrice(product.revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{product.quantity} وحدة مباعة</span>
                  <span>{product.category}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500">لا توجد بيانات مبيعات كافية لعرض أفضل المنتجات</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">أفضل العملاء بالإيراد</h3>
          <div className="space-y-3">
            {analytics.topCustomers.length > 0 ? analytics.topCustomers.map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 text-xs font-bold rounded-full flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{customer.name}</span>
                </div>
                <span className="text-xs text-green-600 font-semibold flex-shrink-0 ml-2">{formatPrice(customer.revenue)}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-500">لا توجد بيانات كافية لعرض أفضل العملاء</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default VendorAnalytics