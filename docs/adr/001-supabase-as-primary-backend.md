# ADR 001 — Supabase as Primary Backend

**Date:** 2025-05-19  
**Status:** Accepted  
**Deciders:** Engineering team

---

## Context

Qotoof is a multi-role marketplace (buyer, vendor, driver, admin). At the start
of the project an Express/Node.js sidecar with a separate PostgreSQL instance
was used for driver management. As feature scope grew, this created two sources
of truth and an inconsistent auth layer.

Supabase was already in use for auth. Its built-in PostgreSQL, Row Level
Security, Realtime, and Edge Functions made it a natural fit to consolidate
the entire backend.

## Decision

Supabase is the **single source of truth** for all persistent data and auth.

- All tables live in Supabase Postgres (not a separate DB).
- RLS policies enforce authorization at the database layer — no app-level
  ownership checks are trusted as the sole guard.
- Realtime subscriptions (websockets) replace polling.
- The Express sidecar (`src/api/`) is **deprecated** and will be removed
  after the two remaining write routes are migrated to Edge Functions.

## Consequences

**Positive:**
- Single auth token (Supabase JWT) used everywhere.
- RLS provides defense in depth against IDOR attacks.
- No separate DB to provision, migrate, or secure.
- Realtime order status updates without polling.

**Negative / risks:**
- Supabase vendor lock-in. Mitigation: all data is standard PostgreSQL;
  migrations are plain SQL files under `supabase/migrations/`.
- Edge Functions run on Deno, which limits npm package reuse.
  Mitigation: keep Edge Functions thin (auth guard + single DB write).

## Alternatives considered

| Option | Reason rejected |
|--------|-----------------|
| Keep Express sidecar as primary | Two sources of truth; separate auth complexity |
| NestJS monolith | Over-engineered for current team size and scope |
| Firebase | NoSQL — poor fit for relational order/payment data |
