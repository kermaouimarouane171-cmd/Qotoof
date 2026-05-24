#!/usr/bin/env bash
# pre-refactor-setup.sh
# Safety baseline script run before any major refactor.
# Exits 0 only if both build and tests pass.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

TAG="before-refactor-v1"
BUILD_LOG="build-baseline.log"
COVERAGE_JSON="coverage-baseline.json"

# ── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

BUILD_OK=0
TEST_OK=0

# ── 1. Git tag ───────────────────────────────────────────────────────────
info "Step 1 — creating git tag '$TAG' on HEAD…"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  warn "Tag '$TAG' already exists — skipping creation."
else
  git tag "$TAG"
  pass "Tag '$TAG' created on $(git rev-parse --short HEAD)."
fi

# ── 2. Build ─────────────────────────────────────────────────────────────
info "Step 2 — running npm run build (output → $BUILD_LOG)…"

if npm run build > "$BUILD_LOG" 2>&1; then
  BUILD_OK=1
  pass "Build succeeded. Log saved to $BUILD_LOG."
else
  fail "Build FAILED. See $BUILD_LOG for details."
fi

# ── 3. Tests with coverage ───────────────────────────────────────────────
info "Step 3 — running tests with coverage (summary → $COVERAGE_JSON)…"

if npm test -- --coverage --coverageReporters=json-summary; then
  TEST_OK=1
  pass "Tests passed."
else
  fail "Tests FAILED. Check jest output for details."
fi

# Jest writes coverage/coverage-summary.json even when thresholds fail.
JEST_SUMMARY="coverage/coverage-summary.json"
if [[ -f "$JEST_SUMMARY" ]]; then
  cp "$JEST_SUMMARY" "$COVERAGE_JSON"
  pass "Coverage summary saved to $COVERAGE_JSON."
else
  warn "Coverage summary not found at $JEST_SUMMARY."
  echo '{}' > "$COVERAGE_JSON"
fi

# ── 4. File-count summary by extension in src/ ───────────────────────────
info "Step 4 — file count per extension in src/…"
echo ""
echo "  Extension  │  Count"
echo "  ───────────┼───────"
find src/ -type f | sed -E 's/.*\.([^./]+)$/\1/' | sort | uniq -c | sort -rn |
  awk '{ printf "  %-10s │  %s\n", $2, $1 }'
echo ""

# ── 5. Final gate ────────────────────────────────────────────────────────
info "Step 5 — evaluating overall result…"
echo ""

if [[ $BUILD_OK -eq 1 && $TEST_OK -eq 1 ]]; then
  pass "All checks passed. Safe to begin refactor."
  echo ""
  echo -e "${GREEN}Baseline artefacts:${NC}"
  echo "  • git tag  : $TAG"
  echo "  • build log: $BUILD_LOG"
  echo "  • coverage : $COVERAGE_JSON"
  echo ""
  exit 0
else
  fail "One or more checks failed — do NOT proceed with the refactor until resolved."
  [[ $BUILD_OK -eq 0 ]] && fail "  → Build failed (see $BUILD_LOG)"
  [[ $TEST_OK  -eq 0 ]] && fail "  → Tests failed"
  echo ""
  exit 1
fi
