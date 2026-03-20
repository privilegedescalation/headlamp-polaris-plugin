#!/usr/bin/env bash
# deploy-e2e-headlamp.sh
#
# Builds a custom Headlamp image with the polaris plugin pre-installed,
# pushes it to ghcr.io, and deploys a dedicated E2E Headlamp instance.
#
# This replaces the old PVC + kubectl-patch approach. The plugin is part
# of the container image — no PVCs, no kubectl exec/cp, no deployment
# patching required.
#
# Prerequisites:
#   - Plugin built (dist/ exists)
#   - Docker or buildx available
#   - GHCR_TOKEN set (or GH_TOKEN with packages:write)
#   - kubectl configured with cluster access
#   - Helm 3 installed
#
# Environment:
#   E2E_NAMESPACE     — namespace for E2E Headlamp (default: headlamp-e2e)
#   E2E_RELEASE       — Helm release name (default: headlamp-e2e)
#   HEADLAMP_VERSION  — base Headlamp image tag (default: latest)
#   IMAGE_TAG         — tag for the E2E image (default: git SHA)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

E2E_NAMESPACE="${E2E_NAMESPACE:-headlamp-e2e}"
E2E_RELEASE="${E2E_RELEASE:-headlamp-e2e}"
HEADLAMP_VERSION="${HEADLAMP_VERSION:-latest}"
IMAGE_REPO="ghcr.io/privilegedescalation/headlamp-polaris-e2e"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse --short HEAD)}"
IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

echo "=== E2E Headlamp Deployment ==="
echo "  Image:     $IMAGE"
echo "  Namespace: $E2E_NAMESPACE"
echo "  Release:   $E2E_RELEASE"

# --- Build and push the custom image ---
echo ""
echo "Building E2E Headlamp image..."
docker build -f "$REPO_ROOT/Dockerfile.e2e" \
  --build-arg "HEADLAMP_VERSION=${HEADLAMP_VERSION}" \
  -t "$IMAGE" \
  "$REPO_ROOT"

echo "Pushing image to ghcr.io..."
docker push "$IMAGE"

# --- Deploy with Helm ---
echo ""
echo "Adding Headlamp Helm repo..."
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/ --force-update
helm repo update

echo "Creating namespace ${E2E_NAMESPACE} (if needed)..."
kubectl create namespace "$E2E_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "Installing/upgrading Headlamp E2E instance..."
helm upgrade --install "$E2E_RELEASE" headlamp/headlamp \
  -n "$E2E_NAMESPACE" \
  -f "$REPO_ROOT/deployment/headlamp-e2e-values.yaml" \
  --set "image.registry=ghcr.io" \
  --set "image.repository=privilegedescalation/headlamp-polaris-e2e" \
  --set "image.tag=${IMAGE_TAG}" \
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
