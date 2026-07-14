# Users Module

## Purpose

The users module encapsulates all user/profile functionality:
- Profile reads and updates (profiles table)
- Public profile reads (public_profiles view)
- User settings (user_settings table)
- Buyer addresses (addresses table)
- Notification preferences (notification_preferences table — user-owned settings, preference helpers extracted to `src/services/notificationPreferences.js` in Phase 3.4)
- Vendor/driver public profile data
- Profile validation utilities (CIN, form schemas)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`, `src/pages/`, `src/utils/`, and `src/lib/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain types, data, stores, and utils.

```js
import {
  // API / Services
  fetchProfile,
  updateProfile,
  profilesService,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
  notificationsApi,

  // Utils
  formatCIN,
  maskCIN,
  validateCIN,
  profileFormSchema,
} from '@/modules/users'
```

### Intentionally NOT Exported from Root (Phase 6.21)

UI/page-level exports were removed from the root barrel. App code loads pages via `lazy(() => import('@/pages/...'))` — not through this barrel.

| Symbol | Available Via |
|---|---|
| `ProfilePage` | `lazy(() => import('@/pages/Profile'))` or `@/modules/users/ui` |
| `BuyerSettingsPage` | `lazy(() => import('@/pages/buyer/Settings'))` or `@/modules/users/ui` |
| `BuyerAddressesPage` | `lazy(() => import('@/pages/buyer/Addresses'))` or `@/modules/users/ui` |
| `VendorProfilePage` | `lazy(() => import('@/pages/vendor/Profile'))` or `@/modules/users/ui` |
| `DriverProfilePage` | `lazy(() => import('@/pages/driver/Profile'))` or `@/modules/users/ui` |
| `VendorPublicProfilePage` | `lazy(() => import('@/pages/vendor/VendorProfile'))` or `@/modules/users/ui` |

### UI / Page Import Policy

App code should load user pages via lazy imports from original paths:
```js
const ProfilePage = lazy(() => import('@/pages/Profile'))
const BuyerSettingsPage = lazy(() => import('@/pages/buyer/Settings'))
```

UI exports remain available through `src/modules/users/ui/index.js` for intra-module use only.

## Structure

```
src/modules/users/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← Profile services and notification preferences re-exports
├── domain/
│   └── index.ts      ← Database type re-exports
├── data/
│   └── index.js      ← Data layer placeholder (future extraction)
├── ui/
│   └── index.js      ← Profile/settings/addresses pages re-exports
├── stores/
│   └── index.js      ← User store placeholder (profile state currently in authStore)
├── utils/
│   └── index.js      ← CIN validation and profile form schema re-exports
└── README.md         ← This file
```

## What Belongs in Users

- Profile CRUD (read, update)
- Public profile reads (public_profiles view)
- User settings (user_settings table)
- Buyer addresses management
- Notification preferences (user-owned settings, not notification delivery)
- Vendor/driver profile data and setup
- Profile validation (CIN, form schemas)
- Profile-related UI pages (Profile, Settings, Addresses)

## What Does NOT Belong in Users

- Supabase Auth session logic (belongs in `auth` module)
- Login/register/logout (belongs in `auth` module)
- Notification delivery/sending (belongs in `notifications` module)
- Orders, checkout, payments, delivery
- Catalog/products
- Admin business logic
- Role-based route protection (belongs in `auth` module)

## Relationship with Auth

- **Users may consume auth's current user identity** — e.g., `useAuthStore().user.id` to know which profile to fetch.
- **Auth must not import users directly** — the current `authSessionStore.js` fetches profiles directly from Supabase. This is a known coupling documented as a migration candidate. In a future phase, auth should call `users` module's `fetchProfile` instead of querying Supabase directly.
- **Profile state currently lives in authStore** — `useAuthStore` holds `profile`, `fetchProfile`, `refreshProfile`, `updateProfile`. This is a temporary coupling that should be resolved when a dedicated user store is created.

## Relationship with Notifications

- **Users owns notification preferences** — the `notification_preferences` table is a user-owned setting.
- **Notifications receives preferences as parameters** — the notifications service should accept preferences as input rather than importing from users.
- **Avoid users ↔ notifications circular dependency** — currently `notifications.js` contains both notification delivery logic AND preference management. In a future phase, preference management should be extracted into the users module, and notifications should only handle delivery.
- **Current state:** `notifications.js` exports `DEFAULT_NOTIFICATION_PREFERENCES`, `normalizeNotificationPreferences`, and `notificationsApi.getPreferences/savePreferences`. These are re-exported through the users module API since they are user-owned settings.

## Relationship with public_profiles

- `public_profiles` is a **Supabase View** (SECURITY DEFINER) that exposes safe columns from the `profiles` table.
- It is used for **public profile reads only** — vendor listings, vendor public profile pages, driver public profiles.
- The view is defined in: `supabase/migrations/20260528000004_fix_h1_complete.sql`
- TypeScript types are defined in: `src/types/database.ts` under `Database['public']['Views']['public_profiles']`
- **Do not write to public_profiles** — it is a read-only view.

## Allowed Dependencies

- `@/modules/auth` — auth public API (for current user identity)
- `@/modules/shared` — shared UI, hooks, utils
- `@/services/supabase` — Supabase client
- `@/lib/config` — app config
- `@/utils/` — general utilities
- `@/types/database` — database type definitions

## Forbidden Dependencies

- `@/modules/orders` — orders module
- `@/modules/checkout` — checkout module
- `@/modules/payments` — payments module
- `@/modules/delivery` — delivery module
- `@/modules/catalog` — catalog module
- `@/modules/admin` — admin module
- `@/services/notifications` direct import for delivery logic (preferences only)

## Migration Candidates for Future Phases

| File | Current Location | Target | Phase | Notes |
|---|---|---|---|---|
| `profilesService.ts` | `@/services/profilesService` | `@/modules/users/api/` | Phase 2+ | 132 lines, safe to move |
| `notifications.js` (preference parts) | `@/services/notifications` | `@/modules/users/api/` | Phase 2+ | Extract preference management only |
| `Profile.jsx` | `@/pages/Profile` | `@/modules/users/ui/pages/` | Phase 2+ | 532 lines, page component |
| `buyer/Settings.jsx` | `@/pages/buyer/Settings` | `@/modules/users/ui/pages/` | Phase 2+ | Settings page with user_settings |
| `buyer/Addresses.jsx` | `@/pages/buyer/Addresses` | `@/modules/users/ui/pages/` | Phase 2+ | 495 lines, addresses CRUD |
| `vendor/Profile.jsx` | `@/pages/vendor/Profile` | `@/modules/users/ui/pages/` | Phase 2+ | Vendor profile page |
| `vendor/VendorProfile.jsx` | `@/pages/vendor/VendorProfile` | `@/modules/users/ui/pages/` | Phase 2+ | Public vendor profile |
| `driver/Profile.jsx` | `@/pages/driver/Profile` | `@/modules/users/ui/pages/` | Phase 2+ | Driver profile page |
| `cinValidation.js` | `@/utils/cinValidation` | `@/modules/users/utils/` | Phase 2+ | Safe to move |
| `validationSchemas.ts` (profile parts) | `@/lib/validationSchemas` | `@/modules/users/domain/` | Phase 2+ | Extract profile schema |
| `api.js` (vendor profile queries) | `@/services/api` | `@/modules/users/data/` | Phase 2+ | Extract public_profiles queries |
| `authSessionStore.js` (fetchProfile) | `@/store/authSessionStore` | `@/modules/users/api/` | Phase 2+ | Decouple profile fetch from auth |
| `buyer/Security.jsx` | `@/pages/buyer/Security` | `@/modules/users/ui/pages/` | Phase 2+ | Security settings page |
| `vendor/Security.jsx` | `@/pages/vendor/Security` | `@/modules/users/ui/pages/` | Phase 2+ | Security settings page |
| `driver/Security.jsx` | `@/pages/driver/Security` | `@/modules/users/ui/pages/` | Phase 2+ | Security settings page |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `api.js` vendor queries | `api.js` mixes vendors, products, reviews — needs splitting first |
| `authSessionStore.js` `fetchProfile` | Part of auth store, moving requires decoupling |
| `buyer/Security.jsx` | Security settings overlap with auth module (MFA, sessions) |
| `vendor/Security.jsx` | Same as above |
| `driver/Security.jsx` | Same as above |
| `platformSettings.js` | Platform-wide settings, not user-specific |

## Safety Notes

- **public_profiles View:** Read-only Supabase View. Do not write to it.
- **RLS Policies:** Profile access is controlled by RLS. This module does not modify RLS.
- **user_settings table:** Accessed directly via Supabase in `buyer/Settings.jsx`. No separate service exists yet.
- **notification_preferences table:** Accessed via `notificationsApi.getPreferences/savePreferences` in `notifications.js`. Re-exported here as user-owned settings.
- **addresses table:** Accessed directly via Supabase in `buyer/Addresses.jsx`. No separate service exists yet.
