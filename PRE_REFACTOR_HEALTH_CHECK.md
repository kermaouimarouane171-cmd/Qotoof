# Pre-Refactor Health Check

Date: 2026-05-21

## Baseline Artifacts

- Git tag: before-refactor-v1
- Build log: build-baseline.log
- Coverage summary JSON: coverage-baseline.json
- Coverage report markdown: COVERAGE_BASELINE.md

## pre-refactor-setup.sh Result

- Build: PASS
- Tests: FAIL (due to global Jest coverage thresholds)
- Exit code: 1

Jest threshold output:

```text
Jest: "global" coverage threshold for statements (80%) not met: 5.37%
Jest: "global" coverage threshold for branches (70%) not met: 3.98%
Jest: "global" coverage threshold for lines (80%) not met: 5.59%
Jest: "global" coverage threshold for functions (75%) not met: 4.91%
```

File count summary in src/:

```text
Extension  Count
jsx        212
js         211
json       4
ts         2
md         1
css        1
```

## npm run build (Full Command Status)

- Command: npm run build
- Exit: PASS
- Warning(s): 1 Vite warning about mixed dynamic/static imports for src/services/supabase.js
- Build completed with output bundles generated in dist/
- Full captured output: pre-refactor-build-full.log

## npm run check:circular

- Command: npm run check:circular
- Exit: PASS
- Result: No circular dependencies found
- Full captured output: pre-refactor-circular-full.log

```text
> qotoof@1.0.0 check:circular
> madge --circular --extensions js,jsx,ts,tsx src/

Processed 429 files (1.6s) (259 warnings)

✔ No circular dependency found!
```

## Circular Dependency Chains

None found.
