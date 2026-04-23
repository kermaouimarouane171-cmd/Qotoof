// ============================================
// UI Components Index
// Central export point for all UI components
// ============================================

// Core Components
export { default as Button } from './Button'
export { default as Input } from './Input'
export { default as Modal } from './Modal'
export { default as Card } from './Card'
export { default as Badge } from './Badge'
export { default as StarRating } from './StarRating'
export { default as SimpleRating } from './SimpleRating'
export { default as LoadingSpinner } from './LoadingSpinner'
export { default as Toggle } from './Toggle'
export { default as ProductCard } from './ProductCard'
export { default as Map } from './Map'
export { default as ChatComponent } from './ChatComponent'
export { default as OrderTimeline } from './OrderTimeline'
export { default as CINInput } from './CINInput'
export { default as TrustBadges } from './TrustBadges'
export { default as VehiclePhotoUpload } from './VehiclePhotoUpload'
export { default as MoroccoNotice } from './MoroccoNotice'
export { default as DriverSelection } from './DriverSelection'
export { default as NoDriverAvailable } from './NoDriverAvailable'
export { default as VendorWaitResponse } from './VendorWaitResponse'
export { default as DriverAvailabilityToggle } from './DriverAvailabilityToggle'
export { default as DeliveryRequestCard } from './DeliveryRequestCard'
export { default as Receipt } from './Receipt'
export { default as VendorGuidelines } from './VendorGuidelines'
export { default as VendorAlerts } from './VendorAlerts'
export { default as GeographicDeliveryNotification } from './GeographicDeliveryNotification'
export { default as Recaptcha } from './Recaptcha'

// Performance Optimized Components
export {
  OptimizedImage,
  ImageGallery,
  ResponsiveImage,
  preloadImage,
  preloadImages,
  useLazyImage,
  imageCache,
} from './OptimizedImage'

// Location Picker
export { default as LocationPicker } from './LocationPicker'

// Skeleton Loaders
export {
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
} from './SkeletonLoaders'

// Chart Skeleton (standalone component)
export { default as ChartSkeleton } from './ChartSkeleton'

// Accessibility Components (from utils)
export {
  AccessibleTooltip,
  AccessibleTabs,
  AccessibleAccordion,
  SkipLink,
  AccessibleFormField,
  LiveRegion,
} from '@/utils/accessibility.jsx'
