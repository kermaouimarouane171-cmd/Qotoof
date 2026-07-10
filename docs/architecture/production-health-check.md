# Production Health Check — Greenmarket / Qotoof

**Last updated:** Phase 8.8 (2026-06-27)

---

## 1. Environment Variables

### Required for Production

| Variable | Purpose | Status |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Required — app won't render without it |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Required — app won't render without it |
| `VITE_PAYPAL_CLIENT_ID` | PayPal client ID | Required for PayPal checkout |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking | Optional — falls back to default DSN |
| `VITE_PAYMENT_MODE` | `production` or `sandbox` | Required — defaults to sandbox |
| `VITE_I18N_DEFAULT_LOCALE` | Default language | Optional — defaults to `ar` |

### Validation

- `src/utils/envValidators.js` validates Sentry DSN format at startup.
- `src/services/supabase.ts` checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — renders `ConfigErrorPage` if missing.
- `src/lib/config.ts` fetches public config (PayPal client ID) at startup with fallback.

---

## 2. Runtime Connectivity Checks

### Supabase

- `src/services/supabase.ts` exports `isSupabaseConfigured()` and `supabaseConfigError` — used in `App.jsx` to show `ConfigErrorPage` if Supabase is not configured.
- `SupabaseHealthMonitor` (referenced in `.windsurfrules`) monitors connection health with `withRetry`.

### Sentry

- `src/services/sentry.js` — `initSentry()` called lazily in `main.jsx` via `runWhenIdle()`.
- If DSN is invalid, `console.warn` is called and error monitoring is disabled.
- `logError()` is a no-op if Sentry is not loaded — safe to call from anywhere.

### Edge Functions

- 12 Edge Functions deployed via Supabase.
- `create-checkout-order` — PayPal order creation with inventory reservation + rollback.
- `capture-paypal-order` — PayPal payment capture.
- No client-side health check for Edge Functions — failures are caught by caller error handling and logged via `logger.error`.

---

## 3. Error Tracking

### Sentry Integration

- **Initialized:** `main.jsx` — deferred until after first paint via `runWhenIdle()`.
- **DSN:** Configured via `VITE_SENTRY_DSN` env var, falls back to default DSN.
- **Scope:** `sendDefaultPii: true`, `tracesSampleRate: 0.1` in production.
- **Integrations:** `browserTracingIntegration()`, `replayIntegration()`.
- **Ignored errors:** Browser extension errors, network errors, `atomicFindClose`.
- **User context:** Set via `setSentryUser()` — reads from `localStorage('auth-user')` in `beforeSend`.

### Error Boundaries

- **Global:** `ErrorBoundary` wraps entire app in `main.jsx`.
- **App-level:** `ErrorBoundary` wraps `AuthenticatedApp` in `App.jsx`.
- **Route-level:** `ErrorBoundary` wraps admin, vendor, buyer, driver route layouts in `AppRouter.jsx`.
- **Page-level:** ~20 individual pages use `ErrorBoundary` or `withErrorBoundary`.
- **Fallback UI:** `ErrorFallback` component — shows error message, retry button, home link. Technical details only in dev mode.
- **Sentry:** `handleError` in `ErrorBoundary.jsx` sends errors to Sentry via `logError()`.

### Global Error Handlers

- `window.addEventListener('error')` — catches uncaught errors, sends to Sentry.
- `window.addEventListener('unhandledrejection')` — catches unhandled promise rejections, sends to Sentry.
- Both attempt stale asset recovery before logging.

---

## 4. Logger

### Behavior

| Method | Dev | Test | Production |
|--------|-----|------|------------|
| `logger.log` | ✅ | ❌ | ❌ |
| `logger.warn` | ✅ | ❌ | ✅ |
| `logger.error` | ✅ | ❌ | ✅ |
| `logger.debug` | ✅ | ❌ | ❌ |
| `logger.info` | ✅ | ❌ | ❌ |

### Critical Fix (Phase 8.8)

`logger.warn` was previously dev-only (`isDev && console.warn`). This meant **payout RPC failures, notification failures, and stale asset recovery warnings were silent in production**. Fixed to `!isTest && console.warn` — now visible in production.

---

## 5. Production Incident Debugging Checklist

### 1. Check Sentry Dashboard

- Go to Sentry project dashboard.
- Filter by `source: error-boundary` for render crashes.
- Filter by `source: window.error` for uncaught errors.
- Filter by `source: window.unhandledrejection` for unhandled promise rejections.
- Check replay sessions for user context.

### 2. Check Browser Console

- Look for `[Qotoof]` prefix in console.warn/error.
- `payout_rpc_failed` — payout status update RPC failed.
- `payout_notification_failed` — notification insert failed (best-effort).
- `refund_record_failed` — refund insert failed.
- `Attempting stale asset recovery` — chunk load failure, auto-reload attempted.

### 3. Check Supabase

- Verify Supabase project is online (Supabase dashboard).
- Check Edge Function logs for PayPal checkout/capture failures.
- Check database logs for RPC errors (`update_payout_status_transactional`).
- Check `financial_audit_log` table for payout audit trail.

### 4. Check PayPal

- Verify PayPal API status (status.paypal.com).
- Check PayPal developer dashboard for transaction errors.
- Verify `VITE_PAYPAL_CLIENT_ID` is correct for the environment.

### 5. Common Issues

| Symptom | Likely Cause | Debug Step |
|---------|-------------|------------|
| White screen | Render crash | Check Sentry for `error-boundary` errors |
| Redirect loop | Auth/profile loading issue | Check `ProtectedRoute` loading state |
| Checkout fails | PayPal API error | Check Edge Function logs |
| Payout fails | RPC error | Check `update_payout_status_transactional` in Supabase |
| Chunk load error | Stale cached assets | Auto-recovery should trigger; check `staleAssetRecovery` |
| Login fails | Supabase Auth error | Check Supabase Auth logs |
| Notification missing | Best-effort insert failed | Check `payout_notification_failed` in console |

---

## 6. Deployment Checklist

- [ ] `VITE_SUPABASE_URL` set
- [ ] `VITE_SUPABASE_ANON_KEY` set
- [ ] `VITE_PAYPAL_CLIENT_ID` set
- [ ] `VITE_PAYMENT_MODE` set to `production`
- [ ] `VITE_SENTRY_DSN` set (or using default)
- [ ] `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run check:circular` passes
- [ ] All migrations applied to production Supabase
- [ ] Edge Functions deployed
- [ ] PayPal webhook configured
- [ ] Sentry project configured and receiving events
- [ ] Error tracking verified in staging

---

## 7. Remaining Observability Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| No structured logging | Low | Logger uses `console.warn/error` — not structured JSON. Sentry captures context via `logError()`. |
| No metrics | Low | No performance metrics (p95 latency, error rate) beyond Sentry traces. |
| No alerting | Medium | No Sentry alert rules configured. |
| Analytics fetch failures silent | Low | `analytics.js` `.catch(() => {})` — acceptable for analytics. |
| Auth audit log failures silent | Low | `authActionsService.js` `.catch(() => {})` — acceptable for best-effort audit. |
