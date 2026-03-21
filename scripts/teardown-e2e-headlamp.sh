#!/usr/bin/env bash
# teardown-e2e-headlamp.sh
#
# Tears down the dedicated E2E Headlamp instance deployed by deploy-e2e-headlamp.sh.
#
# Environment:
#   E2E_NAMESPACE  — namespace to clean up (default: headlamp-e2e)
#   E2E_RELEASE    — Helm release to uninstall (default: headlamp-e2e)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

E2E_NAMESPACE="${E2E_NAMESPACE:-headlamp-e2e}"
E2E_RELEASE="${E2E_RELEASE:-headlamp-e2e}"

# Exit early if the namespace does not exist — nothing to tear down.
if ! kubectl get namespace "$E2E_NAMESPACE" >/dev/null 2>&1; then
  echo "Namespace $E2E_NAMESPACE does not exist, nothing to tear down."
  exit 0
fi

echo "=== E2E Headlamp Teardown ==="
echo "  Namespace: $E2E_NAMESPACE"
echo "  Release:   $E2E_RELEASE"

echo "Uninstalling Helm release..."
helm uninstall "$E2E_RELEASE" -n "$E2E_NAMESPACE" 2>/dev/null || echo "Release not found (already removed?)"

echo "Cleaning up ConfigMap..."
kubectl delete configmap headlamp-polaris-plugin -n "$E2E_NAMESPACE" --ignore-not-found

echo "Cleaning up service account..."
kubectl delete serviceaccount headlamp-e2e-test -n "$E2E_NAMESPACE" --ignore-not-found

# Note: namespace is NOT deleted — it is managed by a cluster admin.
# The runner SA only has namespace-scoped permissions (see deployment/e2e-ci-runner-rbac.yaml).

# Clean up local env file
rm -f "$REPO_ROOT/.env.e2e"

echo "Teardown complete."
