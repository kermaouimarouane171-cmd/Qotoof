# App Layer

## Purpose

The app layer is the **application composition root**. It assembles:
- The root App component
- The router (AppRouter)
- Global providers (HelmetProvider, BrowserRouter, ErrorBoundary)
- App-level orchestrators (cross-module flow coordinators)

## Structure

```
src/app/
├── index.js              ← Public API entry point
├── App.jsx               ← Re-exports root App from @/App
├── AppRouter.jsx         ← Re-exports AppRouter from @/router/AppRouter
├── providers.jsx         ← AppProviders wrapper (ready for future use)
├── orchestrators/
│   ├── index.js          ← Re-exports orchestrators from @/orchestrators
│   └── README.md         ← Orchestrator documentation
└── README.md             ← This file
```

## Public API

```js
import { App, AppRouter, AppProviders } from '@/app'
import { useAuthOrchestrator } from '@/app/orchestrators'
```

## What Belongs Here

- Root component composition (App, AppRouter, providers)
- App-level orchestrators that coordinate cross-module flows
- Bootstrap helpers (if any are extracted from main.jsx in the future)

## What Must NOT Be Placed Here

- Business logic (belongs in feature modules under `src/modules/`)
- UI components (belongs in `src/modules/shared/` or feature modules)
- Supabase queries (belongs in module `data/` layers)
- Auth logic (belongs in `src/modules/auth/` — Phase 1.3)
- Direct page components (belongs in feature module `ui/pages/`)

## Relation to Other Layers

```
main.jsx (entry point)
  └── @/app (composition layer)
        ├── providers (global wrappers)
        ├── App → AppRouter (route tree)
        └── orchestrators (cross-module coordination)
              └── @/modules/* (feature modules)
                    └── @/modules/shared (shared UI/hooks/utils)
```

### Key Rule

**App can compose modules, but modules must not import from app.**

The dependency direction is strictly:
`main.jsx → app → modules → shared`

Modules should never import from `@/app` or `@/app/orchestrators`.
If a module needs to react to an app-level event, it should use the
event bus (pub/sub or CustomEvent) defined in MODULAR_DEVELOPMENT_PLAN.md.

## Phase 1.2 Status

This layer is currently a **re-export wrapper**. No source files have been moved.
- `App.jsx` re-exports `@/App`
- `AppRouter.jsx` re-exports `@/router/AppRouter`
- `providers.jsx` is a new component ready for future use (not yet used by main.jsx)
- `orchestrators/index.js` re-exports from `@/orchestrators/`

### Minimal Import Change

`src/main.jsx` now imports App from `./app/App` instead of `./App`.
This is the only import change. Behavior is identical.

### Future Migration Path

1. **Phase 1.3+**: Move App.jsx implementation into `src/app/App.jsx`
2. **Phase 2+**: Move AppRouter.jsx implementation into `src/app/AppRouter.jsx`
3. **Phase 2+**: Move orchestrator implementations into `src/app/orchestrators/`
4. **Future**: Refactor main.jsx to use `AppProviders` from `@/app/providers`
