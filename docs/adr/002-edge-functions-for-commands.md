# ADR 002 — Edge Functions for Write Commands

**Date:** 2025-05-19  
**Status:** Accepted  
**Deciders:** Engineering team

---

## Context

Some write operations require logic that cannot (or should not) run in the
browser:

- Payment confirmation — must call external gateway and verify server-side.
- Commission calculation — amount must not be caller-controlled.
- Order status transitions — must validate the current state before advancing.

Two approaches were considered: (1) allow the React app to write directly via
PostgREST + RLS, or (2) route writes through Supabase Edge Functions.

## Decision

**Stateful write commands go through Edge Functions.** Read-only queries and
simple inserts with clear RLS ownership (e.g., creating a cart item) may go
directly through PostgREST.

Rule of thumb:
- If the write depends on a secret (API key, service_role key) → Edge Function.
- If the write triggers side effects (email, payment, commission) → Edge Function.
- If the write requires a multi-step transaction → Edge Function.
- Pure CRUD owned by the calling user → PostgREST + RLS.

### Current Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `confirm-order-payment` | Vendor action | Marks payment received; triggers commission calc |
| `register-payment-receipt` | Buyer upload | Records payment proof path in DB |
| `confirm-bank-transfer` | Admin action | Releases funds after manual verification |
| `send-notification` | System | Sends push/email via Resend; uses RESEND_API_KEY |
| `process-paypal` | Buyer redirect | Validates PayPal token with PayPal API |

## Consequences

**Positive:**
- Secrets (RESEND_API_KEY, PayPal credentials) never touch the client bundle.
- Server-side validation prevents state-machine bypasses.
- Deno runtime starts cold in ~50 ms — acceptable for command paths.

**Negative / risks:**
- Edge Functions cannot be unit-tested locally without `supabase functions serve`.
- Deno's module system differs from Node.js; npm packages need esm.sh or CDN imports.

## Alternatives considered

| Option | Reason rejected |
|--------|-----------------|
| All writes via PostgREST + RLS triggers | PG triggers lack HTTP call capability (no secrets access) |
| Dedicated Node.js API (revive sidecar) | Adds infra complexity; conflicts with ADR 001 |
