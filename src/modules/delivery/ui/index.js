// ============================================
// Delivery Module — UI Public API
// Re-exports driver pages and delivery-related UI components.
// No files were moved — this is a re-export layer.
// ============================================

// ── Driver Pages ──────────────────────────────────────────────────────────────

export { default as DriverDashboardPage } from '@/pages/driver/Dashboard'
export { default as DriverAvailablePage } from '@/pages/driver/Available'
export { default as DriverActivePage } from '@/pages/driver/Active'
export { default as DriverEarningsPage } from '@/pages/driver/Earnings'
export { default as DriverHistoryPage } from '@/pages/driver/History'
export { default as DriverProfilePage } from '@/pages/driver/Profile'
export { default as DriverSettingsPage } from '@/pages/driver/Settings'
export { default as DriverSecurityPage } from '@/pages/driver/Security'
export { default as DriverFindVendorPage } from '@/pages/driver/FindVendor'
export { default as DriverVendorPreferenceSetupPage } from '@/pages/driver/VendorPreferenceSetup'
export { default as DeliveryPickupPage } from '@/pages/driver/DeliveryPickup'
export { default as DeliveryTrackingPage } from '@/pages/driver/DeliveryTracking'
export { default as DeliveryCompletePage } from '@/pages/driver/DeliveryComplete'

// ── Vendor Delivery-Related Pages ─────────────────────────────────────────────

export { default as VendorDeliveryOptionSetupPage } from '@/pages/vendor/DeliveryOptionSetup'
export { default as VendorDriverPreferenceSetupPage } from '@/pages/vendor/DriverPreferenceSetup'
export { default as VendorFindDriverPage } from '@/pages/vendor/FindDriver'

// ── Admin Driver-Related Pages ────────────────────────────────────────────────

export { default as AdminDriversPage } from '@/pages/admin/Drivers'
export { default as AdminDriverVerificationPage } from '@/pages/admin/DriverVerification'

// ── Onboarding ────────────────────────────────────────────────────────────────

export { default as DriverOnboardingPage } from '@/pages/onboarding/DriverOnboarding'

// ── Delivery-Related Components ───────────────────────────────────────────────

export { default as LiveDriverMap } from '@/components/maps/LiveDriverMap'
export { default as DeliveryRequestCard } from '@/components/ui/DeliveryRequestCard'
export { default as GeographicDeliveryNotification } from '@/components/ui/GeographicDeliveryNotification'
export { default as DriverAvailabilityToggle } from '@/components/ui/DriverAvailabilityToggle'
export { default as DriverSelection } from '@/components/ui/DriverSelection'
export { default as NoDriverAvailable } from '@/components/ui/NoDriverAvailable'
export { default as DeliveryPreferences } from '@/components/driver/DeliveryPreferences'
export { default as DeliveryPaymentPolicy } from '@/components/driver/DeliveryPaymentPolicy'
export { default as DriverVerification } from '@/components/driver/DriverVerification'
export { default as DeliveryCompleteComponent } from '@/components/driver/DeliveryComplete'
