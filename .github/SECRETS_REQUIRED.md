# GitHub Repository Secrets Required for CI/CD
#
# Add these in: Settings → Secrets and variables → Actions → New repository secret
# Current deployment target: Firebase Hosting via GitHub Actions
# CI validates PRs/pushes; CD deploys production only after the CI workflow succeeds on main.
#
# ─── Supabase ────────────────────────────────────────────────────────────────
# VITE_SUPABASE_URL          — e.g. https://oyaiiyekfkflesdmcvvo.supabase.co
# VITE_SUPABASE_ANON_KEY     — public anon key (safe to expose in the browser)
# SUPABASE_ACCESS_TOKEN      — personal access token for deploying Edge Functions
#                              (generate at https://supabase.com/dashboard/account/tokens)
#                              IMPORTANT: create it from the same Supabase account/org that can open
#                              the project in the dashboard. A token from a different account will be
#                              treated as unauthorized and Edge Function deploys will be skipped.
# SUPABASE_PROJECT_REF       — project ref ID, e.g. oyaiiyekfkflesdmcvvo
#
# ─── Firebase ────────────────────────────────────────────────────────────────
# VITE_FIREBASE_API_KEY
# VITE_FIREBASE_AUTH_DOMAIN
# VITE_FIREBASE_PROJECT_ID
# VITE_FIREBASE_STORAGE_BUCKET
# VITE_FIREBASE_MESSAGING_SENDER_ID
# VITE_FIREBASE_APP_ID
# FIREBASE_DEPLOY_PROJECT_ID  — Firebase project/site target for GitHub deploys
# FIREBASE_TOKEN              — refresh token or CI token for firebase-tools deploys
#                              (alternative to FIREBASE_SERVICE_ACCOUNT)
# FIREBASE_SERVICE_ACCOUNT   — JSON content of the Firebase service account key
#                              (generate at Firebase Console → Project Settings → Service accounts)
#                              workflow also accepts legacy FIREBASE_SERVICE_ACCOUNT_GREENMARKET_MARKETPLACE

# ─── Build-time app settings ───────────────────────────────────────────────
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are the only hard build blockers
# validated by scripts/pre-deploy-check.mjs.
#
# The following values are recommended for production branding/runtime behavior,
# but the frontend has safe fallbacks and CD no longer fails solely because they
# are absent:
# VITE_APP_NAME               — public app name injected at build time
# VITE_SUPPORT_EMAIL          — public support inbox shown in the frontend
# VITE_SUPPORT_PHONE          — public support phone shown in the frontend
# VITE_COMMISSION_RATE        — build-time commission configuration
# VITE_DELIVERY_BASE_FEE      — build-time delivery pricing baseline
# VITE_DELIVERY_PER_KM_FEE    — build-time delivery distance fee
#
# RESEND_API_KEY is server-side runtime config for Edge Functions such as
# send-email; its absence should not block the static frontend build.
#
# ─── Monitoring / Observability ─────────────────────────────────────────────
# PRODUCTION_APP_URL          — public production URL checked every 30 minutes by .github/workflows/monitoring.yml
#                              e.g. https://qotoof.example.com
# PRODUCTION_API_HEALTHCHECK_URL — optional API health endpoint returning {"status":"ok"}
#                              e.g. https://api.qotoof.example.com/health
#
# ─── reCAPTCHA ───────────────────────────────────────────────────────────────
# VITE_RECAPTCHA_SITE_KEY     — v2 checkbox site key (public, safe in browser)
#
# ─── NEVER commit ────────────────────────────────────────────────────────────
# SUPABASE_SERVICE_ROLE_KEY  — server-only; only used inside Edge Functions via Deno.env
# RECAPTCHA_SECRET_KEY        — server-only; only used inside Edge Functions via Deno.env
