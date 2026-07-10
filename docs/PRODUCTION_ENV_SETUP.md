# QOTOOF Production Environment Setup (Secure)

This document defines where each environment variable must live before production deployment.

Security rules applied:
- Never put server secrets in frontend `VITE_` variables.
- Never commit secrets to GitHub.
- Public frontend variables are allowed in hosting env/build secrets.
- Server secrets must be set in Supabase Edge Function secrets.

## Variable Classification Matrix

| Variable | Type | Where to set | Required in production | Source | Current workspace status | Supabase secret command |
|---|---|---|---|---|---|---|
| VITE_SUPABASE_URL | Public frontend variable | Hosting env / `.env.production` | Yes | Supabase Project Settings → API | Placeholder in templates | N/A |
| VITE_SUPABASE_ANON_KEY | Public frontend variable | Hosting env / `.env.production` | Yes | Supabase Project Settings → API | Placeholder in templates | N/A |
| VITE_PAYPAL_CLIENT_ID | Public frontend variable | Hosting env / `.env.production` | Yes (if PayPal enabled) | PayPal Developer Dashboard (Live app) | Placeholder in templates | N/A |
| VITE_PAYMENT_MODE | Public frontend variable | Hosting env / `.env.production` | Yes | Internal config | Set to `production` in templates | N/A |
| PAYPAL_CLIENT_SECRET | Server secret | Supabase Edge Function secrets | Yes (if PayPal enabled) | PayPal Developer Dashboard (Live app) | Removed from tracked/public templates | `supabase secrets set PAYPAL_CLIENT_SECRET="PASTE_LIVE_PAYPAL_CLIENT_SECRET_HERE"` |
| PAYPAL_API_BASE | Optional variable | Supabase Edge Function secrets (or default by mode) | Optional | Internal config | Optional | `supabase secrets set PAYPAL_API_BASE="https://api-m.paypal.com"` |
| RESEND_API_KEY | Server secret | Supabase Edge Function secrets | Yes (if email sending enabled) | Resend API keys | Removed from tracked/public templates | `supabase secrets set RESEND_API_KEY="PASTE_PRODUCTION_RESEND_API_KEY_HERE"` |
| SUPABASE_SERVICE_ROLE_KEY | Server secret | Supabase Edge Function secrets | Yes | Supabase Project Settings → API | Removed from tracked/public templates | `supabase secrets set SUPABASE_SERVICE_ROLE_KEY="PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE"` |
| GOOGLE_CLIENT_SECRET | Server secret | Supabase Edge Function secrets | Optional (only if Google OAuth backend flow uses it) | Google Cloud Console → OAuth client | Placeholder-only guidance | `supabase secrets set GOOGLE_CLIENT_SECRET="PASTE_GOOGLE_CLIENT_SECRET_HERE"` |
| CMI_STORE_KEY | Server secret | Supabase Edge Function secrets | Yes (if CMI enabled) | CMI merchant portal | Placeholder-only guidance | `supabase secrets set CMI_STORE_KEY="PASTE_CMI_STORE_KEY_HERE"` |
| CMI_MERCHANT_ID | Server secret (for Edge Functions), with optional public merchant id | Supabase Edge Function secrets (server usage) | Yes (if CMI enabled) | CMI merchant portal | Placeholder in templates | `supabase secrets set CMI_MERCHANT_ID="PASTE_CMI_MERCHANT_ID_HERE"` |
| VITE_CMI_MERCHANT_ID | Public frontend variable (non-secret merchant id) | Hosting env / `.env.production` | Optional (if CMI UI shown) | CMI merchant portal | Placeholder in templates | N/A |
| VITE_RECAPTCHA_SITE_KEY | Public frontend variable | Hosting env / `.env.production` | Recommended | Google reCAPTCHA Admin Console | Placeholder in templates | N/A |
| VITE_SENTRY_DSN | Public frontend variable | Hosting env / `.env.production` | Recommended | Sentry Project Settings → Client Keys (DSN) | Placeholder in templates | N/A |
| VITE_FIREBASE_API_KEY | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings → General | Placeholder in templates | N/A |
| VITE_FIREBASE_AUTH_DOMAIN | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings | Placeholder in templates | N/A |
| VITE_FIREBASE_PROJECT_ID | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings | Placeholder in templates | N/A |
| VITE_FIREBASE_STORAGE_BUCKET | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings | Placeholder in templates | N/A |
| VITE_FIREBASE_MESSAGING_SENDER_ID | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings | Placeholder in templates | N/A |
| VITE_FIREBASE_APP_ID | Public frontend variable | Hosting env / `.env.production` | If Firebase web SDK used | Firebase Project Settings | Placeholder in templates | N/A |
| VITE_GA_ID | Optional variable | Hosting env / `.env.production` | Optional | Google Analytics (GA4) | Placeholder in templates | N/A |
| VITE_GA_MEASUREMENT_ID | Deprecated / duplicate | Avoid new usage, keep only one GA variable | Optional | GA4 | Duplicate naming detected vs `VITE_GA_ID` | N/A |
| VITE_API_URL | Public frontend variable | Hosting env / `.env.production` | Recommended | Your backend/API domain | Set to non-localhost placeholder | N/A |
| VITE_API_BASE_URL | Deprecated / unused in frontend runtime | Do not use (prefer `VITE_API_URL`) | No | Internal | Found in old local production file and was localhost; removed from secure templates | N/A |
| VITE_CMI_STORE_KEY | Deprecated / unsafe | Must not exist | No | N/A | Removed (must never be VITE_) | N/A |
| PAYPAL_ENVIRONMENT / PAYMENT_MODE | Optional variable | Supabase Edge Function secrets (`PAYMENT_MODE` or `PAYPAL_ENVIRONMENT`) | Optional | Internal | Edge functions already branch on mode; may be set explicitly | `supabase secrets set PAYMENT_MODE="production"` |

## Required Supabase Secrets Commands

Run from project root after Supabase login:

```bash
supabase secrets set PAYPAL_CLIENT_SECRET="PASTE_LIVE_PAYPAL_CLIENT_SECRET_HERE"
supabase secrets set RESEND_API_KEY="PASTE_PRODUCTION_RESEND_API_KEY_HERE"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE"
supabase secrets set GOOGLE_CLIENT_SECRET="PASTE_GOOGLE_CLIENT_SECRET_HERE"
supabase secrets set CMI_STORE_KEY="PASTE_CMI_STORE_KEY_HERE"
```

Recommended additional secrets used by current Edge Functions:

```bash
supabase secrets set CMI_MERCHANT_ID="PASTE_CMI_MERCHANT_ID_HERE"
supabase secrets set PAYMENT_MODE="production"
supabase secrets set PAYPAL_API_BASE="https://api-m.paypal.com"
supabase secrets set PAYPAL_SETTLEMENT_CURRENCY="EUR"
supabase secrets set PAYPAL_MAD_EXCHANGE_RATE="0.092"
supabase secrets set ALLOWED_ORIGINS="https://qotoof.ma,https://YOUR_HOSTING_DOMAIN"
```

## Audit Notes (workspace)

- `.env` is gitignored and may contain local values; keep it local-only.
- `.env.production` was sanitized to public-only placeholders and no localhost API URL.
- `.env.example` was sanitized to placeholders and explicit secret separation.
- `.env.production.example` was added for safe production onboarding.

## Validation Checklist Before Deploy

1. Public frontend values configured in hosting environment.
2. Server secrets configured via Supabase secrets.
3. No secret keys present in any `VITE_` variable.
4. `VITE_PAYMENT_MODE=production`.
5. No localhost endpoints in production env.
6. Build passes: `npm run build`.

## Quick Verification Commands (safe)

```bash
# Find possible server secrets wrongly placed in frontend env files
grep -RIn "^VITE_.*\(SECRET\|SERVICE_ROLE\|STORE_KEY\)" .env* || true

# Confirm no localhost in production template
grep -n "localhost" .env.production .env.production.example || true

# Confirm payment mode is production in production template
grep -n "^VITE_PAYMENT_MODE=" .env.production .env.production.example
```
