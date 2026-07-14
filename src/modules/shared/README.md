# Shared Module

## Purpose

Generic, reusable UI components, hooks, and utilities shared across all feature modules.

## Public API

Import only from the module root:

```js
import { Button, Modal, useModal, formatPrice } from '@/modules/shared'
```

Deep imports are blocked by ESLint (`no-restricted-imports` rule in `eslint.config.js`).

## Structure

```
src/modules/shared/
├── index.js          ← Public API entry point
├── ui/
│   └── index.js      ← UI component re-exports
├── hooks/
│   └── index.js      ← Generic hook re-exports
├── utils/
│   └── index.js      ← Utility re-exports
└── README.md         ← This file
```

## Phase 1.1 Status

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing stable components in `src/components/ui/`,
`src/hooks/`, and `src/utils/`.

### Exported UI Components (17)

| Component | Source |
|---|---|
| Button | `@/components/ui/Button` |
| Input | `@/components/ui/Input` |
| Card | `@/components/ui/Card` |
| Modal | `@/components/ui/Modal` |
| Badge | `@/components/ui/Badge` |
| LoadingSpinner | `@/components/ui/LoadingSpinner` |
| EmptyState | `@/components/ui/EmptyState` |
| ErrorState | `@/components/ui/ErrorState` |
| Skeleton | `@/components/ui/Skeleton` |
| Select | `@/components/ui/Select` |
| TextArea | `@/components/ui/TextArea` |
| Toggle | `@/components/ui/Toggle` |
| Tooltip | `@/components/ui/Tooltip` |
| Alert | `@/components/ui/Alert` |
| StarRating | `@/components/ui/StarRating` |
| SimpleRating | `@/components/ui/SimpleRating` |
| ChartSkeleton | `@/components/ui/ChartSkeleton` |

### Exported Hooks (10)

| Hook | Source | Notes |
|---|---|---|
| useModal | `@/hooks` | Pure state management |
| usePagination | `@/hooks` | Generic pagination |
| useToast | `@/hooks` | react-hot-toast wrapper |
| useClipboard | `@/hooks` | Browser clipboard API |
| useLocalStorage | `@/hooks` | Persistent state |
| useMediaQuery | `@/hooks` | Responsive breakpoints |
| useBreakpoint | `@/hooks` | Tailwind breakpoint helper |
| useInterval | `@/hooks` | Recurring tasks |
| useDocumentTitle | `@/hooks` | Page title management |
| useConfirmation | `@/hooks` | Confirmation dialog state |

### Exported Utils

| Utility | Source | Notes |
|---|---|---|
| formatPrice | `@/utils/currency` | MAD formatting |
| formatCurrency | `@/utils/currency` | MAD formatting (alias) |
| formatPriceArabic | `@/utils/currency` | Arabic notation |
| formatPriceShort | `@/utils/currency` | Short format (1.2K MAD) |
| PriceDisplay | `@/utils/currency` | React component |
| logger | `@/utils/logger` | Dev-only console wrapper |
| formatSupabaseError | `@/utils/errorFormatter` | Error → Arabic message |
| withRetry | `@/utils/withRetry` | Exponential backoff |
| useRetry | `@/utils/withRetry` | React hook for retry |
| Zod primitives | `@/utils/validationPrimitives` | email, password, phone, CIN, UUID, name |

### Intentionally NOT Exported (Candidates for Later Migration)

| Item | Source | Reason |
|---|---|---|
| ProductCard | `@/components/ui/ProductCard` | Business-specific (product domain) |
| Map / RouteMap | `@/components/ui/Map` | Business-specific (delivery domain) |
| ChatComponent | `@/components/ui/ChatComponent` | Business-specific (chat domain) |
| OrderTimeline | `@/components/ui/OrderTimeline` | Business-specific (orders domain) |
| CINInput | `@/components/ui/CINInput` | Business-specific (auth/verification) |
| TrustBadges | `@/components/ui/TrustBadges` | Business-specific (marketplace domain) |
| VehiclePhotoUpload | `@/components/ui/VehiclePhotoUpload` | Business-specific (driver domain) |
| MoroccoNotice | `@/components/ui/MoroccoNotice` | Business-specific (regional notice) |
| DriverSelection | `@/components/ui/DriverSelection` | Business-specific (delivery domain) |
| NoDriverAvailable | `@/components/ui/NoDriverAvailable` | Business-specific (delivery domain) |
| VendorWaitResponse | `@/components/ui/VendorWaitResponse` | Business-specific (vendor domain) |
| DriverAvailabilityToggle | `@/components/ui/DriverAvailabilityToggle` | Business-specific (driver domain) |
| DeliveryRequestCard | `@/components/ui/DeliveryRequestCard` | Business-specific (delivery domain) |
| Receipt | `@/components/ui/Receipt` | Business-specific (orders/payments) |
| VendorGuidelines | `@/components/ui/VendorGuidelines` | Business-specific (vendor domain) |
| VendorAlerts | `@/components/ui/VendorAlerts` | Business-specific (vendor domain) |
| GeographicDeliveryNotification | `@/components/ui/GeographicDeliveryNotification` | Business-specific (delivery domain) |
| Recaptcha | `@/components/ui/Recaptcha` | Auth-specific |
| OptimizedImage | `@/components/ui/OptimizedImage` | Complex, needs review before migration |
| LocationPicker | `@/components/ui/LocationPicker` | Business-specific (location/delivery) |
| SkeletonLoaders | `@/components/ui/SkeletonLoaders` | Contains business-specific skeletons |
| DarkModeToggle | `@/components/ui/DarkModeToggle` | App-level, not module-shared |
| FormInput / FormSubmitButton | `@/components/ui/FormInput.tsx` | TS-specific form helpers, evaluate later |
| useFetch / useForm | `@/hooks` | Mixed with Supabase hooks in same file |
| useSupabaseQuery / useSupabaseSingle | `@/hooks` | Supabase-dependent, not shared |
| validationSchemas | `@/utils/validationSchemas` | Business-specific schemas |
| validators | `@/utils/validators` | Business-specific validators |
| cinValidation | `@/utils/cinValidation` | Auth-specific |
| analytics | `@/utils/analytics` | Business-specific |
| authRedirects | `@/utils/authRedirects` | Auth-specific |
| cartQuantity | `@/modules/cart` | Cart-specific (migrated, stub deleted Phase 7.19) |
| checkoutCleanup | `@/utils/checkoutCleanup` (stub deleted Phase 6.33) | Checkout-specific |
| csrfProtection | `@/utils/csrfProtection` | Security-specific |
| encryption | `@/utils/encryption` | Security-specific |
| envValidators | `@/utils/envValidators` | App-level config |
| errorHandler | `@/utils/errorHandler` | Complex, needs review |
| paypalEligibility | `@/utils/paypalEligibility` | Payments-specific |
| performance | `@/utils/performance` | App-level performance utils |
| permissions | `@/utils/permissions` | Auth-specific |
| persistStorage | `@/utils/persistStorage` | Store-specific |
| publicVisibility | `@/utils/publicVisibility` | Business-specific |
| rateLimiter | `@/utils/rateLimiter` | Security-specific |
| sanitization | `@/utils/sanitization` | Security-specific |
| securityHeaders | `@/utils/securityHeaders` | Security-specific |
| staleAssetRecovery | `@/utils/staleAssetRecovery` | App-level |
| supabaseErrors | `@/utils/supabaseErrors` | Supabase-specific |
| cityCoordinates | `@/utils/cityCoordinates` | Delivery-specific |
| accessibility | `@/utils/accessibility` | Complex, needs review |

## Migration Path

1. **Phase 1.1 (current):** Re-export layer established. No files moved.
2. **Future phases:** Gradually move source files into `src/modules/shared/ui/components/`,
   `src/modules/shared/hooks/`, and `src/modules/shared/utils/`. Update re-exports to point
   to new locations. Existing imports via `@/components/ui/` continue to work via re-exports
   in the old location.
3. **Final phase:** Remove old re-exports once all consumers import from `@/modules/shared`.
