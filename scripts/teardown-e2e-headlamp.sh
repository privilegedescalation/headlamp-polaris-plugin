#!/usr/bin/env bash
# teardown-e2e-headlamp.sh
#
# Tears down the dedicated E2E Headlamp instance deployed by deploy-e2e-headlamp.sh.
#
# Environment:
#   E2E_NAMESPACE  — namespace to clean up (default: default)
#   E2E_RELEASE    — Helm release to uninstall (default: headlamp-e2e)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

E2E_NAMESPACE="${E2E_NAMESPACE:-default}"
E2E_RELEASE="${E2E_RELEASE:-headlamp-e2e}"

echo "=== E2E Headlamp Teardown ==="
echo "  Namespace: $E2E_NAMESPACE"
echo "  Release:   $E2E_RELEASE"

echo "Uninstalling Helm release..."
helm uninstall "$E2E_RELEASE" -n "$E2E_NAMESPACE" 2>/dev/null || echo "Release not found (already removed?)"

echo "Cleaning up ConfigMap..."
kubectl delete configmap headlamp-polaris-plugin -n "$E2E_NAMESPACE" --ignore-not-found

echo "Cleaning up service account..."
kubectl delete serviceaccount headlamp-e2e-test -n "$E2E_NAMESPACE" --ignore-not-found

# Clean up local env file
rm -f "$REPO_ROOT/.env.e2e"

echo "Teardown complete."
