# GitHub Repository Secrets Required for CI/CD
#
# Add these in: Settings → Secrets and variables → Actions → New repository secret
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
#
# ─── reCAPTCHA ───────────────────────────────────────────────────────────────
# VITE_RECAPTCHA_SITE_KEY     — v2 checkbox site key (public, safe in browser)
#
# ─── NEVER commit ────────────────────────────────────────────────────────────
# SUPABASE_SERVICE_ROLE_KEY  — server-only; only used inside Edge Functions via Deno.env
# RECAPTCHA_SECRET_KEY        — server-only; only used inside Edge Functions via Deno.env
