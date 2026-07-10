# Phase 8.14 — Edge Functions CI/CD Deployment Coverage Report

**Date:** 2026-06-27  
**Phase:** 8.14  
**Objective:** Fix the CI/CD deployment coverage gap (B-007) where only 1 of 47 Supabase Edge Functions was deployed by GitHub Actions.

---

## 1. `.windsurfrules` Compliance

- **Read and followed:** ✅ `.windsurfrules` was read in full before any action.
- **Protected zone:** `.github/workflows/cd.yml` and `supabase/functions/` are in the RLS/Auth/Payments Protected Zone (Section 37).
- **Approval required:** ✅ Yes — explicit user approval was requested and received before modifying `cd.yml`.
- **Approval method:** User selected "Approve — Option B" (tiered matrix strategy, critical-first, fail-fast).
- **No forbidden actions:** No Edge Function logic changes, no payment/webhook rewrites, no schema/RLS changes, no secret exposure, no UI changes, no new dependencies.

---

## 2. Phase Type

**Edge Functions CI/CD Deployment Coverage** — fixing the deployment workflow to cover all 47 Supabase Edge Functions.

---

## 3. Existing CI/CD Workflow Audit

### Workflow Files Found

| File | Purpose | Edge Functions Deployed? |
|------|---------|:---:|
| `.github/workflows/ci.yml` | Lint, test, build, bundle size, lighthouse | ❌ No |
| `.github/workflows/cd.yml` | Deploy Edge Functions + Firebase Hosting | ⚠️ Only 1 of 47 |
| `.github/workflows/monitoring.yml` | Production health checks (cron) | ❌ No |
| `.github/workflows/pr-preview.yml` | PR preview on Firebase Hosting | ❌ No |

### `cd.yml` Audit (Before Fix)

| Aspect | Finding |
|--------|---------|
| **Trigger** | `workflow_run` (after CI succeeds on push to `main`) + `workflow_dispatch` (manual) |
| **Functions deployed** | Only `auth-admin-ops` (1 of 47) |
| **Supabase CLI** | Installed via `supabase/setup-cli@v1` with `version: latest` |
| **Authentication** | `SUPABASE_ACCESS_TOKEN` GitHub secret |
| **Project targeting** | `SUPABASE_PROJECT_REF` GitHub secret |
| **Migrations in CI/CD** | ❌ No — migrations are manual via `npm run db:push` |
| **Secret safety** | ✅ No secrets in build env; server-only secrets excluded with explicit comment |
| **Deployment order** | Build → Deploy Functions → Deploy Hosting |
| **Concurrency** | `deploy-production` group, never cancels in-flight deploy |
| **`supabase/config.toml`** | ❌ Not present in project |

### Root Cause of B-007

The `deploy-functions` job in `cd.yml` contained only a single hardcoded step for `auth-admin-ops`. No other functions were ever added. This was likely an initial placeholder that was never expanded.

---

## 4. Function Deployment Coverage Matrix

### Tier 1 — Critical (30 functions) — `fail-fast: true`

| # | Function | Category | Deployed by CI (before)? | Deployed by CI (after)? | Requires extra secrets? | Safe to auto-deploy? |
|---|----------|----------|:---:|:---:|:---:|:---:|
| 1 | `calculate-checkout-pricing` | Payment | ❌ | ✅ | No | ✅ |
| 2 | `create-checkout-order` | Payment | ❌ | ✅ | No | ✅ |
| 3 | `create-paypal-order` | Payment | ❌ | ✅ | PayPal | ✅ |
| 4 | `capture-paypal-order` | Payment | ❌ | ✅ | PayPal | ✅ |
| 5 | `confirm-order-payment` | Payment | ❌ | ✅ | No | ✅ |
| 6 | `payment-status-write` | Payment | ❌ | ✅ | No | ✅ |
| 7 | `register-payment-receipt` | Payment | ❌ | ✅ | No | ✅ |
| 8 | `get-bank-details` | Payment | ❌ | ✅ | No | ✅ |
| 9 | `confirm-bank-transfer` | Payment | ❌ | ✅ | No | ✅ |
| 10 | `paypal-webhook` | Payment | ❌ | ✅ | PayPal + Webhook ID | ✅ |
| 11 | `refund-paypal-payment` | Payment | ❌ | ✅ | PayPal | ✅ |
| 12 | `refund-payment` | Payment | ❌ | ✅ | No | ✅ |
| 13 | `process-manual-refund` | Payment | ❌ | ✅ | No | ✅ |
| 14 | `reconcile-paypal-payments` | Payment | ❌ | ✅ | PayPal | ✅ |
| 15 | `send-payout` | Payout | ❌ | ✅ | No | ✅ |
| 16 | `process-vendor-payout` | Payout | ❌ | ✅ | No | ✅ |
| 17 | `commission-cron` | Commission | ❌ | ✅ | No | ✅ |
| 18 | `stripe-webhook` | Payment | ❌ | ✅ | Stripe | ✅ |
| 19 | `stripe-checkout` | Payment | ❌ | ✅ | Stripe | ✅ |
| 20 | `create-payment-intent` | Payment | ❌ | ✅ | Stripe | ✅ |
| 21 | `cmi-payment` | Payment | ❌ | ✅ | CMI | ✅ |
| 22 | `create-cmi-session` | Payment | ❌ | ✅ | CMI | ✅ |
| 23 | `verify-cmi-callback` | Payment | ❌ | ✅ | CMI | ✅ |
| 24 | `refund-cmi-payment` | Payment | ❌ | ✅ | CMI | ✅ |
| 25 | `auth-admin-ops` | Auth | ✅ | ✅ | No | ✅ |
| 26 | `create-user-with-role` | Auth | ❌ | ✅ | No | ✅ |
| 27 | `secure-login` | Auth | ❌ | ✅ | No | ✅ |
| 28 | `sync-role` | Auth | ❌ | ✅ | No | ✅ |
| 29 | `request-phone-otp` | Auth | ❌ | ✅ | Twilio | ✅ |
| 30 | `verify-phone-otp` | Auth | ❌ | ✅ | Twilio | ✅ |

### Tier 2 — Standard (17 functions) — `fail-fast: false`

| # | Function | Category | Deployed by CI (before)? | Deployed by CI (after)? | Requires extra secrets? | Safe to auto-deploy? |
|---|----------|----------|:---:|:---:|:---:|:---:|
| 31 | `accept-delivery` | Delivery | ❌ | ✅ | No | ✅ |
| 32 | `reject-delivery` | Delivery | ❌ | ✅ | No | ✅ |
| 33 | `assign-driver` | Delivery | ❌ | ✅ | No | ✅ |
| 34 | `auto-assign-driver` | Delivery | ❌ | ✅ | No | ✅ |
| 35 | `mark-delivery-picked-up` | Delivery | ❌ | ✅ | No | ✅ |
| 36 | `mark-delivery-on-the-way` | Delivery | ❌ | ✅ | No | ✅ |
| 37 | `mark-delivery-delivered` | Delivery | ❌ | ✅ | No | ✅ |
| 38 | `accept-order` | Orders | ❌ | ✅ | No | ✅ |
| 39 | `reject-order` | Orders | ❌ | ✅ | No | ✅ |
| 40 | `public-order-tracking` | Orders | ❌ | ✅ | No | ✅ |
| 41 | `redeem-coupon` | Orders | ❌ | ✅ | No | ✅ |
| 42 | `send-email` | Communication | ❌ | ✅ | Resend | ✅ |
| 43 | `send-sms` | Communication | ❌ | ✅ | Twilio | ✅ |
| 44 | `create-support-ticket` | Support | ❌ | ✅ | No | ✅ |
| 45 | `award-loyalty-points` | Loyalty | ❌ | ✅ | No | ✅ |
| 46 | `get-public-config` | Config | ❌ | ✅ | No | ✅ |
| 47 | `process-outbox` | Infrastructure | ❌ | ✅ | No | ✅ |

### Summary

| Metric | Before | After |
|--------|:------:|:-----:|
| Functions deployed by CI/CD | 1/47 (2%) | 47/47 (100%) |
| Payment-critical deployed | 0/22 (0%) | 22/22 (100%) |
| Auth/security deployed | 1/6 (17%) | 6/6 (100%) |
| Fail-fast on critical | N/A | ✅ |
| Non-critical tolerance | N/A | ✅ |

---

## 5. Chosen Deployment Approach

**Option B — Tiered Matrix Strategy (Critical-First, Fail-Fast)**

### Design

| Tier | Functions | Fail-Fast | Max-Parallel | Rationale |
|------|-----------|:---------:|:------------:|-----------|
| Tier 1 (`deploy-functions-critical`) | 30 (payment + auth/security) | ✅ `true` | 5 | Critical functions must all deploy successfully. Any failure stops deployment. |
| Tier 2 (`deploy-functions-standard`) | 17 (delivery, orders, comm, infra) | ❌ `false` | 5 | Non-critical functions can fail without blocking hosting deploy. |

### Execution Flow

```
CI (ci.yml) succeeds on push to main
  → cd.yml triggered via workflow_run
    → deployment-readiness (check secrets)
    → build (npm ci, deploy:check, build)
    → deploy-functions-critical (matrix of 30, fail-fast)
      → deploy-functions-standard (matrix of 17, no fail-fast)
        → deploy-hosting (Firebase Hosting)
```

### Key Properties

- **No secrets hardcoded:** All via `${{ secrets.* }}` references
- **No secrets in logs:** Supabase CLI only outputs deployment status, not secrets
- **Fail-fast on critical:** If any Tier 1 function fails, Tier 2 and hosting deploy are blocked
- **Non-critical tolerance:** Tier 2 failures don't block hosting deploy (allows graceful degradation)
- **Matrix visibility:** Each function deployment is a separate job in GitHub Actions UI
- **`max-parallel: 5`:** Prevents overwhelming Supabase API with concurrent deploys
- **No `workflow_dispatch`-only restriction:** Deploys on push to main (existing behavior preserved)
- **No Edge Function code changes:** Only the deployment workflow changed

---

## 6. Files Changed

| File | Change | Lines |
|------|--------|-------|
| `.github/workflows/cd.yml` | Replaced single `deploy-functions` job with `deploy-functions-critical` (matrix, 30 functions) + `deploy-functions-standard` (matrix, 17 functions). Updated `deploy-hosting` needs and if condition. | 125-244 (was 125-155) |

### No other files changed

- No Edge Function code modified
- No payment/webhook logic modified
- No schema/RLS changes
- No new dependencies
- No new scripts

---

## 7. Secrets Required

### GitHub Actions Secrets (for CI/CD)

| Secret | Purpose | Already in use? |
|--------|---------|:---:|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI authentication | ✅ |
| `SUPABASE_PROJECT_REF` | Target Supabase project | ✅ |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Hosting deploy | ✅ |
| `FIREBASE_TOKEN` | Firebase Hosting deploy (alternative) | ✅ |
| `FIREBASE_DEPLOY_PROJECT_ID` | Firebase project ID | ✅ |

### Supabase Edge Function Secrets (set via `supabase secrets set`)

These are NOT in GitHub Actions — they are set directly on the Supabase project. CI/CD only deploys function code; secrets are managed separately.

| Secret | Required By | Set Command |
|--------|-------------|-------------|
| `SUPABASE_URL` | All functions | `supabase secrets set SUPABASE_URL=... --project-ref <ref>` |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions | `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref <ref>` |
| `PAYPAL_CLIENT_SECRET` | PayPal functions | `supabase secrets set PAYPAL_CLIENT_SECRET=... --project-ref <ref>` |
| `PAYPAL_WEBHOOK_ID` | `paypal-webhook` | `supabase secrets set PAYPAL_WEBHOOK_ID=... --project-ref <ref>` |
| `STRIPE_SECRET_KEY` | Stripe functions | `supabase secrets set STRIPE_SECRET_KEY=... --project-ref <ref>` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | `supabase secrets set STRIPE_WEBHOOK_SECRET=... --project-ref <ref>` |
| `CMI_STORE_KEY` | CMI functions | `supabase secrets set CMI_STORE_KEY=... --project-ref <ref>` |
| `CMI_MERCHANT_ID` | CMI functions | `supabase secrets set CMI_MERCHANT_ID=... --project-ref <ref>` |
| `RESEND_API_KEY` | `send-email` | `supabase secrets set RESEND_API_KEY=... --project-ref <ref>` |
| `TWILIO_ACCOUNT_SID` | SMS/OTP functions | `supabase secrets set TWILIO_ACCOUNT_SID=... --project-ref <ref>` |
| `TWILIO_AUTH_TOKEN` | SMS/OTP functions | `supabase secrets set TWILIO_AUTH_TOKEN=... --project-ref <ref>` |
| `TWILIO_FROM_NUMBER` | SMS/OTP functions | `supabase secrets set TWILIO_FROM_NUMBER=... --project-ref <ref>` |

**Note:** Functions deployed without their required secrets will still deploy successfully (code is deployed), but will fail at runtime when invoked. Secrets must be set before or after deployment, independently.

---

## 8. Verification Commands

### Pre-Deployment Verification

```bash
# 1. Verify Supabase CLI auth
supabase login
supabase projects list

# 2. Verify project linked
echo $SUPABASE_PROJECT_REF
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF" | jq .name

# 3. Verify secrets are set
supabase secrets list --project-ref <PROJECT_REF>
```

### Post-Deployment Verification

```bash
# 4. List deployed functions
supabase functions list --project-ref <PROJECT_REF>

# 5. Check function logs
supabase functions logs paypal-webhook --project-ref <PROJECT_REF>
supabase functions logs capture-paypal-order --project-ref <PROJECT_REF>
supabase functions logs refund-paypal-payment --project-ref <PROJECT_REF>

# 6. Test health endpoint (get-public-config)
curl -s https://<PROJECT_REF>.supabase.co/functions/v1/get-public-config | jq .

# 7. Test PayPal webhook endpoint reachability (should return 405 for GET)
curl -s -o /dev/null -w "%{http_code}" \
  https://<PROJECT_REF>.supabase.co/functions/v1/paypal-webhook
# Expected: 405 (Method not allowed — only POST is accepted)

# 8. Verify no secrets in logs
supabase functions logs paypal-webhook --project-ref <PROJECT_REF> | grep -iE "(secret|key|password|token)"
# Expected: no output (no secrets logged)
```

### CI/CD Workflow Verification

```bash
# Trigger workflow manually
gh workflow run cd.yml --repo <org/repo>

# Check workflow status
gh run list --workflow=cd.yml --limit 5

# Check specific run details
gh run view <run_id> --log
```

---

## 9. Manual Deployment Fallback

If CI/CD is unavailable or a function needs manual deployment:

```bash
# Login
supabase login

# Deploy a single function
supabase functions deploy <function_name> --project-ref <PROJECT_REF>

# Deploy all critical functions (script)
for fn in \
  calculate-checkout-pricing create-checkout-order create-paypal-order \
  capture-paypal-order confirm-order-payment payment-status-write \
  register-payment-receipt get-bank-details confirm-bank-transfer \
  paypal-webhook refund-paypal-payment refund-payment \
  process-manual-refund reconcile-paypal-payments send-payout \
  process-vendor-payout commission-cron stripe-webhook stripe-checkout \
  create-payment-intent cmi-payment create-cmi-session verify-cmi-callback \
  refund-cmi-payment auth-admin-ops create-user-with-role secure-login \
  sync-role request-phone-otp verify-phone-otp; do
  echo "Deploying $fn..."
  supabase functions deploy "$fn" --project-ref <PROJECT_REF>
done

# Deploy all standard functions
for fn in \
  accept-delivery reject-delivery assign-driver auto-assign-driver \
  mark-delivery-picked-up mark-delivery-on-the-way mark-delivery-delivered \
  accept-order reject-order public-order-tracking redeem-coupon \
  send-email send-sms create-support-ticket award-loyalty-points \
  get-public-config process-outbox; do
  echo "Deploying $fn..."
  supabase functions deploy "$fn" --project-ref <PROJECT_REF>
done
```

---

## 10. Rollback Procedure

### Rollback a Single Function

```bash
# Checkout the previous commit that had the working version
git checkout <previous_commit> -- supabase/functions/<function_name>/index.ts

# Redeploy
supabase functions deploy <function_name> --project-ref <PROJECT_REF>
```

### Rollback All Functions

```bash
# Checkout previous commit
git checkout <previous_commit> -- supabase/functions/

# Redeploy all
for fn in $(ls -d supabase/functions/*/ | xargs -n1 basename | grep -v _shared); do
  supabase functions deploy "$fn" --project-ref <PROJECT_REF>
done
```

### Rollback via CI/CD

```bash
# Revert the commit that introduced the issue
git revert <commit_hash>
git push origin main

# CI will trigger automatically and redeploy the previous version
```

---

## 11. Test/Check Results

| Check | Command | Result |
|-------|---------|:------:|
| YAML lint | `npx yaml-lint .github/workflows/cd.yml` | ✅ Valid |
| Type check | `npm run type-check` | ✅ Pass |
| Lint | `npm run lint` | ✅ Pass (0 errors, 2 warnings — expected Deno globals in Edge Functions) |
| Build | `npm run build` | ✅ Pass |
| Circular deps | `npm run check:circular` | ✅ Pass (727 files, 0 circular) |
| PayPal webhook tests | `npx jest paypal.webhook.test.js` | ✅ 35/35 pass |
| PayPal sandbox tests | `npx jest paypal.sandbox.integration.test.js` | ✅ 53 pass, 1 skipped |

---

## 12. Updated Status of B-003 and B-007

### B-007 — CI/CD deploys only one Edge Function

**Status: ✅ CLOSED (code fix applied)**

- **Before:** `cd.yml` deployed only `auth-admin-ops` (1 of 47 functions)
- **After:** `cd.yml` deploys all 47 functions via tiered matrix strategy
  - Tier 1 (critical): 30 functions, `fail-fast: true`, `max-parallel: 5`
  - Tier 2 (standard): 17 functions, `fail-fast: false`, `max-parallel: 5`
- **Remaining:** CI/CD must be triggered (push to main or manual dispatch) to actually deploy. Secrets must be set on Supabase project before functions can operate.

### B-003 — Edge Functions not deployed to production

**Status: ⚠️ PARTIALLY RESOLVED (code ready, execution pending)**

- **Before:** No CI/CD coverage for 46 functions; manual deployment required for all
- **After:** CI/CD now covers all 47 functions. However, actual deployment has not been executed yet.
- **Remaining:** 
  1. GitHub Actions secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) must be set in repository settings
  2. Supabase Edge Function secrets must be set via `supabase secrets set`
  3. Workflow must be triggered (push to main or `workflow_dispatch`)
  4. Deployment must be verified via `supabase functions list`

---

## 13. What Remains Manual

| Task | Why Manual? | When? |
|------|-------------|-------|
| Set Supabase Edge Function secrets | Secrets must be set via `supabase secrets set` CLI, not in CI/CD | Before first deployment |
| Apply migration 036 | Migrations are not in CI/CD (by design — requires manual approval) | Before first deployment |
| Configure PayPal webhook in dashboard | PayPal Developer Dashboard configuration | Before sandbox E2E |
| Set GitHub Actions secrets | Repository settings → Secrets and variables → Actions | Before first CI/CD deploy |
| Verify deployment | Check `supabase functions list` and logs after deploy | After each deploy |

---

## 14. What Remains Blocked by Credentials

| Blocker | Type | Resolution |
|---------|------|------------|
| B-001 | PayPal live credentials not set | Operational — set via `supabase secrets set PAYPAL_CLIENT_SECRET=...` |
| B-002 | PayPal webhook dashboard config pending | Operational — configure in PayPal Developer Dashboard |
| B-003 | Edge Functions not deployed (execution pending) | Operational — trigger CI/CD or deploy manually |
| B-008 | Sandbox E2E not executed | Verification — run sandbox E2E plan from Phase 8.13 |

---

## 15. Production Readiness Score Estimate

| Category | Before (Phase 8.13) | After (Phase 8.14) | Change |
|----------|:---:|:---:|:---:|
| Code Completeness | 95 | 95 | — |
| Test Coverage | 90 | 90 | — |
| Edge Function Code | 95 | 95 | — |
| Migration Readiness | 100 | 100 | — |
| Secrets Documentation | 100 | 100 | — |
| **CI/CD Deployment** | **20** | **95** | **+75** |
| PayPal Webhook Config | 50 | 50 | — |
| Sandbox E2E Verification | 0 | 0 | — |
| Observability | 86 | 86 | — |
| Security | 90 | 90 | — |

**Overall estimate: 94/100 → 96/100 (+2)**

The +2 reflects closing B-007 (CI/CD coverage gap) and partially resolving B-003 (code path ready, execution pending). The remaining blockers (B-001, B-002, B-003 execution, B-008) are all operational and cannot be resolved by code changes alone.

---

## 16. Recommended Phase 8.15

**Sandbox End-to-End Manual Execution**

### Rationale

With B-007 closed and CI/CD coverage at 100%, the next critical step is to actually execute the sandbox E2E verification plan documented in Phase 8.13. This requires:

1. Apply migration 036 to sandbox Supabase project
2. Set all required Supabase Edge Function secrets
3. Deploy all Edge Functions (via CI/CD or manually)
4. Configure PayPal sandbox webhook in PayPal Developer Dashboard
5. Execute the 10 sandbox E2E test scenarios
6. Verify webhook events are received and processed
7. Verify idempotency, refund flow, and admin verification

This is an operational phase, not a code phase. It requires access to:
- Supabase project (sandbox)
- PayPal Developer Dashboard (sandbox)
- GitHub repository settings (for CI/CD secrets)

### Alternative phases (deferred)

- **Production Environment Setup** — after sandbox E2E passes
- **Live PayPal Verification** — after production environment is set up
- **Live Supabase Integration Tests** — after production credentials are configured
- **Migration/RLS Test Tooling** — can be done in parallel but lower priority

---

## 17. Summary

Phase 8.14 successfully closed the CI/CD deployment coverage gap (B-007) by replacing the single-function deployment step in `cd.yml` with a tiered matrix strategy that deploys all 47 Supabase Edge Functions. The fix was minimal (only `cd.yml` changed), safe (no Edge Function code changes, no secret exposure, no payment logic changes), and follows the protected-zone approval process required by `.windsurfrules`.

**Key achievement:** CI/CD deployment coverage went from 1/47 (2%) to 47/47 (100%), with all 22 payment-critical functions included in the fail-fast Tier 1.

**Remaining work:** Operational execution — set secrets, trigger deployment, run sandbox E2E — is recommended for Phase 8.15.
