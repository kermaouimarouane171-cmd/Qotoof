# Phase 8.24 — FG Issues Closure: PayPal, CORS & Profiles Public SELECT

## Scope

Close the remaining FG issues required for the **Buyer role 100/100 readiness gate**:

- FG-001: `profiles_public_select` exposure
- FG-003: Static MAD→EUR PayPal exchange rate
- FG-004: PayPal API error exposure
- FG-010: Old PayPal order cancellation on retry

FG-002, FG-005, FG-006, FG-007, FG-008, FG-009, and FG-011 were already closed in the previous session.

## Changes

### FG-001 — Drop `profiles_public_select` blanket policy

- Added `database/migrations/038-fix-profiles-public-select-exposure.sql`:
  - Drops the legacy `profiles_public_select` policy that exposed every row/column of `profiles` via `USING (true)`.
  - Re-affirms `public.public_profiles` as the only public-safe cross-user view (`security_invoker = true`).
  - Grants `SELECT` on `public_profiles` to `authenticated` and `anon`.
- Added `src/__tests__/database/profilesRls.test.js` to verify migration 038 drops the bad policy and that no later migration re-introduces it.

### FG-002 — CORS wildcard removal (already completed, extended to PayPal functions)

- Verified the shared CORS helper (`supabase/functions/_shared/cors.ts`) rejects unknown origins and never returns `*`.
- Updated the PayPal Edge Functions to thread the request `Origin` through every response:
  - `capture-paypal-order/index.ts`
  - `reconcile-paypal-payments/index.ts`
  - `create-paypal-order/index.ts`
- Added `src/__tests__/edge/paypalEdgeFunctions.test.js` confirming no PayPal function uses `Access-Control-Allow-Origin: *`.

### FG-003 — Dynamic MAD→EUR PayPal exchange rate

- `create-paypal-order/index.ts` now reads:
  - `PAYPAL_SETTLEMENT_CURRENCY` (default `EUR`)
  - `PAYPAL_MAD_EXCHANGE_RATE` (default `0.092`)
- The `MAD`→`EUR` conversion is environment-driven, not hard-coded in the source beyond the safe fallback.
- Documented both secrets in `docs/PRODUCTION_ENV_SETUP.md`.
- Added test verifying the env-driven rate and settlement currency.

### FG-004 — Sanitize PayPal API error exposure

- `supabase/functions/_shared/paypalCheckout.ts`:
  - Removed `JSON.stringify(data)` from the thrown error message.
  - Full PayPal response is logged server-side only.
- `create-paypal-order/index.ts`:
  - Returns generic `{ error: 'Failed to create PayPal order' }` / `{ error: 'Could not create PayPal order' }` to the client.
  - Logs the full PayPal response and catch error server-side.
- `capture-paypal-order/index.ts`:
  - Returns generic `{ error: 'Could not capture PayPal payment' }` to the client.
  - Logs full error server-side.
- Added test confirming no raw PayPal `details` or debug JSON are forwarded to the client.

### FG-010 — Void old PayPal order on retry

- Added `voidPayPalOrder` helper in `supabase/functions/_shared/paypalCheckout.ts`.
  - Best-effort call to `POST /v2/checkout/orders/{id}/void`.
  - Errors are logged server-side only, never returned to the buyer.
  - Documented in the helper comment: PayPal `CAPTURE` orders expire automatically if unpaid, so this is an acceptable risk.
- `create-paypal-order/index.ts` now:
  - Reads the previous `transaction_id` from the payment record.
  - Calls `voidPayPalOrder` before updating the record with the new PayPal order ID.
- Added test verifying the void helper and the retry flow in `create-paypal-order`.

## Verification

| Command | Result |
| --- | --- |
| `npm test` (Jest) | 174 suites passed, 2169 tests passed, 1 skipped, 2 todo |
| `npm run type-check` | Passed |
| `npm run lint` | Passed (0 errors, 2 pre-existing warnings in `paypal-webhook/index.ts`) |
| `npm run build` | Passed |
| `npm run check:circular` | No circular dependencies |

## Manual deployment notes

1. Apply migration `038-fix-profiles-public-select-exposure.sql` to the target database.
2. Set the new PayPal secrets in Supabase Edge Functions:
   ```bash
   supabase secrets set PAYPAL_SETTLEMENT_CURRENCY="EUR"
   supabase secrets set PAYPAL_MAD_EXCHANGE_RATE="0.092"
   ```
3. Ensure `ALLOWED_ORIGINS` is set to the production domains (no wildcards).
4. Redeploy the PayPal Edge Functions.

## Open items

- **Manual PayPal sandbox E2E**: Create order → approve → capture → confirm order status updated.
- **Manual signup+OTP verification** (B-009): Fresh signup → code received → OTP entered → Supabase verifies → redirect to role dashboard → logout works.
- **Database migration 038** should be applied to the production environment before go-live.

## Conclusion

All remaining FG issues (FG-001, FG-003, FG-004, FG-010) are closed in code and covered by tests. The codebase is ready for the final Buyer role readiness verification.
