/**
 * Chart loading skeleton component
 * Used as fallback for lazy-loaded chart components
 */
const ChartSkeleton = ({ title = true }) => (
  <div className="animate-pulse space-y-4 p-4">
    {title && (
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
    )}
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    <div className="flex gap-4">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
    </div>
  </div>
)

export default ChartSkeleton
