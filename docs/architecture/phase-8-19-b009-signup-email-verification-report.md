# Phase 8.19 — B-009 Signup Email Verification Report

## Blocker

**B-009** — Signup email verification is not being sent or not reaching the user.

## Root cause

The application had a **mismatched email verification flow**:

1. **Supabase Auth** sends a **6-digit numeric OTP code** (`{{ .Token }}`) in the signup verification email — not a confirmation link.
2. **First attempt (incorrect fix)**: The UI was changed to show "click the confirmation link" instructions, but the email actually contains a code.
3. **Original bug**: The `VerifyEmail.jsx` page was already an OTP input, but the `useVerifyEmail` hook was marked as obsolete and threw an error for signup type, preventing OTP verification from working.
4. **`emailRedirectTo`** was added to `signUp` options unnecessarily, since the primary verification path is OTP, not a link.

## Corrected verification flow

The architecture uses **Supabase email OTP verification**:

- `Register.jsx` calls `signUp` and redirects to `/verify-email` with the user's email and role-based redirect path.
- `VerifyEmail.jsx` shows a 6-digit numeric input, calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
- On success, the auth store is initialized and the user is redirected to their role-specific dashboard.
- `supabase.auth.resend({ type: 'signup', email })` is used to resend the verification code.
- `AuthCallback.jsx` is kept as a fallback in case Supabase also sends a confirmation link, but it is not the primary verification path.

## Files changed

- `src/services/authActionsService.js`
  - Removed `emailRedirectTo` from `signUp` options (OTP is the primary verification path).
  - Updated comment to reflect OTP-based email verification.
- `src/pages/auth/VerifyEmail.jsx`
  - Restored 6-digit OTP input field with numeric-only filtering and max length 6.
  - Calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })` on submit.
  - On success: calls `initialize()` to refresh auth state, then navigates to the role-specific redirect path.
  - Shows error message on invalid/expired code.
  - Resend button calls `supabase.auth.resend({ type: 'signup', email })` with 60-second cooldown.
  - Shows safe fallback state when no email is available (redirects to register/login).
  - Includes "wrong email" and "back to login" links.
- `src/pages/auth/Register.jsx`
  - Now passes `redirectPath` in navigation state to `VerifyEmail` page.
- `src/hooks/queries/useAuthQueries.js`
  - Restored `useVerifyEmail` hook to support signup OTP verification (removed the error-throwing guard).
- `src/pages/auth/AuthCallback.jsx`
  - Kept `pending_auth_redirect` as fallback redirect source (in case Supabase email also includes a link).
- `src/i18n/locales/ar.json`, `en.json`, `fr.json`
  - Updated `verifyEmail` section with OTP/code-based messaging in all three languages.
- `src/__tests__/pages/VerifyEmail.test.jsx`
  - Rewritten to test OTP input, verify button, verifyOtp call, error handling, resend with cooldown, missing email state, and redirect after verification.
- `src/__tests__/services/authActionsService.signUp.test.js`
  - Updated to verify role metadata is passed and `emailRedirectTo` is NOT present in signUp options.

## Tests added / updated

- `src/__tests__/pages/VerifyEmail.test.jsx` — 12 tests covering:
  - OTP input and verify button are rendered
  - Confirmation link is NOT shown as the main instruction
  - Valid OTP calls `supabase.auth.verifyOtp` and redirects to role path
  - Invalid OTP shows error
  - Numeric-only input with max 6 characters
  - Resend calls `supabase.auth.resend` and shows cooldown
  - Rate-limit error is displayed safely
  - Missing email state shows safe fallback
  - No auto-redirect on mount (anti-loop guard)
  - sessionStorage fallback for email and redirect path
- `src/__tests__/services/authActionsService.signUp.test.js` — 6 tests covering:
  - Role metadata passed correctly
  - `emailRedirectTo` is NOT present in signUp options
  - `needsEmailVerification` returned when session is null
  - Success with redirect when session is present
  - Resend on already-registered error
  - Error handling on signup failure

## Verification commands run

```bash
npm run type-check   # passed
npm run lint          # 0 errors, 3 pre-existing warnings
npm run build         # passed
npm run check:circular # no circular dependencies
npm run test          # 160 suites, 1728 tests passed
```

All passed.

## Manual test steps (B-009 closure)

1. Open `https://greenmarket-marketplace.web.app/register`.
2. Create a new buyer/vendor/driver account with a fresh email.
3. After clicking **Create account**, you should be redirected to `/verify-email` showing:
   - "أدخل رمز التحقق المؤلف من 6 أرقام الذي وصل إلى بريدك الإلكتروني."
4. Check the email inbox. The email should contain a **6-digit verification code**.
5. Enter the code in the OTP input field and click **Verify & Activate Account**.
6. Supabase should verify the email and create a session.
7. The app should redirect to the correct role dashboard/path (e.g., `/marketplace`, `/vendor/dashboard`, `/driver/dashboard`).
8. Confirm the user is authenticated and can use the app.
9. Confirm logout works.
10. If the email does not arrive, use the **Resend code** button (60-second cooldown applies).

## Post-verification buyer dashboard infinite loading (B-009 follow-up)

### Problem

After successful OTP verification, the app redirected to `/buyer/dashboard` which entered an infinite loading state. The user could not continue.

### Root cause

Two bugs combined:

1. **`VerifyEmail.jsx` — `initialize()` returned early**: The `initialize()` function in `authSessionStore.js` has a guard `if (get().initialized) return`. On the `/verify-email` page, `initialize()` had already run on mount (finding no session) and set `initialized: true`. After `verifyOtp` succeeded and created a new session, calling `initialize()` again returned immediately without fetching the new session or profile. The user was navigated to `/buyer/dashboard` with `user: null` and `profile: null` in the store.

2. **`ProtectedRoute.jsx` — infinite `LoadingFallback` when profile is null**: When `profile` is `null` and `profileError` is `true` (profile fetch failed), the route guard fell through to `return <LoadingFallback />` with no timeout, creating an infinite spinner.

### Fix

- **`src/pages/auth/VerifyEmail.jsx`**: Reset `initialized: false` and `loading: true` via `useAuthStore.setState()` before calling `initialize()`, forcing a fresh session/profile fetch after OTP verification.
- **`src/components/ProtectedRoute.jsx`**: Added `ProfileErrorFallback` component with retry and logout buttons. When `profileError: true` and profile is null, show this error state instead of infinite `LoadingFallback`.
- **`src/pages/buyer/Dashboard.jsx`**: Fixed `loadDashboard` to set `loading: false` when user is null (was previously leaving `loading: true` forever). Fixed `loadRecommendations` to guard against null user with optional chaining.

### Tests updated

- `src/__tests__/pages/VerifyEmail.test.jsx` — Added `setState` mock to `useAuthStore` mock.
- `src/__tests__/components/ProtectedRoute.test.jsx` — Updated `profileError=true` test to assert `ProfileErrorFallback` with retry and logout buttons is shown.

### Verification commands run

```bash
npm run type-check   # passed
npm run lint          # 0 errors, 3 pre-existing warnings
npm run build         # passed
npm run check:circular # no circular dependencies
npm run test          # 160 suites, 1728 tests passed
```

All passed.

## Profile self-healing fix (B-009 follow-up 2)

### Problem

After the infinite loading fix, the buyer dashboard showed "Profile could not be loaded" for newly verified users. OTP verification succeeded, but the profile row was missing.

### Root cause

When email confirmation is enabled (OTP flow):
1. `signUp()` creates the auth user but returns `data.session = null` (no session until email verified).
2. The code tries `profiles.upsert()` with **no session** — RLS policy `profiles_insert_service_role` only allows `service_role` to INSERT. The upsert fails silently.
3. No database trigger exists to auto-create a profile row on `auth.users` INSERT (only MFA settings trigger exists).
4. After OTP verification, `fetchProfile()` finds no row → `profileError: true` → `ProfileErrorFallback` shown.

### Fix

- **`supabase/migrations/20260628000001_ensure_profile_rpc.sql`**: New `ensure_profile()` RPC function (SECURITY DEFINER, bypasses RLS) that creates a profile row from `auth.users.raw_user_meta_data` if it doesn't exist. Only touches the calling user's own row. Granted to `authenticated` role only.
- **`src/store/authSessionStore.js`**: `fetchProfile()` now calls `supabase.rpc('ensure_profile')` when the profile query returns no data. If the RPC succeeds, the profile is set in the store. If it fails, `profileError: true` is set as before.

### Security

- `ensure_profile()` runs as SECURITY DEFINER but only operates on `auth.uid()` — no user can create profiles for other users.
- No service role key exposed in frontend.
- RLS remains enabled on `profiles`.
- The RPC only INSERTs (with `ON CONFLICT DO NOTHING`) — no updates to existing profiles.

### Tests added

- `src/__tests__/store/profileSelfHealing.test.js` — 4 tests:
  - Calls `ensure_profile` RPC when profile row is missing
  - Sets `profileError` when RPC fails
  - Does not call RPC when profile exists
  - Sets `profileError` when userId is null

### Verification commands run

```bash
npm run type-check     # passed
npm run lint           # 0 errors, 3 pre-existing warnings
npm run build          # passed
npm run check:circular # no circular dependencies
npm run test           # 161 suites, 1732 tests passed
```

## Remaining risks

1. **Email deliverability** — default Supabase SMTP emails may land in spam/junk. A custom SMTP provider is recommended for production.
2. **Rate limiting** — Supabase limits how often verification codes can be resent. The UI enforces a 60-second cooldown.
3. **Phone verification** — when a phone number is provided, the app still plans phone verification after email confirmation. That flow should be validated separately.
4. **Confirmation link fallback** — if Supabase also sends a confirmation link in the email, `AuthCallback.jsx` will handle it, but the primary path is OTP.
5. **Migration must be applied manually** — the `ensure_profile` RPC migration (`20260628000001_ensure_profile_rpc.sql`) must be applied via the Supabase Dashboard SQL Editor before the fix will work on the deployed app.

## Closure criteria

B-009 should be closed only after a manual signup from `https://greenmarket-marketplace.web.app/register` succeeds end-to-end:

- User receives a 6-digit verification code by email.
- User enters the code in the app.
- Supabase verifies the email.
- Profile row is created (via `ensure_profile` RPC or existing trigger).
- App redirects to the correct role dashboard/path.
- **Buyer dashboard renders correctly (no infinite loading, no "Profile could not be loaded").**
- User is authenticated and usable.
- Logout works.

## Security notes

- No Supabase service role key was exposed in the frontend.
- No SMTP credentials were added.
- No OTP codes are logged (logger only logs the email address, not the code).
- Email verification was not silently disabled.
- No fake verification — the user must enter the real code from Supabase.
- No fake profile creation — profile is fetched from Supabase after verification.

