#!/usr/bin/env bash
# ============================================================================
# CI-ONLY TEST FIXTURE — tests for scripts/deploy-plugin-to-headlamp.sh
#
# Validates the deploy script's precondition checks without requiring a
# live Kubernetes cluster. Run from the repo root:
#
#   bash scripts/deploy-plugin-to-headlamp.test.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/deploy-plugin-to-headlamp.sh"
PASS=0
FAIL=0

assert_exit_code() {
  local description="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description (expected exit $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Deploy script precondition tests ==="

# Test 1: Script fails when dist/ does not exist
echo ""
echo "Test 1: Should fail when dist/ directory is missing"
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
set +e
bash "$SCRIPT" >/dev/null 2>&1
EXIT_CODE=$?
set -e
assert_exit_code "Exits with error when dist/ is missing" 1 "$EXIT_CODE"
rm -rf "$TMPDIR"

# Test 2: Script is executable
echo ""
echo "Test 2: Script should be executable"
if [ -x "$SCRIPT" ]; then
  echo "  PASS: Script is executable"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Script is not executable"
  FAIL=$((FAIL + 1))
fi

# Test 3: Script has CI-only header comment
echo ""
echo "Test 3: Script should have CI-only fixture header"
if grep -q "CI-ONLY TEST FIXTURE" "$SCRIPT"; then
  echo "  PASS: CI-only header present"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Missing CI-only header"
  FAIL=$((FAIL + 1))
fi

# Test 4: Script does NOT use kubectl exec or kubectl cp
echo ""
echo "Test 4: Script must not use kubectl exec or kubectl cp"
if grep -v '^\s*#' "$SCRIPT" | grep -qE 'kubectl\s+(exec|cp)'; then
  echo "  FAIL: Script contains kubectl exec/cp"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: No kubectl exec/cp found"
  PASS=$((PASS + 1))
fi

# Test 5: Script uses kubectl create configmap
echo ""
echo "Test 5: Script should use kubectl create configmap"
if grep -q 'kubectl create configmap' "$SCRIPT"; then
  echo "  PASS: Uses kubectl create configmap"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Missing kubectl create configmap"
  FAIL=$((FAIL + 1))
fi

# Test 6: Script uses kubectl patch deployment
echo ""
echo "Test 6: Script should use kubectl patch deployment"
if grep -q 'kubectl patch deployment' "$SCRIPT"; then
  echo "  PASS: Uses kubectl patch deployment"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Missing kubectl patch deployment"
  FAIL=$((FAIL + 1))
fi

# Test 7: ConfigMap size guard exists
echo ""
echo "Test 7: Script should guard against ConfigMap size limit"
if grep -q '1000000' "$SCRIPT"; then
  echo "  PASS: ConfigMap size guard present"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Missing ConfigMap size guard"
  FAIL=$((FAIL + 1))
fi

# Test 8: RBAC manifest does not grant exec access
echo ""
echo "Test 8: RBAC manifest must not grant exec access"
RBAC_FILE="$SCRIPT_DIR/../deployment/e2e-runner-rbac.yaml"
if [ -f "$RBAC_FILE" ]; then
  if grep -qE '"(exec|cp)"' "$RBAC_FILE" || grep -qE "'(exec|cp)'" "$RBAC_FILE"; then
    echo "  FAIL: RBAC manifest grants exec/cp access"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: No exec/cp in RBAC manifest"
    PASS=$((PASS + 1))
  fi

  # Also check the verbs explicitly
  if grep -q 'pods/exec' "$RBAC_FILE"; then
    echo "  FAIL: RBAC manifest grants pods/exec"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: No pods/exec in RBAC manifest"
    PASS=$((PASS + 1))
  fi
else
  echo "  SKIP: RBAC manifest not found at $RBAC_FILE"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
