# Delivery Module

## Purpose

The delivery module encapsulates all delivery and driver operations:
- Delivery data access (read, create, update delivery records)
- Driver assignment (assign driver to delivery, driver accept/reject)
- Delivery tracking (real-time location updates, GPS tracking)
- Driver dashboard (active deliveries, available deliveries, stats)
- Driver history (completed deliveries, past records)
- Driver earnings (earnings calculation, payout info)
- Driver profile and settings (vehicle info, delivery preferences)
- Delivery eligibility logic (zone-based minimum order, distance checks)
- Delivery matching (matching drivers to deliveries, nearest driver search)
- Delivery scheduling (delivery slots, cutoff times, capacity)
- Driver location service (real-time GPS tracking, browser sessions)
- Vendor delivery preferences (delivery option setup, driver preference)
- Admin driver management (driver list, verification)
- Driver onboarding flow
- Delivery-related UI components (LiveDriverMap, DeliveryRequestCard, etc.)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`, `src/config/`, `src/pages/`,
`src/components/`, `src/hooks/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain/constants, and hooks.

```js
import {
  // API / Services
  createDelivery, fetchDeliveryById, updateDeliveryStatus,
  assignDriver, markDelivered, subscribeToDeliveryUpdates,
  deliveriesApi,
  deliveryMatchingService,
  checkDeliveryEligibility, normalizeEligibilityLocation,
  deliveryScheduleService, deliveryScheduleServiceDefault,
  driverLocationService,
  // deliveryMatchingService named exports
  CARGO_SIZE_OPTIONS, DRIVER_DELIVERY_PAYMENT_OPTIONS, DRIVER_SELECT,
  normalizeCargoSize, normalizeDriverDeliveryPaymentMethod,
  getCargoSizeLabel, getDriverDeliveryPaymentMethodLabel,
  normalizeDriverPreferences, driverSupportsPaymentMethod,
  getDriverSupportedPaymentMethods, doesDriverMatchDelivery,
  getAvailableDriversForCheckout, getMatchingDeliveriesForDriver,
  isDriverEligibleForOrder, calculateDistance, calculateDeliveryFee,
  getRegionFromCoords, calculateTieredDeliveryFee,
  findNearestDrivers, createDeliveryRequest,
  // deliveryScheduleService named exports
  getDeliveryDayOfWeek, isSlotPastCutoff, decorateDeliverySlot,
  buildDeliveryScheduleSnapshot,

  // Domain / Constants
  DRIVER_CONFIG, DRIVER_STATUSES, DELIVERY_STATUSES,
  EARNING_STATUSES, DRIVER_ERRORS, DRIVER_SUCCESS,
  DRIVER_QUERY_LIMITS, DRIVER_VALIDATION, driverConfig,

  // Hooks
  driverKeys, useDriverProfile, useDriverDeliveries,
  useDeliveryDetail, useAvailableDeliveries, useDriverStats,
  useDriverEarnings, useUpdateDriverProfile, useAcceptDelivery,
  useUpdateDeliveryStatus, useUpdateDriverLocation,
  useToggleDriverAvailability,
} from '@/modules/delivery'
```

### Intentionally NOT Exported from Root (Phase 6.17)

UI/page-level exports were removed from the root barrel to prevent eager loading of `LiveDriverMap` → `Map.jsx` → Leaflet when importing lightweight symbols (APIs, domain helpers, hooks).

| Symbol | Available Via |
|---|---|
| `DriverDashboardPage` | `lazy(() => import('@/pages/driver/Dashboard'))` or `@/modules/delivery/ui` |
| `DriverAvailablePage` | `lazy(() => import('@/pages/driver/Available'))` or `@/modules/delivery/ui` |
| `DriverActivePage` | `lazy(() => import('@/pages/driver/Active'))` or `@/modules/delivery/ui` |
| `DriverEarningsPage` | `lazy(() => import('@/pages/driver/Earnings'))` or `@/modules/delivery/ui` |
| `DriverHistoryPage` | `lazy(() => import('@/pages/driver/History'))` or `@/modules/delivery/ui` |
| `DriverProfilePage` | `lazy(() => import('@/pages/driver/Profile'))` or `@/modules/delivery/ui` |
| `DriverSettingsPage` | `lazy(() => import('@/pages/driver/Settings'))` or `@/modules/delivery/ui` |
| `DriverSecurityPage` | `lazy(() => import('@/pages/driver/Security'))` or `@/modules/delivery/ui` |
| `DriverFindVendorPage` | `lazy(() => import('@/pages/driver/FindVendor'))` or `@/modules/delivery/ui` |
| `DriverVendorPreferenceSetupPage` | `lazy(() => import('@/pages/driver/VendorPreferenceSetup'))` or `@/modules/delivery/ui` |
| `DeliveryPickupPage` | `lazy(() => import('@/pages/driver/DeliveryPickup'))` or `@/modules/delivery/ui` |
| `DeliveryTrackingPage` | `lazy(() => import('@/pages/driver/DeliveryTracking'))` or `@/modules/delivery/ui` |
| `DeliveryCompletePage` | `lazy(() => import('@/pages/driver/DeliveryComplete'))` or `@/modules/delivery/ui` |
| `VendorDeliveryOptionSetupPage` | `lazy(() => import('@/pages/vendor/DeliveryOptionSetup'))` or `@/modules/delivery/ui` |
| `VendorDriverPreferenceSetupPage` | `lazy(() => import('@/pages/vendor/DriverPreferenceSetup'))` or `@/modules/delivery/ui` |
| `VendorFindDriverPage` | `lazy(() => import('@/pages/vendor/FindDriver'))` or `@/modules/delivery/ui` |
| `AdminDriversPage` | `lazy(() => import('@/pages/admin/Drivers'))` or `@/modules/delivery/ui` |
| `AdminDriverVerificationPage` | `lazy(() => import('@/pages/admin/DriverVerification'))` or `@/modules/delivery/ui` |
| `DriverOnboardingPage` | `lazy(() => import('@/pages/onboarding/DriverOnboarding'))` or `@/modules/delivery/ui` |
| `LiveDriverMap` | `@/components/maps/LiveDriverMap` or `@/modules/delivery/ui` |
| `DeliveryRequestCard` | `@/components/ui/DeliveryRequestCard` or `@/modules/delivery/ui` |
| `GeographicDeliveryNotification` | `@/components/ui/GeographicDeliveryNotification` or `@/modules/delivery/ui` |
| `DriverAvailabilityToggle` | `@/components/ui/DriverAvailabilityToggle` or `@/modules/delivery/ui` |
| `DriverSelection` | `@/components/ui/DriverSelection` or `@/modules/delivery/ui` |
| `NoDriverAvailable` | `@/components/ui/NoDriverAvailable` or `@/modules/delivery/ui` |
| `DeliveryPreferences` | `@/components/driver/DeliveryPreferences` or `@/modules/delivery/ui` |
| `DeliveryPaymentPolicy` | `@/components/driver/DeliveryPaymentPolicy` or `@/modules/delivery/ui` |
| `DriverVerification` | `@/components/driver/DriverVerification` or `@/modules/delivery/ui` |
| `DeliveryCompleteComponent` | `@/components/driver/DeliveryComplete` or `@/modules/delivery/ui` |

### UI / Page Import Policy

App code should import delivery pages via lazy imports from original paths:
```js
const DriverDashboardPage = lazy(() => import('@/pages/driver/Dashboard'))
const DeliveryTrackingPage = lazy(() => import('@/pages/driver/DeliveryTracking'))
```

Delivery components should be imported from their original component paths:
```js
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import DeliveryRequestCard from '@/components/ui/DeliveryRequestCard'
```

UI exports remain available through `src/modules/delivery/ui/index.js` for intra-module use only.

## Structure

```
src/modules/delivery/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← deliveries.js, deliveryMatchingService, deliveryEligibilityService, deliveryScheduleService, driverLocationService
├── data/
│   └── index.js      ← Placeholder (no dedicated delivery repository yet)
├── domain/
│   └── index.js      ← driver.config.js constants
├── ui/
│   └── index.js      ← Driver pages + vendor delivery pages + admin driver pages + delivery components
├── hooks/
│   └── index.js      ← useDriverQueries (driver profile, deliveries, stats, earnings, mutations)
├── stores/
│   └── index.js      ← Placeholder (no dedicated delivery store yet)
├── utils/
│   └── index.js      ← Placeholder (future delivery utilities)
└── README.md         ← This file
```

## What Belongs in Delivery

- Delivery data access (read, create, update delivery records)
- Driver assignment (assign driver to delivery)
- Driver accept/reject delivery
- Delivery tracking (real-time location updates, GPS tracking)
- Driver dashboard (active deliveries, available deliveries, stats)
- Driver history (completed deliveries, past records)
- Driver earnings (earnings calculation, payout info)
- Driver profile and settings (vehicle info, delivery preferences)
- Delivery eligibility logic (zone-based minimum order, distance checks)
- Delivery matching (matching drivers to deliveries, nearest driver search)
- Delivery scheduling (delivery slots, cutoff times, capacity)
- Driver location service (real-time GPS tracking, browser sessions)
- Vendor delivery preferences (delivery option setup, driver preference setup)
- Admin driver management (driver list, verification)
- Driver onboarding flow
- Delivery-related UI components (LiveDriverMap, DeliveryRequestCard, etc.)
- Driver query hooks (React Query: useDriverDeliveries, useDriverStats, etc.)
- Driver configuration constants (commission rates, statuses, validation)

## What Does NOT Belong in Delivery

- Order lifecycle ownership (belongs in `orders` module)
- Order status transitions (belongs in `orders` module)
- Payment provider integration (belongs in `payments` module)
- Checkout process orchestration (belongs in `checkout` module)
- Cart state (belongs in `cart` module)
- Product catalog ownership (belongs in `catalog` module)
- Product browsing (belongs in `marketplace` module)
- Auth/session logic (belongs in `auth` module)
- User profile ownership (belongs in `users` module)
- Admin dashboard composition (belongs in `admin` or `app` module)
- Notification delivery implementation (belongs in `notifications` module)

## Relationship with Orders

- **Orders owns order lifecycle.** Delivery owns delivery state and driver operations.
- Delivery records reference `order_id` — deliveries are created for orders.
- `deliveries.js` exports an `ordersApi` object (vendor accept/reject order, order subscriptions) — this is an **orders concern misplaced in deliveries.js**. It is NOT re-exported from the delivery module. It is documented as a migration candidate.
- `deliveriesApi` in `deliveries.js` contains delivery-specific operations (getDriverDeliveries, acceptDelivery, rejectDelivery, markPickedUp, markOnTheWay, markDelivered, etc.) — these ARE re-exported from the delivery module.
- Future order synchronization should use the documented event contract:
  ```
  order:delivery_updated
  payload: { orderId, deliveryStatus, deliveryId, driverId, occurredAt }
  ```
- **Do not implement this event system in this sprint.**

## Relationship with Users

- **Users owns driver/vendor profile data.**
- Delivery may consume public user/profile info if needed.
- Delivery must not own user profiles.
- Driver pages import `useAuthStore` for current user/profile — this is an auth concern, not a delivery ownership.
- `driver/Settings.jsx` imports `profilesService` — this is a users concern.
- `driver/Profile.jsx` directly queries `profiles` table via Supabase — this is a users concern.

## Relationship with Notifications

- Delivery may request notifications in the future.
- Delivery must not own notification delivery logic.
- Currently no direct notification insertion from delivery services.

## Relationship with Payments

- **Payments owns payment provider integration and payment records.**
- Delivery does not directly import payment services.
- `deliveriesApi` contains `updateLocation` which updates `deliveries` table — this is delivery concern.
- Driver earnings are calculated via `get_driver_earnings` RPC — this queries `deliveries` table, not payments.
- `driver/Settings.jsx` imports `hasValidPayPalEmail` from `@/utils/paypalEligibility` — this is a payments concern coupled to driver settings.

## Relationship with Checkout

- **Checkout creates deliveries** — `checkoutService.js` and `CheckoutSimplified.jsx` call `deliveryMatchingService.getAvailableDriversForCheckout` and `createDeliveryRequest`.
- `components/checkout/DriverSelectionStep.jsx` is a checkout concern that uses delivery matching.
- Delivery module does not own checkout UI or process.

## Event Contracts (Future — Not Implemented in This Sprint)

### order:delivery_updated
```
payload: {
  orderId: string,
  deliveryStatus: string,
  deliveryId: string,
  driverId: string,
  occurredAt: string (ISO 8601)
}
```

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/modules/auth` — auth public API for current user/role
- `@/modules/users` — users public API for driver/vendor profile info
- `@/modules/orders` — orders public API only for safe order read references if already needed
- `@/services/supabase` — Supabase client
- `@/utils/` — general utilities (currency, logger, sanitization)
- `@/lib/config` — app config
- `@/constants/` — shared constants

## Forbidden Dependencies

- `@/modules/checkout` — checkout module (checkout creates deliveries; delivery does not import checkout)
- `@/modules/payments` — payments module (use event contract instead)
- `@/modules/admin` — admin dashboard composition
- `@/modules/marketplace` — marketplace module
- `@/modules/cart` — cart module
- `@/modules/catalog` — catalog module

## Migration Candidates for Future Sprints

| File | Current Location | Target | Sprint | Notes |
|---|---|---|---|---|
| `deliveries.js` | `@/services/deliveries` | `@/modules/delivery/api/` | 3.x | 533 lines, contains deliveriesApi + ordersApi (naming conflict) |
| `deliveryMatchingService.js` | `@/services/deliveryMatchingService` | `@/modules/delivery/api/` or `domain/` | 3.x | 804 lines, driver matching + fee calculation + geo |
| `deliveryEligibilityService.js` | `@/services/deliveryEligibilityService` | `@/modules/delivery/domain/` | 3.x | 209 lines, eligibility logic |
| `deliveryScheduleService.js` | `@/services/deliveryScheduleService` | `@/modules/delivery/domain/` | 3.x | 186 lines, delivery slot management |
| `driverLocationService.js` | `@/services/driverLocationService` | `@/modules/delivery/api/` | 3.x | 549 lines, GPS tracking |
| `driver.config.js` | `@/config/driver.config` | `@/modules/delivery/domain/` | 3.x | 115 lines, driver constants |
| `useDriverQueries.js` | `@/hooks/queries/useDriverQueries` | `@/modules/delivery/hooks/` | 3.x | 294 lines, driver React Query hooks |
| `driver/Dashboard.jsx` | `@/pages/driver/Dashboard` | `@/modules/delivery/ui/pages/` | 3.x | 485 lines, imports deliveriesApi, realtimeService |
| `driver/Available.jsx` | `@/pages/driver/Available` | `@/modules/delivery/ui/pages/` | 3.x | 248 lines, imports deliveriesApi, deliveryMatchingService |
| `driver/Active.jsx` | `@/pages/driver/Active` | `@/modules/delivery/ui/pages/` | 3.x | 178 lines, imports deliveriesApi |
| `driver/Earnings.jsx` | `@/pages/driver/Earnings` | `@/modules/delivery/ui/pages/` | 3.x | 382 lines, imports supabase directly |
| `driver/History.jsx` | `@/pages/driver/History` | `@/modules/delivery/ui/pages/` | 3.x | 421 lines, imports supabase directly |
| `driver/DeliveryPickup.jsx` | `@/pages/driver/DeliveryPickup` | `@/modules/delivery/ui/pages/` | 3.x | 186 lines, imports deliveriesApi, legalCameraService |
| `driver/DeliveryTracking.jsx` | `@/pages/driver/DeliveryTracking` | `@/modules/delivery/ui/pages/` | 3.x | 621 lines, imports deliveriesApi, driverLocationService |
| `driver/DeliveryComplete.jsx` | `@/pages/driver/DeliveryComplete` | `@/modules/delivery/ui/pages/` | 3.x | 172 lines, imports deliveriesApi, legalCameraService |
| `driver/Settings.jsx` | `@/pages/driver/Settings` | `@/modules/delivery/ui/pages/` | 3.x | 484 lines, imports profilesService, auditLogger, paypalEligibility |
| `driver/Profile.jsx` | `@/pages/driver/Profile` | `@/modules/delivery/ui/pages/` | 3.x | 207 lines, imports supabase directly |
| `driver/Security.jsx` | `@/pages/driver/Security` | `@/modules/delivery/ui/pages/` | 3.x | 313 lines, imports auditLogger, MFASetup, SessionManager — mostly auth concern |
| `driver/FindVendor.jsx` | `@/pages/driver/FindVendor` | `@/modules/delivery/ui/pages/` | 3.x | 420 lines, imports partnershipService |
| `driver/VendorPreferenceSetup.jsx` | `@/pages/driver/VendorPreferenceSetup` | `@/modules/delivery/ui/pages/` | 3.x | 236 lines, imports supabase directly |
| `vendor/DeliveryOptionSetup.jsx` | `@/pages/vendor/DeliveryOptionSetup` | `@/modules/delivery/ui/pages/` | 3.x | 239 lines, imports storeTypeService |
| `vendor/DriverPreferenceSetup.jsx` | `@/pages/vendor/DriverPreferenceSetup` | `@/modules/delivery/ui/pages/` | 3.x | 255 lines, imports supabase directly |
| `vendor/FindDriver.jsx` | `@/pages/vendor/FindDriver` | `@/modules/delivery/ui/pages/` | 3.x | 429 lines, imports partnershipService |
| `admin/Drivers.jsx` | `@/pages/admin/Drivers` | `@/modules/delivery/ui/pages/` or `admin/` | 3.x | 469 lines, imports supabase directly |
| `admin/DriverVerification.jsx` | `@/pages/admin/DriverVerification` | `@/modules/delivery/ui/pages/` or `admin/` | 3.x | 384 lines, imports supabase directly |
| `onboarding/DriverOnboarding.jsx` | `@/pages/onboarding/DriverOnboarding` | `@/modules/delivery/ui/pages/` | 3.x | 54 lines, simple onboarding wrapper |
| `LiveDriverMap.jsx` | `@/components/maps/LiveDriverMap` | `@/modules/delivery/ui/components/` | 3.x | Map component for driver tracking |
| `DeliveryRequestCard.jsx` | `@/components/ui/DeliveryRequestCard` | `@/modules/delivery/ui/components/` | 3.x | Delivery request card |
| `GeographicDeliveryNotification.jsx` | `@/components/ui/GeographicDeliveryNotification` | `@/modules/delivery/ui/components/` | 3.x | Geo delivery notification |
| `DriverAvailabilityToggle.jsx` | `@/components/ui/DriverAvailabilityToggle` | `@/modules/delivery/ui/components/` | 3.x | Availability toggle |
| `DriverSelection.jsx` | `@/components/ui/DriverSelection` | `@/modules/delivery/ui/components/` | 3.x | Driver selection for checkout |
| `NoDriverAvailable.jsx` | `@/components/ui/NoDriverAvailable` | `@/modules/delivery/ui/components/` | 3.x | No driver available message |
| `DeliveryPreferences.jsx` | `@/components/driver/DeliveryPreferences` | `@/modules/delivery/ui/components/` | 3.x | Delivery preferences form |
| `DeliveryPaymentPolicy.jsx` | `@/components/driver/DeliveryPaymentPolicy` | `@/modules/delivery/ui/components/` | 3.x | Payment policy form |
| `DriverVerification.jsx` | `@/components/driver/DriverVerification` | `@/modules/delivery/ui/components/` | 3.x | Driver verification component |
| `DeliveryComplete.jsx` (component) | `@/components/driver/DeliveryComplete` | `@/modules/delivery/ui/components/` | 3.x | Delivery complete component |
| `domains/delivery/` | `@/domains/delivery/` | Consolidate with module | 3.x | Existing domain layer — will be consolidated |
| `driver.service.js` | `@/services/driver.service` | `@/modules/delivery/api/` or remove | 3.x | Uses `db` (Express sidecar), not Supabase — may be legacy |
| `api/driver.integration.js` | `@/api/driver.integration` | `@/modules/delivery/api/` or remove | 3.x | Express API integration — may be legacy |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `ordersApi` from `deliveries.js` | Orders concern (vendor accept/reject order, order subscriptions). Misplaced in deliveries.js. Naming conflict with api.js ordersApi. Will be resolved in future sprint. |
| `driver.service.js` | Uses Express `db` connection, not Supabase. May be legacy/dead code. Needs investigation before re-exporting. |
| `api/driver.integration.js` | Express API integration. May be legacy. Needs investigation. |
| `api/controllers/driver.controller.js` | Express controller. Server-side code, not frontend. |
| `api/routes/driver.routes.js` | Express routes. Server-side code, not frontend. |
| `api/routes/admin-drivers.routes.js` | Express routes. Server-side code, not frontend. |
| `api/services/driver.service.js` | Express service. Server-side code, not frontend. |
| `components/checkout/DriverSelectionStep.jsx` | Checkout concern. Uses delivery matching but belongs in checkout module. |
| `partnershipService.js` | Partnership concern. May belong in delivery or a separate partnerships module. |
| `legalCameraService.js` | Legal/compliance concern. May belong in a separate legal module. |
| `realtimeService.js` | Realtime infrastructure. May belong in shared or a separate realtime module. |
| `storeTypeService.js` | Store type concern. May belong in marketplace or users module. |
| `gpsTracking.js` | GPS tracking. May be legacy (references driverMatching.js which doesn't exist in current branch). |

## Safety Notes

- **Delivery state:** `deliveries.js` provides `createDelivery`, `fetchDeliveryById`, `updateDeliveryStatus`, `assignDriver`, `markDelivered`, `subscribeToDeliveryUpdates`. No changes made.
- **deliveriesApi:** Contains `getDriverDeliveries`, `getUnassignedDeliveries`, `getAvailableDrivers`, `assignDriver`, `acceptDelivery`, `rejectDelivery`, `markPickedUp`, `markOnTheWay`, `markDelivered`, `updateLocation`, `subscribeToDelivery`, `subscribeToDriverDeliveries`, `subscribeToUnassignedDeliveries`, `getById`, `getBuyerActiveDelivery`. No changes made.
- **ordersApi naming conflict:** `deliveries.js` exports BOTH `deliveriesApi` AND `ordersApi`. Only `deliveriesApi` is re-exported from the delivery module. The `ordersApi` (vendor accept/reject order, order subscriptions) is an orders concern and is documented as a migration candidate.
- **Driver matching:** `deliveryMatchingService.js` (804 lines) provides driver matching, fee calculation, geo services, and delivery request creation. No changes made.
- **Delivery eligibility:** `deliveryEligibilityService.js` provides zone-based eligibility checks. No changes made.
- **Delivery scheduling:** `deliveryScheduleService.js` provides delivery slot management. No changes made.
- **Driver location:** `driverLocationService.js` (549 lines) provides real-time GPS tracking. No changes made.
- **Driver config:** `driver.config.js` provides commission rates, statuses, validation. No changes made.
- **Driver hooks:** `useDriverQueries.js` (294 lines) provides React Query hooks for driver profile, deliveries, stats, earnings, and mutations. No changes made.
- **Routes:** All driver/delivery routes remain unchanged.
- **Supabase queries:** No Supabase queries modified.
- **Edge Functions:** `deliveriesApi` calls Edge Functions (`assign-driver`, `accept-delivery`, `reject-delivery`, `mark-delivery-picked-up`, `mark-delivery-on-the-way`, `mark-delivery-delivered`). No changes made.
- **Realtime subscriptions:** `subscribeToDeliveryUpdates`, `subscribeToDelivery`, `subscribeToDriverDeliveries`, `subscribeToUnassignedDeliveries` use Supabase Realtime. No changes made.
