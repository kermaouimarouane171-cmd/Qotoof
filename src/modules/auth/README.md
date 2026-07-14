# Auth Module

## Purpose

The auth module encapsulates all authentication and authorization functionality:
- Session management (init, restore, refresh, logout)
- Sign in / sign up / sign out
- MFA (email OTP + TOTP)
- Password reset and update
- OAuth (Google)
- Role-based access control (RBAC)
- Protected routes and role-based layouts
- Session security (device fingerprint, auto-logout, session revocation)
- Phone verification

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing auth files in `src/store/`, `src/services/`,
`src/components/`, `src/constants/`, `src/layouts/`, `src/features/auth/`, and `src/utils/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: stores, API services, domain constants, and utils.

```js
import {
  // Stores
  useAuthStore,
  createSessionActions,
  sessionInitialState,

  // API / Services
  createAuthActions,
  mfaService,
  sessionService,
  autoLogoutService,
  signInWithServerRateLimit,
  authAdminOps,

  // Domain / Constants
  USER_ROLES,
  ROLE_PERMISSIONS,
  PUBLIC_PATHS,

  // Utils
  DEFAULT_AUTH_REDIRECT,
  setPendingAuthRedirect,
  getPendingAuthRedirect,
  consumePendingAuthRedirect,
  clearPendingAuthRedirect,
  resolveSafeAuthRedirect,
} from '@/modules/auth'
```

### Intentionally NOT Exported from Root (Phase 6.21)

UI exports were removed from the root barrel. App code imports ProtectedRoute and layouts directly from `@/components/ProtectedRoute` and auth components from `@/components/auth/...`.

| Symbol | Available Via |
|---|---|
| `ProtectedRoute` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `MainLayout` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `AdminLayout` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `VendorLayout` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `DriverLayout` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `BuyerLayout` | `@/components/ProtectedRoute` or `@/modules/auth/ui` |
| `MFASetup` | `@/components/auth/MFASetup` or `@/modules/auth/ui` |
| `MFAVerify` | `@/components/auth/MFAVerify` or `@/modules/auth/ui` |
| `PhoneVerification` | `@/components/auth/PhoneVerification` or `@/modules/auth/ui` |
| `SessionManager` | `@/components/auth/SessionManager` or `@/modules/auth/ui` |
| `TwoFactor` | `@/features/auth/components/TwoFactor` or `@/modules/auth/ui` |
| `AuthLayout` | `@/layouts/AuthLayout` or `@/modules/auth/ui` |

### UI / Page Import Policy

App code should import auth UI components from their original paths:
```js
import { ProtectedRoute, AdminLayout } from '@/components/ProtectedRoute'
import MFASetup from '@/components/auth/MFASetup'
```

UI exports remain available through `src/modules/auth/ui/index.js` for intra-module use only.

## Structure

```
src/modules/auth/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← Auth services and gateway re-exports
├── domain/
│   └── index.js      ← Role constants and RBAC re-exports
├── ui/
│   └── index.js      ← ProtectedRoute, layouts, auth components re-exports
├── stores/
│   └── index.js      ← AuthStore and session store re-exports
├── utils/
│   └── index.js      ← Auth redirect utilities re-exports
└── README.md         ← This file
```

## What Belongs in Auth

- Session lifecycle (init, restore, refresh, revoke)
- Sign in / sign up / sign out / OAuth
- MFA enrollment and verification
- Password reset and update
- Role definitions and permission checks
- Protected route components and role-based layouts
- Auth-related UI components (MFA, phone verification, session manager)
- Auth redirect utilities

## What Does NOT Belong in Auth

- User profile settings (belongs in `users` module)
- Onboarding flow logic (belongs in app orchestrators)
- Cart/favorites clearing on logout (cross-module cleanup — belongs in orchestrator)
- Order/checkout/payment logic
- Delivery logic
- Admin panel logic

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/services/supabase` — Supabase client
- `@/lib/config` — app config
- `@/utils/` — general utilities (logger, encryption, rateLimiter)
- `@/services/auditLogger` — audit logging
- `@/services/emailService` — email sending

## Forbidden Dependencies

- `@/modules/orders` — orders module
- `@/modules/checkout` — checkout module
- `@/modules/payments` — payments module
- `@/modules/delivery` — delivery module
- `@/modules/catalog` — catalog module
- `@/modules/admin` — admin module
- `@/modules/cart` — cart store (cross-module cleanup should go through orchestrator)
- `@/modules/cart` — favorites store (same reason)

> **Note:** The current `authActionsService.js` imports `cartStore` and `favoritesStore`
> for logout cleanup. This is a known coupling that should be resolved in a future phase
> by moving cleanup to an app-level orchestrator. It is documented here as a migration
> candidate, not changed in Phase 1.3.

## Migration Candidates for Future Phases

| File | Current Location | Target | Phase | Notes |
|---|---|---|---|---|
| `authStore.js` | `@/store/authStore` | `@/modules/auth/stores/` | Phase 2+ | Small file, safe to move |
| `authSessionStore.js` | `@/store/authSessionStore` | `@/modules/auth/stores/` | Phase 2+ | 577 lines, needs careful review |
| `authActionsService.js` | `@/services/authActionsService` | `@/modules/auth/api/` | Phase 2+ | 755 lines, has cart/favorites coupling |
| `authServices.js` | `@/services/authServices` | `@/modules/auth/api/` | Phase 2+ | 524 lines, MFA + sessions + auto-logout |
| `authGateway.js` | `@/services/authGateway` | `@/modules/auth/api/` | Phase 2+ | 98 lines, safe to move |
| `authAdminOps.js` | `@/services/authAdminOps` | `@/modules/auth/api/` | Phase 2+ | 64 lines, safe to move |
| `roles.js` | `@/constants/roles` | `@/modules/auth/domain/` | Phase 2+ | 53 lines, safe to move |
| `ProtectedRoute.jsx` | `@/components/ProtectedRoute` | `@/modules/auth/ui/` | Phase 2+ | 840 lines, complex — needs careful review |
| `MFASetup.jsx` | `@/components/auth/MFASetup` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `MFAVerify.jsx` | `@/components/auth/MFAVerify` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `PhoneVerification.jsx` | `@/components/auth/PhoneVerification` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `SessionManager.jsx` | `@/components/auth/SessionManager` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `TwoFactor.jsx` | `@/features/auth/components/TwoFactor` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `AuthLayout.jsx` | `@/layouts/AuthLayout` | `@/modules/auth/ui/` | Phase 2+ | Safe to move |
| `authRedirects.js` | `@/utils/authRedirects` | `@/modules/auth/utils/` | Phase 2+ | Safe to move |
| `Login.jsx` | `@/pages/auth/Login` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `Register.jsx` | `@/pages/auth/Register` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `ForgotPassword.jsx` | `@/pages/auth/ForgotPassword` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `ResetPassword.jsx` | `@/pages/auth/ResetPassword` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `VerifyEmail.jsx` | `@/pages/auth/VerifyEmail` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `AuthCallback.jsx` | `@/pages/auth/AuthCallback` | `@/modules/auth/ui/pages/` | Phase 2+ | Page component |
| `useAuthQueries.js` | `@/hooks/queries/useAuthQueries` | `@/modules/auth/api/` | Phase 2+ | React Query hooks |
| `AuthOrchestrator.jsx` | `@/orchestrators/AuthOrchestrator` | `@/app/orchestrators/` | Phase 2+ | App-level orchestrator |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `middleware/auth.js` | Server-side middleware, not part of client auth module |
| `middleware/authMiddleware.js` | Server-side middleware, not part of client auth module |
| `api/middleware/auth.js` | API middleware, not part of client auth module |
| `pages/Unauthorized.jsx` | Error page, belongs in shared or error module |
| `components/Unauthorized.jsx` | Error page, belongs in shared or error module |

## Safety Notes

- **Supabase Auth:** The Supabase client (`@/services/supabase`) is the single source
  of truth for auth sessions. This module does not modify Supabase behavior.
- **RLS Policies:** Row-Level Security policies are defined in the database. This module
  does not touch RLS.
- **Session Persistence:** The auth store uses `persist` middleware with `partialize: () => ({})`
  (no persistence — session is restored from Supabase on init). This behavior is unchanged.
- **Auto-Logout:** The auto-logout service uses a 30-minute idle timeout with a 25-minute
  warning. This behavior is unchanged.
