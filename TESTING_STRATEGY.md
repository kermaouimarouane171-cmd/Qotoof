# Testing Strategy (Updated)

Last updated: 2026-05-25

## Test Layers

- Unit + integration (Jest): `npm run test:unit`
- Accessibility unit (Jest + jest-axe): `npm run test:a11y:unit`
- Accessibility E2E (Cypress + cypress-axe): `npm run test:a11y:e2e`
- Bundle regression gate (Vite + custom script): `npm run test:bundle`
- CI aggregate (policy): `npm run test:ci`

## Current Reality (Session-Verified)

- `test:unit`
  - Suites: 76/76 passed
  - Tests: 695/697 passed (2 todo)
  - Coverage: Lines 10.1%, Statements 9.64%, Functions 7.97%, Branches 7.47%
  - Note: command exits non-zero بسبب عتبات التغطية العالمية العالية في Jest

- `test:a11y:unit`
  - Suites: 1/1 passed
  - Tests: 34/34 passed

- `test:a11y:e2e`
  - Passing: 10
  - Failing: 9
  - Pass ratio: 52.63%
  - Notes: failures تشمل violations حقيقية + selectors/intercepts غير مستقرة

- `test:bundle`
  - Baseline generated and checked successfully
  - Total gzipped JS bundle: 2155.6KB
  - Delta vs baseline: 0.0% (within 5% gate)

## Bundle Gate Policy

- Rule: Build bundle size must not increase by more than 5%
- Baseline file: `scripts/bundle-baseline.json`
- Refresh baseline intentionally only after accepted size-changing work:
  - `npm run build:baseline`

## CI Recommendations

- Keep these mandatory in PR:
  - `npm run build:check`
  - `npm run test:a11y:unit`
- Keep `npm run test:unit` mandatory only after one of these is done:
  - increase coverage significantly, or
  - revise global thresholds to match current project phase

## Fast Local Verification Flow

1. `npm run test:a11y:unit -- --runInBand`
2. `npm run test:unit -- --runInBand`
3. `npm run build:check`
4. `npm run test:a11y:e2e`
