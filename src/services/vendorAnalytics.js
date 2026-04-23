import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'

export const DATE_RANGES = [
  { id: '7d', label: 'Last 7 Days', labelAr: 'آخر 7 أيام', days: 7, granularity: 'day' },
  { id: '30d', label: 'Last 30 Days', labelAr: 'آخر 30 يوم', days: 30, granularity: 'day' },
  { id: '3m', label: 'Last 3 Months', labelAr: 'آخر 3 أشهر', days: 90, granularity: 'week' },
  { id: '6m', label: 'Last 6 Months', labelAr: 'آخر 6 أشهر', days: 180, granularity: 'week' },
  { id: '1y', label: 'Last Year', labelAr: 'آخر سنة', days: 365, granularity: 'month' },
]

const LOW_STOCK_THRESHOLD = 10
const COMPLETED_STATUSES = new Set(['delivered', 'completed'])

const toDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getOrderRevenue = (order = {}) => {
  return toNumber(order.vendor_amount ?? order.payment_received_amount ?? order.actual_sale_amount ?? order.total)
}

export const resolveVendorAnalyticsRange = ({
  selectedRange = '30d',
  customDateFrom = '',
  customDateTo = '',
  now = new Date(),
} = {}) => {
  if (selectedRange === 'custom' && customDateFrom && customDateTo) {
    const startDate = toDate(customDateFrom)
    const endDate = toDate(customDateTo)

    if (!startDate || !endDate) {
      throw new Error('Custom analytics dates are invalid.')
    }

    endDate.setHours(23, 59, 59, 999)
    const diffInDays = Math.max(Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)), 1)
    const granularity = diffInDays > 180 ? 'month' : diffInDays > 90 ? 'week' : 'day'

    return {
      startDate,
      endDate,
      granularity,
      label: 'Custom Range',
      labelAr: 'نطاق مخصص',
    }
  }

  const preset = DATE_RANGES.find((range) => range.id === selectedRange) || DATE_RANGES[1]
  return {
    startDate: subDays(now, preset.days),
    endDate: now,
    granularity: preset.granularity,
    label: preset.label,
    labelAr: preset.labelAr,
  }
}

export const buildTimeBuckets = ({ startDate, endDate, granularity = 'day' }) => {
  const buckets = []
  const labels = []

  if (granularity === 'month') {
    eachMonthOfInterval({ start: startDate, end: endDate }).forEach((month) => {
      const bucketStart = startOfMonth(month)
      const bucketEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)
      buckets.push({ start: bucketStart, end: bucketEnd })
      labels.push(format(bucketStart, 'MMM yy'))
    })
    return { buckets, labels }
  }

  if (granularity === 'week') {
    eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 }).forEach((week) => {
      const bucketStart = startOfWeek(week, { weekStartsOn: 1 })
      const bucketEnd = endOfWeek(week, { weekStartsOn: 1 })
      buckets.push({ start: bucketStart, end: bucketEnd })
      labels.push(format(bucketStart, 'dd/MM'))
    })
    return { buckets, labels }
  }

  eachDayOfInterval({ start: startDate, end: endDate }).forEach((day) => {
    const bucketStart = new Date(day)
    const bucketEnd = new Date(day)
    bucketEnd.setHours(23, 59, 59, 999)
    buckets.push({ start: bucketStart, end: bucketEnd })
    labels.push(format(bucketStart, 'dd/MM'))
  })

  return { buckets, labels }
}

const buildBucketValues = (items = [], buckets = [], getDateValue, aggregate) => {
  return buckets.map((bucket) => {
    const bucketItems = items.filter((item) => {
      const itemDate = toDate(getDateValue(item))
      return itemDate && itemDate >= bucket.start && itemDate <= bucket.end
    })
    return aggregate(bucketItems)
  })
}

export const buildRevenueChartData = ({ orders = [], buckets = [], labels = [], label = 'Revenue (MAD)' }) => ({
  labels,
  datasets: [
    {
      label,
      data: buildBucketValues(orders, buckets, (order) => order.created_at, (bucketOrders) => {
        return bucketOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0)
      }),
      borderColor: '#16a34a',
      backgroundColor: 'rgba(22, 163, 74, 0.12)',
      fill: true,
      tension: 0.35,
    },
  ],
})

export const buildOrdersChartData = ({ orders = [], buckets = [], labels = [], label = 'Orders' }) => ({
  labels,
  datasets: [
    {
      label,
      data: buildBucketValues(orders, buckets, (order) => order.created_at, (bucketOrders) => bucketOrders.length),
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.18)',
      fill: true,
      tension: 0.35,
    },
  ],
})

export const buildRatingsTrendData = ({ reviews = [], buckets = [], labels = [], label = 'Average Rating' }) => ({
  labels,
  datasets: [
    {
      label,
      data: buildBucketValues(reviews, buckets, (review) => review.created_at, (bucketReviews) => {
        if (bucketReviews.length === 0) return 0
        return Number((bucketReviews.reduce((sum, review) => sum + toNumber(review.rating), 0) / bucketReviews.length).toFixed(2))
      }),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
      fill: true,
      tension: 0.35,
    },
  ],
})

export const buildTopProductMetrics = ({ orders = [], products = [] }) => {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const metrics = new Map()

  orders.forEach((order) => {
    order.order_items?.forEach((item) => {
      const existing = metrics.get(item.product_id) || {
        productId: item.product_id,
        name: 'منتج',
        category: 'other',
        quantity: 0,
        revenue: 0,
      }
      const product = productMap.get(item.product_id)
      existing.name = product?.name || existing.name
      existing.category = product?.category || existing.category
      existing.quantity += toNumber(item.quantity)
      existing.revenue += toNumber(item.unit_price) * toNumber(item.quantity)
      metrics.set(item.product_id, existing)
    })
  })

  return Array.from(metrics.values()).sort((left, right) => right.revenue - left.revenue)
}

export const buildTopProductsChartData = ({ topProducts = [], label = 'Revenue', metric = 'revenue' }) => ({
  labels: topProducts.map((product) => product.name),
  datasets: [
    {
      label,
      data: topProducts.map((product) => toNumber(product[metric])),
      backgroundColor: ['rgba(22, 163, 74, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(249, 115, 22, 0.8)', 'rgba(168, 85, 247, 0.8)', 'rgba(236, 72, 153, 0.8)'],
    },
  ],
})

export const buildCategoryDistributionData = ({ topProducts = [] }) => {
  const totals = topProducts.reduce((accumulator, product) => {
    const category = product.category || 'other'
    accumulator[category] = (accumulator[category] || 0) + toNumber(product.revenue)
    return accumulator
  }, {})

  return {
    labels: Object.keys(totals),
    datasets: [
      {
        data: Object.values(totals),
        backgroundColor: ['rgba(22, 163, 74, 0.8)', 'rgba(249, 115, 22, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(168, 85, 247, 0.8)', 'rgba(236, 72, 153, 0.8)'],
      },
    ],
  }
}

export const buildStatusBreakdown = (orders = []) => {
  return Object.entries(orders.reduce((accumulator, order) => {
    const status = order.status || 'unknown'
    accumulator[status] = (accumulator[status] || 0) + 1
    return accumulator
  }, {})).sort((left, right) => right[1] - left[1])
}

export const calculateVendorAnalyticsMetrics = ({ orders = [], reviews = [], products = [] }) => {
  const totalRevenue = orders.reduce((sum, order) => sum + getOrderRevenue(order), 0)
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const buyerOrderCount = orders.reduce((accumulator, order) => {
    if (order.buyer_id) {
      accumulator[order.buyer_id] = (accumulator[order.buyer_id] || 0) + 1
    }
    return accumulator
  }, {})
  const repeatBuyers = Object.values(buyerOrderCount).filter((count) => count > 1).length
  const uniqueBuyers = Object.keys(buyerOrderCount).length
  const repeatCustomers = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0

  const deliveredOrders = orders.filter((order) => toDate(order.delivered_at) && toDate(order.created_at))
  const avgDeliveryTime = deliveredOrders.length > 0
    ? Number((deliveredOrders.reduce((sum, order) => {
      return sum + ((toDate(order.delivered_at) - toDate(order.created_at)) / (1000 * 60 * 60 * 24))
    }, 0) / deliveredOrders.length).toFixed(1))
    : 0

  const fulfilledOrders = orders.filter((order) => COMPLETED_STATUSES.has(order.status)).length
  const fulfillmentRate = totalOrders > 0 ? Math.round((fulfilledOrders / totalOrders) * 100) : 0

  const reviewsWithReply = reviews.filter((review) => review.vendor_reply_at)
  const avgReviewResponseHours = reviewsWithReply.length > 0
    ? Number((reviewsWithReply.reduce((sum, review) => {
      return sum + ((toDate(review.vendor_reply_at) - toDate(review.created_at)) / (1000 * 60 * 60))
    }, 0) / reviewsWithReply.length).toFixed(1))
    : 0
  const reviewReplyRate = reviews.length > 0 ? Math.round((reviewsWithReply.length / reviews.length) * 100) : 0
  const averageRating = reviews.length > 0
    ? Number((reviews.reduce((sum, review) => sum + toNumber(review.rating), 0) / reviews.length).toFixed(2))
    : 0

  const lowStockProducts = products.filter((product) => toNumber(product.stock_quantity) > 0 && toNumber(product.stock_quantity) <= LOW_STOCK_THRESHOLD).length

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    repeatCustomers,
    avgDeliveryTime,
    fulfillmentRate,
    avgReviewResponseHours,
    reviewReplyRate,
    averageRating,
    lowStockProducts,
  }
}

export const buildAnalyticsCsvRows = ({ orders = [] }) => {
  return orders.map((order) => ({
    orderId: order.id,
    date: order.created_at,
    status: order.status,
    totalRevenue: getOrderRevenue(order).toFixed(2),
    itemsCount: order.order_items?.length || 0,
    buyerId: order.buyer_id || '',
  }))
}

export const buildAnalyticsPdfSummary = ({ rangeLabel = '', metrics = {}, topProducts = [] }) => {
  return [
    `Range: ${rangeLabel}`,
    `Total revenue: ${toNumber(metrics.totalRevenue).toFixed(2)} MAD`,
    `Total orders: ${toNumber(metrics.totalOrders)}`,
    `Average order value: ${toNumber(metrics.avgOrderValue).toFixed(2)} MAD`,
    `Repeat customers: ${toNumber(metrics.repeatCustomers)}%`,
    `Fulfillment rate: ${toNumber(metrics.fulfillmentRate)}%`,
    `Average delivery time: ${toNumber(metrics.avgDeliveryTime).toFixed(1)} days`,
    `Average review response: ${toNumber(metrics.avgReviewResponseHours).toFixed(1)} hours`,
    `Review reply rate: ${toNumber(metrics.reviewReplyRate)}%`,
    `Average rating: ${toNumber(metrics.averageRating).toFixed(2)} / 5.0`,
    `Low stock products: ${toNumber(metrics.lowStockProducts)}`,
    '',
    'Top products by revenue:',
    ...topProducts.slice(0, 5).map((product, index) => `${index + 1}. ${product.name} - ${toNumber(product.revenue).toFixed(2)} MAD (${toNumber(product.quantity)} units)`),
  ]
}