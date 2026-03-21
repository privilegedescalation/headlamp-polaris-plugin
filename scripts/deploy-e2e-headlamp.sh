#!/usr/bin/env bash
# deploy-e2e-headlamp.sh
#
# Deploys a stock Headlamp instance with the polaris plugin loaded via
# a ConfigMap volume mount. No custom Docker images — the plugin is built
# in CI and injected as a ConfigMap.
#
# E2E resources are deployed to the `default` namespace. Nothing persists
# beyond the test run — teardown cleans up all created resources.
#
# Prerequisites:
#   - Plugin built (dist/ exists with plugin-main.js + package.json)
#   - kubectl configured with cluster access
#   - Helm 3 installed
#   - RBAC applied: kubectl apply -f deployment/e2e-ci-runner-rbac.yaml
#
# Environment:
#   E2E_NAMESPACE     — namespace for E2E Headlamp (default: default)
#   E2E_RELEASE       — Helm release name (default: headlamp-e2e)
#   HEADLAMP_VERSION  — Headlamp image tag (default: latest)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

E2E_NAMESPACE="${E2E_NAMESPACE:-default}"
E2E_RELEASE="${E2E_RELEASE:-headlamp-e2e}"
HEADLAMP_VERSION="${HEADLAMP_VERSION:-latest}"

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

# --- Preflight: verify RBAC before touching the cluster ---
echo "Checking RBAC permissions in namespace '${E2E_NAMESPACE}'..."
if ! kubectl auth can-i delete configmaps -n "$E2E_NAMESPACE" --quiet 2>/dev/null; then
  echo "ERROR: Missing RBAC — cannot delete configmaps in namespace '${E2E_NAMESPACE}'." >&2
  echo "  Apply RBAC first: kubectl apply -f deployment/e2e-ci-runner-rbac.yaml" >&2
  exit 1
fi

echo "=== E2E Headlamp Deployment ==="
echo "  Image:     ghcr.io/headlamp-k8s/headlamp:${HEADLAMP_VERSION}"
echo "  Namespace: $E2E_NAMESPACE"
echo "  Release:   $E2E_RELEASE"

# --- Create ConfigMap from built plugin ---
echo ""
echo "Creating ConfigMap with plugin files..."

# Delete existing ConfigMap if present (idempotent redeploy)
kubectl delete configmap headlamp-polaris-plugin \
  -n "$E2E_NAMESPACE" --ignore-not-found

# Create ConfigMap from dist/ contents and package.json
kubectl create configmap headlamp-polaris-plugin \
  -n "$E2E_NAMESPACE" \
  --from-file="$DIST_DIR" \
  --from-file=package.json="$REPO_ROOT/package.json"

# --- Deploy with Helm ---
echo ""
echo "Adding Headlamp Helm repo..."
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/ --force-update
helm repo update

echo "Installing/upgrading Headlamp E2E instance..."
helm upgrade --install "$E2E_RELEASE" headlamp/headlamp \
  -n "$E2E_NAMESPACE" \
  -f "$REPO_ROOT/deployment/headlamp-e2e-values.yaml" \
  --set "image.registry=ghcr.io" \
  --set "image.repository=headlamp-k8s/headlamp" \
  --set "image.tag=${HEADLAMP_VERSION}" \
  --wait \
  --timeout 120s

echo "Waiting for rollout..."
kubectl rollout status "deployment/${E2E_RELEASE}-headlamp" \
  -n "$E2E_NAMESPACE" --timeout=120s

# --- Generate a service URL for tests ---
SVC_URL="http://${E2E_RELEASE}-headlamp.${E2E_NAMESPACE}.svc.cluster.local"
echo ""
echo "E2E Headlamp is ready at: ${SVC_URL}"
echo "  export HEADLAMP_URL=${SVC_URL}"

# --- Generate a token for test auth ---
echo ""
echo "Creating service account token for E2E auth..."
kubectl create serviceaccount headlamp-e2e-test \
  -n "$E2E_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

TOKEN=$(kubectl create token headlamp-e2e-test -n "$E2E_NAMESPACE" --duration=1h 2>/dev/null || echo "")
if [ -n "$TOKEN" ]; then
  echo "  export HEADLAMP_TOKEN=<generated>"
  echo ""
  echo "HEADLAMP_URL=${SVC_URL}" > "$REPO_ROOT/.env.e2e"
  echo "HEADLAMP_TOKEN=${TOKEN}" >> "$REPO_ROOT/.env.e2e"
  echo "Wrote .env.e2e with HEADLAMP_URL and HEADLAMP_TOKEN"
else
  echo "  WARNING: Could not generate token. Set HEADLAMP_TOKEN manually or use OIDC."
fi

echo ""
echo "E2E deployment complete."
