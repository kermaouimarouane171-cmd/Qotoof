#!/usr/bin/env bash
# cleanup-dead-code.sh
# Safely stages removal of confirmed-dead source files.
# Runs an ESLint broken-import check after every actual git rm --cached.
# Stops with a warning if any "Module not found" error appears.
#
# SAFE GUARDS
#   - Uses git rm --cached (removes from index only, disk copy stays until commit).
#   - TwoFactor.jsx is hard-excluded regardless of the file list below.
#   - Skips files not tracked in the git index (already gone / never added).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

LOG_FILE="cleanup-log.txt"
PROTECTED="src/features/auth/components/TwoFactor.jsx"

# ── colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ts()   { date '+%Y-%m-%d %H:%M:%S'; }
log()  { echo "[$(ts())] $*" | tee -a "$LOG_FILE"; }
pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }

# ── confirmed-dead file list ────────────────────────────────────────────────
# Add or remove entries here as dead-code analysis evolves.
# Format: one path per line, relative to repo root.
DEAD_FILES=(
  "src/features/vendor/components/Orders.jsx"
  "src/features/vendor/components/Profile.jsx"
  "src/features/vendor/components/Products.jsx"
  "src/features/vendor/components/Analytics.jsx"
  "src/features/admin/components/Orders.jsx"
  "src/features/admin/components/Analytics.jsx"
  "src/features/admin/components/Users.jsx"
  "src/features/admin/components/Products.jsx"
  "src/features/admin/components/Settings.jsx"
  "src/features/admin/components/AdminDriverManagement.jsx"
  "src/features/auth/components/Login.jsx"
  "src/features/marketplace/components/Checkout.jsx"
  "src/features/marketplace/components/ProductDetail.jsx"
)

# ── initialise log ──────────────────────────────────────────────────────────
echo "" >> "$LOG_FILE"
log "════════════════════════════════════════════════════"
log "cleanup-dead-code.sh  started"
log "Working dir : $REPO_ROOT"
log "Git branch  : $(git rev-parse --abbrev-ref HEAD)"
log "Git HEAD    : $(git rev-parse --short HEAD)"
log "════════════════════════════════════════════════════"

# ── eslint broken-import check ──────────────────────────────────────────────
run_import_check() {
  local trigger_file="$1"
  info "  Running import/no-unresolved check after removing $trigger_file …"

  local eslint_out
  eslint_out=$(npx --yes eslint src/ \
    --rule '{"import/no-unresolved": "error"}' 2>&1 || true)

  local broken
  broken=$(echo "$eslint_out" | grep -i "Module not found\|Unable to resolve path\|Cannot find module" || true)

  if [[ -n "$broken" ]]; then
    echo ""
    fail "Broken import(s) detected after removing: $trigger_file"
    echo -e "${RED}──────────────────────────────────────────${NC}"
    echo "$broken"
    echo -e "${RED}──────────────────────────────────────────${NC}"
    log "BROKEN IMPORTS after removing $trigger_file:"
    echo "$broken" >> "$LOG_FILE"
    log "Stopping — please fix the import errors above before continuing."
    echo ""
    warn "The file was already staged for removal (git rm --cached)."
    warn "To undo:  git reset HEAD \"$trigger_file\""
    exit 1
  fi

  pass "  No broken imports detected."
  log "  Import check OK after: $trigger_file"
}

# ── main loop ───────────────────────────────────────────────────────────────
removed=0
skipped_protected=0
skipped_untracked=0
already_gone=0

echo ""
echo -e "${BOLD}Processing ${#DEAD_FILES[@]} candidate files…${NC}"
echo ""

for rel_path in "${DEAD_FILES[@]}"; do

  # ── 1. Hard-protect TwoFactor.jsx ────────────────────────────────────────
  if [[ "$rel_path" == "$PROTECTED" ]]; then
    warn "SKIP (protected) : $rel_path"
    log "SKIP protected   : $rel_path"
    (( skipped_protected++ )) || true
    continue
  fi

  # ── 2. Check whether git currently tracks the file ───────────────────────
  if ! git ls-files --error-unmatch "$rel_path" >/dev/null 2>&1; then

    # Distinguish: file was historically in git vs never committed
    last_commit=$(git log --oneline -1 -- "$rel_path" 2>/dev/null || true)
    if [[ -n "$last_commit" ]]; then
      info "ALREADY REMOVED  : $rel_path  (was deleted in: $last_commit)"
      log "ALREADY REMOVED  : $rel_path  |  last commit: $last_commit"
    else
      warn "NEVER TRACKED    : $rel_path"
      log "NEVER TRACKED    : $rel_path"
      (( skipped_untracked++ )) || true
    fi
    (( already_gone++ )) || true
    continue
  fi

  # ── 3. Extra safety: never remove the protected file even if misspelled ──
  abs_path="$REPO_ROOT/$rel_path"
  if [[ "$(realpath "$abs_path" 2>/dev/null)" == "$(realpath "$REPO_ROOT/$PROTECTED" 2>/dev/null)" ]]; then
    warn "SKIP (resolved to protected path): $rel_path"
    log "SKIP protected (resolved): $rel_path"
    (( skipped_protected++ )) || true
    continue
  fi

  # ── 4. Stage the removal ─────────────────────────────────────────────────
  info "Staging removal  : $rel_path"
  git rm --cached "$rel_path"
  log "git rm --cached  : $rel_path  |  at $(ts())"
  (( removed++ )) || true

  # ── 5. Verify no broken imports ──────────────────────────────────────────
  run_import_check "$rel_path"
  echo ""
done

# ── summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  Cleanup complete${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo "  Staged for removal  : $removed"
echo "  Already gone        : $already_gone"
echo "  Skipped (protected) : $skipped_protected"
echo "  Never tracked       : $skipped_untracked"
echo "  Log                 : $LOG_FILE"
echo ""

log "════════ summary: removed=$removed already_gone=$already_gone skipped_protected=$skipped_protected skipped_untracked=$skipped_untracked ════════"

if [[ $removed -gt 0 ]]; then
  echo -e "${GREEN}Files are staged. Review with:${NC}  git diff --cached --stat"
  echo -e "${GREEN}Commit when ready:${NC}            git commit -m 'chore: remove confirmed-dead feature stubs'"
  echo ""
fi

exit 0
