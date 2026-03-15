#!/usr/bin/env bash
# Deploy the built plugin to a live Headlamp instance via kubectl.
#
# Prerequisites:
#   - kubectl configured with access to the Headlamp namespace
#   - Plugin already built (npm run build → dist/)
#
# Environment variables (all optional, with defaults):
#   HEADLAMP_URL        — Headlamp URL for readiness check
#   HEADLAMP_NS         — Kubernetes namespace (default: kube-system)
#   HEADLAMP_PLUGIN_DIR — Plugin path inside the pod (default: /headlamp/static-plugins/polaris)
#
# Usage:
#   npm run build
#   ./scripts/deploy-plugin-to-headlamp.sh
#
# Intended to be called from the E2E workflow before running Playwright tests,
# so that E2E always tests the current commit's plugin code rather than whatever
# was previously deployed.

set -euo pipefail

HEADLAMP_URL="${HEADLAMP_URL:-http://headlamp.kube-system.svc.cluster.local}"
HEADLAMP_NS="${HEADLAMP_NS:-kube-system}"
HEADLAMP_PLUGIN_DIR="${HEADLAMP_PLUGIN_DIR:-/headlamp/static-plugins/polaris}"

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

# Find the Headlamp pod
POD=$(kubectl get pod -n "$HEADLAMP_NS" -l app.kubernetes.io/name=headlamp \
  -o jsonpath='{.items[0].metadata.name}')
echo "Headlamp pod: $POD"

# Remove stale plugin and copy current build
kubectl exec -n "$HEADLAMP_NS" "$POD" -c headlamp -- \
  rm -rf "$HEADLAMP_PLUGIN_DIR" 2>/dev/null || true
kubectl cp dist/. "$HEADLAMP_NS/$POD:$HEADLAMP_PLUGIN_DIR" -c headlamp

# Copy package.json so Headlamp can read plugin metadata
kubectl cp package.json "$HEADLAMP_NS/$POD:$HEADLAMP_PLUGIN_DIR/package.json" -c headlamp

# Verify the copy
echo "Deployed files:"
kubectl exec -n "$HEADLAMP_NS" "$POD" -c headlamp -- \
  ls -la "$HEADLAMP_PLUGIN_DIR"

# Restart the Headlamp process to reload plugins.
# Killing PID 1 restarts the container without replacing the pod,
# so the emptyDir volume (and our copied files) is preserved.
echo "Restarting Headlamp process..."
kubectl exec -n "$HEADLAMP_NS" "$POD" -c headlamp -- kill 1 || true

# Wait for Headlamp to come back
echo "Waiting for Headlamp to restart..."
sleep 10
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$HEADLAMP_URL" || true)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Headlamp is ready"
    exit 0
  fi
  echo "  attempt $i/30 — HTTP $HTTP_CODE"
  sleep 5
done

echo "Error: Headlamp did not recover after plugin deploy" >&2
exit 1
