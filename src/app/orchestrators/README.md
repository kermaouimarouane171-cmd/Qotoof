# App-Level Orchestrators

## Purpose

App-level orchestrators coordinate **cross-module flows** that span multiple
feature modules. They live at the app layer (not inside any single module)
because they need to call into several modules and synchronize their state.

## Rule

Orchestrators **compose modules** — they call module public APIs and listen
to module events. They do **not** contain business logic themselves.
Modules must not import from orchestrators.

## Current Orchestrators (re-exported)

| Orchestrator | Source | Responsibility |
|---|---|---|
| `useAuthOrchestrator` | `@/orchestrators/AuthOrchestrator` | Auth lifecycle: session restore, profile load, role routing |
| `useOnboardingOrchestrator` | `@/orchestrators/OnboardingOrchestrator` | Onboarding flow: role-based step progression, completion |

## Future Orchestrators (planned)

| Orchestrator | Phase | Responsibility |
|---|---|---|
| `useCheckoutOrchestrator` | Phase 3 | Coordinate cart → checkout → payment → order creation |
| `usePaymentSyncOrchestrator` | Phase 3 | Listen to `order:payment_updated` events and sync order status |
| `useDeliverySyncOrchestrator` | Phase 2 (Sprint 2.5) | Listen to `order:delivery_updated` events and sync order status |
| `useAuthLogoutCleanup` | Phase 1.3 | Clear stores, reset query cache, redirect on logout |

## No Implementation Yet

This directory currently only contains re-exports. No new orchestrator
implementations have been added in Phase 1.2. The placeholders above
document the planned structure for future phases.
