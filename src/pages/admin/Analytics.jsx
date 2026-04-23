import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner, ChartSkeleton } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  ArrowDownTrayIcon,
  CalendarIcon,
  DocumentIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { subDays, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// Lazy load heavy chart and PDF libraries
const Line = lazy(() =>
  import('react-chartjs-2').then(async (mod) => {
    const {
      Chart: ChartJS,
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
    } = await import('chart.js')
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
    return { Line: mod.Line, Bar: mod.Bar, Doughnut: mod.Doughnut }
  }).then(mod => ({ default: mod.Line }))
)

const BarChart = lazy(() =>
  import('react-chartjs-2').then(async (mod) => {
    const {
      Chart: ChartJS,
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
    } = await import('chart.js')
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
    return { default: mod.Bar }
  })
)

const DoughnutChart = lazy(() =>
  import('react-chartjs-2').then(async (mod) => {
    const {
      Chart: ChartJS,
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
    } = await import('chart.js')
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
    return { default: mod.Doughnut }
  })
)


// ============================================
// Date Range Presets
// ============================================
const DATE_RANGES = [
  { id: '7d', labelKey: 'admin.analytics.dateRanges.7d', label: 'Last 7 Days', days: 7, granularity: 'day' },
  { id: '30d', labelKey: 'admin.analytics.dateRanges.30d', label: 'Last 30 Days', days: 30, granularity: 'day' },
  { id: '3m', labelKey: 'admin.analytics.dateRanges.3m', label: 'Last 3 Months', days: 90, granularity: 'week' },
  { id: '6m', labelKey: 'admin.analytics.dateRanges.6m', label: 'Last 6 Months', days: 180, granularity: 'week' },
  { id: '1y', labelKey: 'admin.analytics.dateRanges.1y', label: 'Last Year', days: 365, granularity: 'month' },
]

// ============================================
// PDF Styles
// ============================================
const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  title: { fontSize: 18, marginBottom: 10, fontWeight: 'bold' },
  subtitle: { fontSize: 10, marginBottom: 20, color: '#666' },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  metricsGrid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' },
  metricCard: { width: '48%', padding: 10, marginBottom: 8, backgroundColor: '#f9fafb', margin: '1%' },
  metricLabel: { fontSize: 8, color: '#666' },
  metricValue: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  table: { marginTop: 10 },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', padding: 6 },
  tableHeader: { fontWeight: 'bold', backgroundColor: '#f3f4f6' },
  col1: { width: '25%' },
  col2: { width: '20%' },
  col3: { width: '20%' },
  col4: { width: '20%' },
  col5: { width: '15%' },
  footer: { position: 'absolute', bottom: 30, right: 30, left: 30, textAlign: 'center', fontSize: 8, color: '#999' },
})

// ============================================
// PDF Document Component
// ============================================
const AnalyticsPDFDocument = ({ data, dateRangeLabel, translations }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.title}>{translations.pdfTitle}</Text>
      <Text style={pdfStyles.subtitle}>{translations.pdfPeriod}: {dateRangeLabel} | {translations.pdfGenerated}: {new Date().toLocaleDateString()}</Text>

      {/* Key Metrics */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>{translations.keyMetrics}</Text>
        <View style={pdfStyles.metricsGrid}>
          <View style={pdfStyles.metricCard}>
            <Text style={pdfStyles.metricLabel}>{translations.totalRevenue}</Text>
            <Text style={pdfStyles.metricValue}>{formatPrice(data.keyMetrics.totalRevenue)}</Text>
          </View>
          <View style={pdfStyles.metricCard}>
            <Text style={pdfStyles.metricLabel}>{translations.totalOrders}</Text>
            <Text style={pdfStyles.metricValue}>{data.keyMetrics.totalOrders.toLocaleString()}</Text>
          </View>
          <View style={pdfStyles.metricCard}>
            <Text style={pdfStyles.metricLabel}>{translations.avgOrderValue}</Text>
            <Text style={pdfStyles.metricValue}>{formatPrice(data.keyMetrics.avgOrderValue)}</Text>
          </View>
          <View style={pdfStyles.metricCard}>
            <Text style={pdfStyles.metricLabel}>{translations.totalUsers}</Text>
            <Text style={pdfStyles.metricValue}>{data.keyMetrics.totalUsers.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Revenue by Category */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>{translations.revenueByCategory}</Text>
        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.col1}>{translations.category}</Text>
            <Text style={pdfStyles.col2}>{translations.orders}</Text>
            <Text style={pdfStyles.col3}>{translations.revenue}</Text>
            <Text style={pdfStyles.col4}>{translations.avgOrder}</Text>
            <Text style={pdfStyles.col5}>{translations.share}</Text>
          </View>
          {data.categoryBreakdown.map((cat, i) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.col1}>{cat.category}</Text>
              <Text style={pdfStyles.col2}>{cat.orders}</Text>
              <Text style={pdfStyles.col3}>{formatPrice(cat.revenue)}</Text>
              <Text style={pdfStyles.col4}>{formatPrice(cat.avgOrder)}</Text>
              <Text style={pdfStyles.col5}>{cat.share}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top Vendors */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>{translations.topVendors}</Text>
        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.col1}>{translations.vendor}</Text>
            <Text style={pdfStyles.col2}>{translations.orders}</Text>
            <Text style={pdfStyles.col3}>{translations.revenue}</Text>
            <Text style={pdfStyles.col4}>{translations.avgOrder}</Text>
            <Text style={pdfStyles.col5}>{translations.products}</Text>
          </View>
          {data.topVendors.slice(0, 10).map((vendor, i) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.col1}>{vendor.store_name || 'N/A'}</Text>
              <Text style={pdfStyles.col2}>{vendor.orders}</Text>
              <Text style={pdfStyles.col3}>{formatPrice(vendor.revenue)}</Text>
              <Text style={pdfStyles.col4}>{formatPrice(vendor.avgOrder)}</Text>
              <Text style={pdfStyles.col5}>{vendor.products}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={pdfStyles.footer}>{translations.pdfFooter}</Text>
    </Page>
  </Document>
)

// ============================================
// Main Component
// ============================================
const AdminAnalytics = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedRange, setSelectedRange] = useState('30d')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [analytics, setAnalytics] = useState({
    usersGrowthData: { labels: [], datasets: [] },
    revenueData: { labels: [], datasets: [] },
    categoryData: { labels: [], datasets: [] },
    keyMetrics: {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      totalUsers: 0,
      totalVendors: 0,
      totalDrivers: 0,
    },
    categoryBreakdown: [],
    topVendors: [],
    rawOrders: [],
  })
  const chartRef = useRef(null)

  // ============================================
  // Load Analytics Data
  // ============================================
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)

      // Determine date range
      const now = new Date()
      let startDate, endDate

      if (showCustomPicker && customDateFrom && customDateTo) {
        startDate = new Date(customDateFrom)
        endDate = new Date(customDateTo)
        endDate.setHours(23, 59, 59, 999)
      } else {
        const range = DATE_RANGES.find(r => r.id === selectedRange) || DATE_RANGES[1]
        endDate = now
        startDate = subDays(now, range.days)
      }

      // Fetch orders within date range
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          buyer_total,
          created_at,
          delivered_at,
          vendor_id,
          buyer_id,
          shipping_city,
          items:order_items(
            id,
            quantity,
            unit_price,
            product:products(id, name, category, vendor_id)
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (ordersError) throw ordersError

      // Fetch users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'buyer')

      // Fetch vendors count
      const { count: totalVendors } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'vendor')

      // Fetch drivers count
      const { count: totalDrivers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver')

      // Determine granularity
      const range = DATE_RANGES.find(r => r.id === selectedRange)
      const granularity = showCustomPicker
        ? (Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) > 90 ? 'week' : 'day')
        : range?.granularity || 'day'

      // Generate time buckets
      const timeBuckets = []
      const labels = []

      if (granularity === 'day') {
        const days = eachDayOfInterval({ start: startDate, end: endDate })
        days.forEach(day => {
          timeBuckets.push({ start: day, end: day })
          labels.push(format(day, 'dd/MM'))
        })
      } else if (granularity === 'week') {
        const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })
        weeks.forEach(week => {
          const weekStart = startOfWeek(week, { weekStartsOn: 1 })
          const weekEnd = endOfWeek(week, { weekStartsOn: 1 })
          timeBuckets.push({ start: weekStart, end: weekEnd })
          labels.push(format(weekStart, 'dd/MM'))
        })
      } else {
        const months = eachMonthOfInterval({ start: startDate, end: endDate })
        months.forEach(month => {
          const monthStart = startOfMonth(month)
          const monthEnd = endOfMonth(month)
          timeBuckets.push({ start: monthStart, end: monthEnd })
          labels.push(format(monthStart, 'MMM yy'))
        })
      }

      // Calculate revenue per time bucket
      const revenuePerBucket = new Array(timeBuckets.length).fill(0)
      const ordersPerBucket = new Array(timeBuckets.length).fill(0)

      orders.forEach(order => {
        const orderDate = new Date(order.created_at)
        const bucketIndex = timeBuckets.findIndex(
          bucket => orderDate >= bucket.start && orderDate <= bucket.end
        )
        if (bucketIndex !== -1) {
          revenuePerBucket[bucketIndex] += order.total || order.buyer_total || 0
          ordersPerBucket[bucketIndex] += 1
        }
      })

      // Calculate category breakdown
      const categoryMap = {}
      orders.forEach(order => {
        order.items?.forEach(item => {
          const category = item.product?.category || 'Other'
          if (!categoryMap[category]) {
            categoryMap[category] = { category, orders: 0, revenue: 0 }
          }
          categoryMap[category].orders += item.quantity
          categoryMap[category].revenue += item.quantity * item.unit_price
        })
      })

      const totalCategoryRevenue = Object.values(categoryMap).reduce((sum, cat) => sum + cat.revenue, 0)
      const categoryBreakdown = Object.values(categoryMap)
        .map(cat => ({
          ...cat,
          avgOrder: cat.orders > 0 ? cat.revenue / cat.orders : 0,
          share: totalCategoryRevenue > 0 ? ((cat.revenue / totalCategoryRevenue) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Calculate top vendors
      const vendorMap = {}
      orders.forEach(order => {
        const vendorId = order.vendor_id
        if (!vendorMap[vendorId]) {
          vendorMap[vendorId] = { vendor_id: vendorId, orders: 0, revenue: 0, products: new Set() }
        }
        vendorMap[vendorId].orders += 1
        vendorMap[vendorId].revenue += order.total || order.buyer_total || 0
        order.items?.forEach(item => {
          if (item.product?.vendor_id) {
            vendorMap[vendorId].products.add(item.product.vendor_id)
          }
        })
      })

      // Fetch vendor details
      const vendorIds = Object.keys(vendorMap)
      let vendorsData = []
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
          .from('profiles')
          .select('id, store_name')
          .in('id', vendorIds)

        vendorsData = vendors || []
      }

      const topVendors = Object.values(vendorMap)
        .map(v => ({
          ...v,
          store_name: vendorsData.find(vendor => vendor.id === v.vendor_id)?.store_name || 'Unknown',
          avgOrder: v.orders > 0 ? v.revenue / v.orders : 0,
          products: v.products.size,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20)

      // Calculate key metrics
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total || order.buyer_total || 0), 0)
      const totalOrders = orders.length
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Update state
      setAnalytics({
        usersGrowthData: {
          labels,
          datasets: [
            {
              label: t('admin.analytics.charts.ordersOverTime', 'Orders'),
              data: ordersPerBucket,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
            },
          ],
        },
        revenueData: {
          labels,
          datasets: [
            {
              label: t('admin.analytics.charts.revenueOverTime', 'Revenue (MAD)'),
              data: revenuePerBucket,
              backgroundColor: 'rgba(22, 163, 74, 0.8)',
            },
          ],
        },
        categoryData: {
          labels: categoryBreakdown.map(c => c.category),
          datasets: [
            {
              data: categoryBreakdown.map(c => parseFloat(c.share)),
              backgroundColor: [
                'rgba(22, 163, 74, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(234, 179, 8, 0.8)',
              ],
            },
          ],
        },
        keyMetrics: {
          totalRevenue,
          totalOrders,
          avgOrderValue,
          totalUsers: totalUsers || 0,
          totalVendors: totalVendors || 0,
          totalDrivers: totalDrivers || 0,
        },
        categoryBreakdown,
        topVendors,
        rawOrders: orders,
      })

      setLoading(false)
    } catch (error) {
      logger.error('Error loading analytics:', error)
      toast.error(t('admin.analytics.notifications.loadFailed', 'Failed to load analytics data'))
      setLoading(false)
    }
  }, [selectedRange, customDateFrom, customDateTo, showCustomPicker])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // ============================================
  // Export CSV
  // ============================================
  const handleExportCSV = async () => {
    if (analytics.rawOrders.length === 0) {
      toast.error(t('admin.analytics.notifications.noData', 'No data to export'))
      return
    }

    setExporting(true)
    try {
      const headers = [
        'Order ID',
        'Order Number',
        'Date',
        'Status',
        'Total (MAD)',
        'Vendor ID',
        'Buyer ID',
        'City',
        'Items Count',
      ]

      const rows = analytics.rawOrders.map(order => [
        order.id.slice(0, 8),
        order.order_number || order.id.slice(0, 8),
        new Date(order.created_at).toLocaleDateString('en-CA'),
        order.status,
        (order.total || order.buyer_total || 0).toFixed(2),
        order.vendor_id || '',
        order.buyer_id || '',
        order.shipping_city || '',
        order.items?.length || 0,
      ])

      // Add summary
      const summaryRow = [
        '',
        'SUMMARY',
        '',
        '',
        analytics.keyMetrics.totalRevenue.toFixed(2),
        '',
        '',
        '',
        analytics.keyMetrics.totalOrders,
      ]

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        '',
        summaryRow.map(cell => `"${cell}"`).join(','),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const rangeLabel = showCustomPicker ? `${customDateFrom}_to_${customDateTo}` : selectedRange
      link.download = `admin-analytics-${rangeLabel}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('admin.analytics.notifications.csvSuccess', 'Analytics exported as CSV!'))
    } catch (error) {
      logger.error('CSV export error:', error)
      toast.error(t('admin.analytics.notifications.exportFailed', 'Failed to export CSV'))
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // Export PDF
  // ============================================
  const handleExportPDF = async () => {
    if (analytics.rawOrders.length === 0) {
      toast.error(t('admin.analytics.notifications.noData', 'No data to export'))
      return
    }

    setExporting(true)
    try {
      const rangeLabel = showCustomPicker
        ? `${customDateFrom} to ${customDateTo}`
        : (DATE_RANGES.find(r => r.id === selectedRange)?.label || selectedRange)

      const blob = await pdf(
        <AnalyticsPDFDocument
          data={analytics}
          dateRangeLabel={rangeLabel}
          translations={{
            pdfTitle: t('admin.analytics.pdfReport.title', 'Analytics Report'),
            pdfPeriod: t('admin.analytics.pdfReport.period', 'Period'),
            pdfGenerated: t('admin.analytics.pdfReport.generated', 'Generated'),
            pdfFooter: t('admin.analytics.pdfReport.footer', 'Qotoof Platform - Analytics Report'),
            keyMetrics: t('admin.analytics.pdfReport.keyMetrics', 'Key Metrics'),
            totalRevenue: t('admin.analytics.metrics.totalRevenue', 'Total Revenue'),
            totalOrders: t('admin.analytics.metrics.totalOrders', 'Total Orders'),
            avgOrderValue: t('admin.analytics.metrics.avgOrderValue', 'Avg. Order Value'),
            totalUsers: t('admin.analytics.metrics.totalUsers', 'Total Users'),
            revenueByCategory: t('admin.analytics.pdfReport.revenueByCategory', 'Revenue by Category'),
            category: t('admin.analytics.categoryTable.category', 'Category'),
            orders: t('admin.analytics.categoryTable.orders', 'Orders'),
            revenue: t('admin.analytics.categoryTable.revenue', 'Revenue'),
            avgOrder: t('admin.analytics.categoryTable.avgOrder', 'Avg Order'),
            share: t('admin.analytics.categoryTable.share', 'Share'),
            topVendors: t('admin.analytics.pdfReport.topVendors', 'Top Vendors by Revenue'),
            vendor: t('admin.analytics.topVendorsTable.vendor', 'Vendor'),
            products: t('admin.analytics.metrics.products', 'Products'),
          }}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `admin-analytics-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('admin.analytics.notifications.pdfSuccess', 'Analytics exported as PDF!'))
    } catch (error) {
      logger.error('PDF export error:', error)
      toast.error(t('admin.analytics.notifications.exportFailed', 'Failed to export PDF'))
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // Chart Options
  // ============================================
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
  }

  // ============================================
  // Loading State
  // ============================================
  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  const currentRange = DATE_RANGES.find(r => r.id === selectedRange)
  const rangeLabel = showCustomPicker
    ? `${customDateFrom} to ${customDateTo}`
    : currentRange?.label || selectedRange

  // ============================================
  // Main Render
  // ============================================
  return (
    <div>
      {/* Header with Date Range and Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.analytics.title', 'Analytics')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.analytics.pdfPeriod', 'Period')}: {rangeLabel}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting || analytics.rawOrders.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <TableCellsIcon className="w-4 h-4" />
            {t('admin.analytics.export.csv', 'Export CSV')}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || analytics.rawOrders.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <DocumentIcon className="w-4 h-4" />
            {t('admin.analytics.export.pdf', 'Export PDF')}
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <CalendarIcon className="w-5 h-5 text-gray-500" />
          <div className="flex flex-wrap gap-2">
            {DATE_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => {
                  setSelectedRange(range.id)
                  setShowCustomPicker(false)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRange === range.id && !showCustomPicker
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(range.labelKey, range.label)}
              </button>
            ))}
            <button
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showCustomPicker
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('admin.analytics.customRange', 'Custom Range')}
            </button>
          </div>
        </div>

        {/* Custom Date Range */}
        {showCustomPicker && (
          <div className="mt-4 flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('admin.analytics.fromDate', 'From Date')}</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('admin.analytics.toDate', 'To Date')}</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadAnalytics}
                disabled={!customDateFrom || !customDateTo}
                className="btn-primary"
              >
                {t('admin.analytics.apply', 'Apply')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">{t('admin.analytics.metrics.totalRevenue', 'Total Revenue')}</p>
          <p className="text-3xl font-bold text-gray-900">{formatPrice(analytics.keyMetrics.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">{analytics.keyMetrics.totalOrders} {t('admin.analytics.metrics.orders', 'orders')}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">{t('admin.analytics.metrics.avgOrderValue', 'Avg. Order Value')}</p>
          <p className="text-3xl font-bold text-gray-900">{formatPrice(analytics.keyMetrics.avgOrderValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.analytics.metrics.perOrder', 'Per order')}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">{t('admin.analytics.metrics.activeVendors', 'Active Vendors')}</p>
          <p className="text-3xl font-bold text-gray-900">{analytics.keyMetrics.totalVendors}</p>
          <p className="text-xs text-gray-400 mt-1">{analytics.keyMetrics.totalDrivers} {t('admin.analytics.metrics.drivers', 'drivers')}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">{t('admin.analytics.metrics.totalUsers', 'Total Users')}</p>
          <p className="text-3xl font-bold text-gray-900">{analytics.keyMetrics.totalUsers}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.analytics.metrics.buyers', 'Buyers')}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.analytics.charts.ordersOverTime', 'Orders Over Time')}</h3>
          <div className="h-64">
            <Suspense fallback={<ChartSkeleton />}>
              <Line data={analytics.usersGrowthData} options={chartOptions} />
            </Suspense>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.analytics.charts.revenueOverTime', 'Revenue Over Time')}</h3>
          <div className="h-64">
            <Suspense fallback={<ChartSkeleton />}>
              <BarChart data={analytics.revenueData} options={chartOptions} />
            </Suspense>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.analytics.charts.revenueByCategory', 'Revenue by Category')}</h3>
          <div className="h-64">
            <Suspense fallback={<ChartSkeleton />}>
              <DoughnutChart data={analytics.categoryData} options={doughnutOptions} />
            </Suspense>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.analytics.charts.topVendors', 'Top Vendors')}</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {analytics.topVendors.slice(0, 10).map((vendor, index) => (
              <div key={vendor.vendor_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-6">#{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{vendor.store_name}</p>
                    <p className="text-xs text-gray-500">{vendor.orders} {t('admin.analytics.metrics.orders', 'orders')} &bull; {vendor.products} {t('admin.analytics.metrics.products', 'products')}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatPrice(vendor.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Category Breakdown Table */}
      {analytics.categoryBreakdown.length > 0 && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.analytics.charts.categoryBreakdown', 'Category Breakdown')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">{t('admin.analytics.categoryTable.category', 'Category')}</th>
                  <th className="text-right py-2 font-medium text-gray-600">{t('admin.analytics.categoryTable.orders', 'Orders')}</th>
                  <th className="text-right py-2 font-medium text-gray-600">{t('admin.analytics.categoryTable.revenue', 'Revenue')}</th>
                  <th className="text-right py-2 font-medium text-gray-600">{t('admin.analytics.categoryTable.avgOrder', 'Avg Order')}</th>
                  <th className="text-right py-2 font-medium text-gray-600">{t('admin.analytics.categoryTable.share', 'Share')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.categoryBreakdown.map((cat, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{cat.category}</td>
                    <td className="py-2 text-right text-gray-600">{cat.orders}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{formatPrice(cat.revenue)}</td>
                    <td className="py-2 text-right text-gray-600">{formatPrice(cat.avgOrder)}</td>
                    <td className="py-2 text-right text-gray-600">{cat.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default AdminAnalytics
