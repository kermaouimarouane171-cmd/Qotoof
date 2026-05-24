import { Suspense } from 'react'
import { Card, ChartSkeleton } from '@/components/ui'
import { ArrowUpIcon } from '@heroicons/react/24/outline'

export default function RevenueChart({ salesChartData, chartOptions, LineComponent, t }) {
  return (
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
            <LineComponent data={salesChartData} options={chartOptions} />
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
  )
}