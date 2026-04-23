/**
 * 💀 Skeleton Loaders - Better UX during loading states
 * Provides visual placeholders that mimic the actual content
 */

// ============================================
// 1. BASE SKELETON COMPONENT
// ============================================

/**
 * Skeleton - Base skeleton component with pulse animation
 */
export const Skeleton = ({ className = '', variant = 'rectangular', ...props }) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700'
  const variantClasses = variant === 'circular' ? 'rounded-full' : 'rounded'

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    />
  )
}

// ============================================
// 2. CARD SKELETONS
// ============================================

/**
 * ProductCardSkeleton - For product listing cards
 */
export const ProductCardSkeleton = ({ count = 4 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Image */}
          <Skeleton className="w-full h-48" />

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <Skeleton className="h-5 w-3/4" />

            {/* Vendor */}
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>

            {/* Price */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * OrderCardSkeleton - For order cards
 */
export const OrderCardSkeleton = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * StoreCardSkeleton - For store cards
 */
export const StoreCardSkeleton = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Cover */}
          <Skeleton className="w-full h-32" />

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Avatar */}
            <div className="-mt-12">
              <Skeleton className="w-20 h-20 rounded-full border-4 border-white" />
            </div>

            {/* Name */}
            <Skeleton className="h-6 w-2/3" />

            {/* Description */}
            <Skeleton className="h-4 w-full" />

            {/* Stats */}
            <div className="flex gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// ============================================
// 3. TABLE SKELETON
// ============================================

/**
 * TableSkeleton - For data tables
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// 4. LIST SKELETONS
// ============================================

/**
 * ListSkeleton - For list items
 */
export const ListSkeleton = ({ count = 5, height = 'h-16' }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`flex items-center gap-4 p-4 bg-white rounded-lg ${height}`}>
          <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * TextListSkeleton - For text-only lists (like notifications)
 */
export const TextListSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="p-4 bg-white rounded-lg space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// 5. DASHBOARD SKELETONS
// ============================================

/**
 * DashboardSkeleton - For dashboard pages
 */
export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl p-6 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-6">
        <Skeleton className="h-6 w-1/4 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* Recent Items */}
      <div className="bg-white rounded-xl p-6">
        <Skeleton className="h-6 w-1/4 mb-4" />
        <ListSkeleton count={3} />
      </div>
    </div>
  )
}

/**
 * AnalyticsSkeleton - For analytics pages
 */
export const AnalyticsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-1/3" />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// 6. FORM SKELETONS
// ============================================

/**
 * FormSkeleton - For forms loading
 */
export const FormSkeleton = ({ fields = 5 }) => {
  return (
    <div className="bg-white rounded-xl p-6 space-y-4">
      {/* Title */}
      <Skeleton className="h-7 w-1/4 mb-6" />

      {/* Fields */}
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

// ============================================
// 7. DETAIL PAGE SKELETONS
// ============================================

/**
 * ProductDetailSkeleton - For product detail page
 */
export const ProductDetailSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <Skeleton className="w-full h-96" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Title & Price */}
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-1/3" />

          {/* Vendor */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-1/2" />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ProfileSkeleton - For profile pages
 */
export const ProfileSkeleton = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 text-center space-y-2">
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl p-6 space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

// ============================================
// 8. CHART SKELETONS
// ============================================

// ChartSkeleton is now a standalone component in ChartSkeleton.jsx

// ============================================
// 9. MAP SKELETON
// ============================================

/**
 * MapSkeleton - For map containers
 */
export const MapSkeleton = () => {
  return (
    <div className="relative w-full h-96 bg-gray-100 rounded-xl overflow-hidden">
      {/* Grid pattern to simulate map */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={`h-${i}`} className="absolute w-full border-t border-gray-400" style={{ top: `${i * 5}%` }} />
        ))}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={`v-${i}`} className="absolute h-full border-l border-gray-400" style={{ left: `${i * 5}%` }} />
        ))}
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading map...</p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 10. COMPOSITE SKELETONS
// ============================================

/**
 * PageSkeleton - Full page loading skeleton
 */
export const PageSkeleton = ({ variant = 'default' }) => {
  const skeletons = {
    default: <DashboardSkeleton />,
    product: <ProductDetailSkeleton />,
    profile: <ProfileSkeleton />,
    form: <FormSkeleton />,
    table: <TableSkeleton />,
    list: <ListSkeleton />,
  }

  return skeletons[variant] || skeletons.default
}

// ============================================
// 11. LOADING OVERLAY
// ============================================

/**
 * LoadingOverlay - Full screen loading overlay with skeleton
 */
export const LoadingOverlay = ({ message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  )
}

// ============================================
// Default export
// ============================================
export default {
  Skeleton,
  ProductCardSkeleton,
  OrderCardSkeleton,
  StoreCardSkeleton,
  TableSkeleton,
  ListSkeleton,
  TextListSkeleton,
  DashboardSkeleton,
  AnalyticsSkeleton,
  FormSkeleton,
  ProductDetailSkeleton,
  ProfileSkeleton,
  MapSkeleton,
  PageSkeleton,
  LoadingOverlay,
}
