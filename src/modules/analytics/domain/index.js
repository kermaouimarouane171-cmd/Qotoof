/**
 * Analytics Module — Domain Layer (re-export)
 *
 * Placeholder: analytics domain logic (KPI calculations, chart data building,
 * metric aggregation) is embedded in vendorAnalytics.js as pure functions.
 * Key domain concepts:
 *   - Revenue calculation: getOrderRevenue(order) — resolves vendor_amount → payment_received_amount → actual_sale_amount → total
 *   - Time bucketing: buildTimeBuckets (day/week/month granularity)
 *   - KPI metrics: calculateVendorAnalyticsMetrics (totalRevenue, totalOrders, avgOrderValue, repeatCustomers, avgDeliveryTime, fulfillmentRate, avgReviewResponseHours, reviewReplyRate, averageRating, lowStockProducts)
 *   - Chart data: buildRevenueChartData, buildOrdersChartData, buildRatingsTrendData, buildTopProductsChartData, buildCategoryDistributionData
 *   - Status breakdown: buildStatusBreakdown
 *   - Report generation: reportService.generateSalesReport, generateUserReport, generateInventoryReport, generateDeliveryReport
 * These functions are re-exported from the api layer. No domain-specific exports here yet.
 */
