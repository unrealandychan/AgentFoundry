#!/usr/bin/env bash
# check-imports.sh — Verify that all npm package imports used in the project
#                    can actually be resolved before running the dev server.
#
# Usage:
#   ./scripts/check-imports.sh [directory]   (default: src/)
#
# Exit code: 0 = all imports resolvable, 1 = one or more missing

set -uo pipefail

SRC_DIR="${1:-src}"
FAILED=0
CHECKED=0

# Collect unique bare package specifiers (strip sub-paths, skip relative imports)
IMPORTS=$(
  grep -rh --include="*.ts" --include="*.tsx" \
    --exclude="*.test.ts" --exclude="*.test.tsx" \
    --exclude="*.spec.ts" --exclude="*.spec.tsx" \
    --exclude-dir="__tests__" \
    -oE 'from "[^".]([^"]*)"' "$SRC_DIR" 2>/dev/null \
  | sed 's/from "//;s/"//' \
  | grep -v '^\.' \
  | grep -v '^@/' \
  | awk -F'/' '{ if ($1 ~ /^@/) print $1"/"$2; else print $1 }' \
  | sort -u
)

COUNT=$(echo "$IMPORTS" | wc -l | tr -d ' ')
echo "🔍 Checking $COUNT unique package imports in $SRC_DIR …"
echo ""

while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  CHECKED=$((CHECKED + 1))
  if node -e "require('$pkg')" 2>/dev/null; then
    echo "  ✅  $pkg"
  else
    echo "  ❌  $pkg  (not resolvable)"
    FAILED=$((FAILED + 1))
  fi
done <<< "$IMPORTS"

echo ""
echo "Checked $CHECKED packages. Failures: $FAILED"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "Fix: run 'npm install' or correct the import path."
  exit 1
fi
