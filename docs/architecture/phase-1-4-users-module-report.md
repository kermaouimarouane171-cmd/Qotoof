# Phase 1.4 — Users Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** 1.4 — Users Module Foundation  
**Purpose:** Create `src/modules/users/` as the public users/profile module layer using re-exports only.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full during Phase 0.5 and re-consulted before this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** 8 new files created, 0 files moved, 0 files deleted, 0 imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** No UI redesign. No mass import rewriting.
- **No circular dependencies** introduced (verified by `madge`).

---

## 2. Current Users/Profile Architecture Summary

### Profile Reads
- **`profilesService.ts`** (132 lines) — `fetchProfile(userId)`, `updateProfile(userId, payload)`, `profilesService` object with `fetchActiveVerifiedVendors`, `fetchProfile`, `updateProfile`, `fetchVendorProfile`, `fetchDriverProfile`. Uses `public_profiles` view for vendor listings.
- **`authSessionStore.js`** — `fetchProfile(userId)` queries `profiles` table directly via Supabase. This is part of the auth store but performs user/profile data access.
- **`src/services/api.js`** — vendor API functions query `public_profiles` view for vendor listings and detail.

### Profile Updates
- **`profilesService.ts`** — `updateProfile(userId, payload)` updates `profiles` table, strips `id` field for safety.
- **`authActionsService.js`** — `updateProfile(updates)` in auth store actions also updates `profiles` table.
- **`src/pages/Profile.jsx`** (532 lines) — profile form page, calls `useAuthStore().updateProfile`.

### public_profiles Usage
- **Supabase View** (SECURITY DEFINER) defined in `supabase/migrations/20260528000004_fix_h1_complete.sql`.
- TypeScript types in `src/types/database.ts` under `Views.public_profiles`.
- Used in: `profilesService.ts` (`fetchActiveVerifiedVendors`), `api.js` (vendor list + detail queries).
- Read-only — no writes to this view.

### user_settings Usage
- **`src/pages/buyer/Settings.jsx`** — reads from and writes to `user_settings` table directly via Supabase.
- No separate user_settings service exists — queries are inline in the page component.

### Addresses
- **`src/pages/buyer/Addresses.jsx`** (495 lines) — full CRUD on `addresses` table directly via Supabase.
- No separate address service exists — queries are inline in the page component.

### Notification Preferences
- **`src/services/notifications.js`** (669 lines) — contains both notification delivery logic AND user-owned preference management:
  - `DEFAULT_NOTIFICATION_PREFERENCES` — default settings object
  - `NOTIFICATION_CATEGORY_OPTIONS` — category labels
  - `NOTIFICATION_PREFERENCE_FIELDS` — preference field definitions
  - `normalizeNotificationPreferences()` — normalizer
  - `notificationsApi.getPreferences(userId)` — reads `notification_preferences` table
  - `notificationsApi.savePreferences({userId, preferences})` — writes `notification_preferences` table

### Vendor/Driver Profile Data
- **`src/pages/vendor/Profile.jsx`** — vendor profile settings page
- **`src/pages/vendor/VendorProfile.jsx`** — public vendor profile page
- **`src/pages/driver/Profile.jsx`** — driver profile settings page

### Profile Validation
- **`src/utils/cinValidation.js`** — CIN (national ID) formatting, masking, validation
- **`src/lib/validationSchemas.ts`** — `profileFormSchema` (Zod schema for profile form)

---

## 3. What Users Files Were Created

```
src/modules/users/
├── index.js              ← Public API entry point
├── api/
│   └── index.js          ← Profile services and notification preferences re-exports
├── domain/
│   └── index.ts          ← Database type re-exports
├── data/
│   └── index.js          ← Data layer placeholder (future extraction)
├── ui/
│   └── index.js          ← Profile/settings/addresses pages re-exports
├── stores/
│   └── index.js          ← User store placeholder (profile state in authStore)
├── utils/
│   └── index.js          ← CIN validation and profile form schema re-exports
└── README.md             ← Module documentation
```

**8 new files created.**

---

## 4. Files Moved

**None.** No files were moved. This is an additive, re-export-only step.

---

## 5. Files Re-Exported/Wrapped

### API / Services
| Export | Source |
|---|---|
| `fetchProfile` | `@/services/profilesService` |
| `updateProfile` | `@/services/profilesService` |
| `profilesService` | `@/services/profilesService` |
| `profilesServiceDefault` | `@/services/profilesService` (default) |
| `DEFAULT_NOTIFICATION_PREFERENCES` | `@/services/notifications` |
| `NOTIFICATION_CATEGORY_OPTIONS` | `@/services/notifications` |
| `NOTIFICATION_PREFERENCE_FIELDS` | `@/services/notifications` |
| `normalizeNotificationPreferences` | `@/services/notifications` |
| `notificationsApi` | `@/services/notifications` |

### Domain
| Export | Source |
|---|---|
| `Database` (type) | `@/types/database` |

### UI / Pages
| Export | Source |
|---|---|
| `ProfilePage` | `@/pages/Profile` |
| `BuyerSettingsPage` | `@/pages/buyer/Settings` |
| `BuyerAddressesPage` | `@/pages/buyer/Addresses` |
| `VendorProfilePage` | `@/pages/vendor/Profile` |
| `DriverProfilePage` | `@/pages/driver/Profile` |
| `VendorPublicProfilePage` | `@/pages/vendor/VendorProfile` |

### Utils
| Export | Source |
|---|---|
| `formatCIN` | `@/utils/cinValidation` |
| `maskCIN` | `@/utils/cinValidation` |
| `validateCIN` | `@/utils/cinValidation` |
| `profileFormSchema` | `@/lib/validationSchemas` |

---

## 6. Public API Exposed by `src/modules/users`

```js
import {
  // API / Services
  fetchProfile, updateProfile, profilesService,
  DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS, normalizeNotificationPreferences,
  notificationsApi,

  // UI / Pages
  ProfilePage, BuyerSettingsPage, BuyerAddressesPage,
  VendorProfilePage, DriverProfilePage, VendorPublicProfilePage,

  // Utils
  formatCIN, maskCIN, validateCIN, profileFormSchema,
} from '@/modules/users'
```

---

## 7. User/Profile-Related Files Intentionally NOT Moved

| File | Reason |
|---|---|
| `profilesService.ts` (132 lines) | Safe to move but deferred to keep Phase 1.4 additive-only |
| `notifications.js` (669 lines) | Mixed concerns (delivery + preferences). Needs splitting first. |
| `Profile.jsx` (532 lines) | Page component, deferred to Phase 2+ |
| `buyer/Settings.jsx` | Page component with inline user_settings queries, deferred |
| `buyer/Addresses.jsx` (495 lines) | Page component with inline address CRUD, deferred |
| `vendor/Profile.jsx` | Page component, deferred |
| `vendor/VendorProfile.jsx` | Page component, deferred |
| `driver/Profile.jsx` | Page component, deferred |
| `api.js` (vendor queries) | Large file mixing vendors/products/reviews — needs splitting first |
| `authSessionStore.js` (fetchProfile) | Part of auth store — moving requires decoupling auth from profile fetch |
| `buyer/Security.jsx` | Overlaps with auth module (MFA, sessions) |
| `vendor/Security.jsx` | Same overlap with auth |
| `driver/Security.jsx` | Same overlap with auth |
| `cinValidation.js` | Safe to move but deferred |
| `validationSchemas.ts` | Shared file, only profile parts belong here — needs extraction |
| `platformSettings.js` | Platform-wide settings, not user-specific |

---

## 8. Imports Changed

**None.** No existing imports were changed. All existing code continues to import from original locations. The users module is purely additive.

---

## 9. Behavior Verification

| Check | Status | Details |
|---|---|---|
| Profile read behavior unchanged | ✅ | `profilesService.ts` not modified |
| Profile update behavior unchanged | ✅ | `updateProfile` in profilesService not modified |
| public_profiles behavior unchanged | ✅ | View queries not modified, view definition not touched |
| user_settings behavior unchanged | ✅ | `buyer/Settings.jsx` not modified |
| Notification preferences behavior unchanged | ✅ | `notifications.js` not modified, only re-exported |
| Onboarding/profile completion unchanged | ✅ | `OnboardingOrchestrator` not touched |
| Auth behavior unchanged | ✅ | No auth files modified |
| Addresses behavior unchanged | ✅ | `buyer/Addresses.jsx` not modified |
| CIN validation unchanged | ✅ | `cinValidation.js` not modified |
| Vendor/driver profile pages unchanged | ✅ | Only re-exported, not modified |

---

## 10. Verification Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | 0 errors, 0 warnings |
| `npm run type-check` | ✅ **Passed** | 0 errors |
| `npm run build` | ✅ **Passed** | Built in 2m 40s, PWA generated |
| `npm run check:circular` | ✅ **Passed** | 573 files (was 566 — 7 new files), **zero circular dependencies** |

### madge File Count Change

- Before: 566 files
- After: 573 files (+7 new files in `src/modules/users/`)
- Circular dependencies: 0 (unchanged)

---

## 11. Documentation Updates

### Documents Updated (3)

| Document | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated to include Phase 1.4 + Phase 1 complete. Phase 1 table: `src/modules/users/` marked ✅. Added Phase 1.4 achievement note + Phase 1 complete note. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/users/` to project structure tree. |
| `ARCHITECTURE_GUIDE.md` | Updated TODO section to include Phase 1.4 completion + Phase 1 fully complete. |

### Documents Checked But Not Changed (4)

| Document | Reason |
|---|---|
| `SYSTEM_DESIGN.md` | Describes runtime architecture, not file structure. No changes needed. |
| `eslint.config.js` | Already contains `no-restricted-imports` rule. No changes needed. |
| `package.json` | No scripts or dependencies changed. No changes needed. |
| `src/modules/auth/README.md` | Auth module not affected by users module changes. No changes needed. |

### Outdated Documents Found

None new. The existing TODOs in `ARCHITECTURE_GUIDE.md` and `DEVELOPER_GUIDE.md` remain valid and were updated with Phase 1.4 status.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 2 |
| `DEVELOPER_GUIDE.md` | Update Edge Functions table (remove Stripe/CMI) | Phase 3 |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 2 |
| `MODULAR_DEVELOPMENT_PLAN.md` | Mark Phase 2 sprints when complete | As each sprint completes |
| `src/modules/users/README.md` | Update migration candidates as files are moved | Phase 2+ |

---

## 12. Files Modified/Created

| File | Action |
|---|---|
| `src/modules/users/index.js` | Created — public API entry point |
| `src/modules/users/api/index.js` | Created — profile services + notification preferences re-exports |
| `src/modules/users/domain/index.ts` | Created — database type re-exports |
| `src/modules/users/data/index.js` | Created — data layer placeholder |
| `src/modules/users/ui/index.js` | Created — profile/settings/addresses pages re-exports |
| `src/modules/users/stores/index.js` | Created — user store placeholder |
| `src/modules/users/utils/index.js` | Created — CIN validation + profile form schema re-exports |
| `src/modules/users/README.md` | Created — module documentation |
| `MODULAR_DEVELOPMENT_PLAN.md` | Modified — status + Phase 1 table + achievement note + Phase 1 complete |
| `DEVELOPER_GUIDE.md` | Modified — project structure tree |
| `ARCHITECTURE_GUIDE.md` | Modified — TODO section updated |
| `docs/architecture/phase-1-4-users-module-report.md` | Created — this report |

**Total: 9 new files created. 3 files modified. 0 files deleted. 0 files moved.**

---

## 13. Safety Assessment

| Check | Status |
|---|---|
| No business logic changes | ✅ |
| No auth behavior changes | ✅ |
| No Supabase query changes | ✅ |
| No database/RLS changes | ✅ |
| No UI redesign | ✅ |
| No mass import rewriting | ✅ (0 imports changed) |
| No files deleted | ✅ |
| No circular dependencies | ✅ |
| No `any` / `@ts-ignore` / `@ts-expect-error` | ✅ |
| All 4 commands pass | ✅ |
| Behavior preserved | ✅ |

---

## 14. Phase 1 Foundation Complete

### ✅ Phase 1 is fully complete

All Phase 1 modules have been created as safe re-export layers:

| Phase | Module | Status | Files Created | Imports Changed |
|---|---|---|---|---|
| 1.1 | `src/modules/shared/` | ✅ Complete | 5 | 0 |
| 1.2 | `src/app/` | ✅ Complete | 7 | 1 (main.jsx) |
| 1.3 | `src/modules/auth/` | ✅ Complete | 7 | 0 |
| 1.4 | `src/modules/users/` | ✅ Complete | 8 | 0 |
| **Total** | | | **27** | **1** |

### Phase 1 Summary

- **27 new files** created across 4 modules
- **1 import changed** (main.jsx → app/App)
- **0 files moved**, **0 files deleted**
- **0 circular dependencies** at every step
- **All 4 verification commands pass** at every step (lint, type-check, build, check:circular)
- **madge file count:** 555 → 573 (+18 net new files tracked)
- **100% behavior preserved** — no runtime changes

---

## 15. Recommendation

### **Safe to start Phase 2 later**

Phase 1 foundation is complete and verified:
- All 4 modules (shared, app, auth, users) exist as pure re-export layers.
- The dependency direction is clear: `main.jsx → app → modules → shared`.
- Module boundaries are documented with allowed/forbidden dependencies.
- Migration candidates are documented for Phase 2+ with target locations.
- The known couplings (auth ↔ cart/favorites, auth ↔ profile fetch, notifications ↔ preferences) are documented as future migration items.

Phase 2 should start with **Sprint 2.1: Catalog module** as specified in `MODULAR_DEVELOPMENT_PLAN.md` Section 9.3, following the "One Module at a Time" rule.
