#!/usr/bin/env bash
# Deploy the built plugin to a live Headlamp instance via ConfigMap + init container.
#
# This script packages the built plugin as a tarball, stores it in a Kubernetes
# ConfigMap, and patches the Headlamp deployment to add an init container that
# extracts the plugin into the static-plugins volume before Headlamp starts.
#
# No kubectl exec or kubectl cp is used — only standard Kubernetes API operations
# (create configmap, patch deployment, rollout status).
#
# Prerequisites:
#   - kubectl configured with access to the Headlamp namespace
#   - Plugin already built (npm run build → dist/)
#   - Headlamp deployment uses a "static-plugins" volume (emptyDir)
#
# Environment variables (all optional, with defaults):
#   HEADLAMP_URL      — Headlamp URL for readiness check
#   HEADLAMP_NS       — Kubernetes namespace (default: kube-system)
#   HEADLAMP_DEPLOY   — Headlamp deployment name (default: headlamp)
#   PLUGIN_NAME       — Plugin directory name (default: polaris)
#
# Usage:
#   npm run build
#   ./scripts/deploy-plugin-to-headlamp.sh

set -euo pipefail

HEADLAMP_URL="${HEADLAMP_URL:-http://headlamp.kube-system.svc.cluster.local}"
HEADLAMP_NS="${HEADLAMP_NS:-kube-system}"
HEADLAMP_DEPLOY="${HEADLAMP_DEPLOY:-headlamp}"
PLUGIN_NAME="${PLUGIN_NAME:-polaris}"
CONFIGMAP_NAME="headlamp-e2e-plugin-${PLUGIN_NAME}"

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

# --- Step 1: Package plugin as tarball ---
echo "Packaging plugin..."
TARBALL=$(mktemp /tmp/${PLUGIN_NAME}-plugin-XXXXXX.tar.gz)
tar czf "$TARBALL" dist/ package.json
echo "  tarball size: $(du -h "$TARBALL" | cut -f1)"

# ConfigMap binary data limit is ~1MB
TARBALL_SIZE=$(stat -c%s "$TARBALL" 2>/dev/null || stat -f%z "$TARBALL")
if [ "$TARBALL_SIZE" -gt 1000000 ]; then
  echo "Error: Plugin tarball (${TARBALL_SIZE} bytes) exceeds ConfigMap 1MB limit." >&2
  echo "Consider minifying the build output or splitting into multiple ConfigMaps." >&2
  rm -f "$TARBALL"
  exit 1
fi

# --- Step 2: Store tarball in a ConfigMap ---
echo "Creating ConfigMap ${CONFIGMAP_NAME}..."
kubectl create configmap "$CONFIGMAP_NAME" \
  --from-file="plugin.tar.gz=${TARBALL}" \
  -n "$HEADLAMP_NS" \
  --dry-run=client -o yaml | kubectl apply -f -
rm -f "$TARBALL"

# --- Step 3: Patch the Headlamp deployment ---
# Adds an init container that extracts the plugin tarball into the static-plugins
# volume. Uses strategic merge — init containers merge by name, so re-running
# this script updates the existing init container rather than adding duplicates.
# A timestamp annotation forces a rollout even if the patch shape is unchanged.
echo "Patching Headlamp deployment..."
DEPLOY_TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)

kubectl patch deployment "$HEADLAMP_DEPLOY" -n "$HEADLAMP_NS" --type=strategic -p "$(cat <<EOF
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "e2e-plugin-deploy-ts": "${DEPLOY_TIMESTAMP}"
        }
      },
      "spec": {
        "initContainers": [
          {
            "name": "install-e2e-plugin",
            "image": "busybox:latest",
            "command": [
              "sh", "-c",
              "mkdir -p /plugins/${PLUGIN_NAME} && cd /plugins/${PLUGIN_NAME} && tar xzf /plugin-src/plugin.tar.gz && cp -a dist/* . && rm -rf dist && echo 'Plugin extracted successfully' && ls -la"
            ],
            "volumeMounts": [
              {"name": "static-plugins", "mountPath": "/plugins"},
              {"name": "e2e-plugin-src", "mountPath": "/plugin-src", "readOnly": true}
            ]
          }
        ],
        "volumes": [
          {
            "name": "e2e-plugin-src",
            "configMap": {
              "name": "${CONFIGMAP_NAME}"
            }
          }
        ]
      }
    }
  }
}
EOF
)"

# --- Step 4: Wait for rollout ---
echo "Waiting for rollout..."
kubectl rollout status deployment/"$HEADLAMP_DEPLOY" -n "$HEADLAMP_NS" --timeout=180s

# --- Step 5: Verify Headlamp is ready ---
echo "Verifying Headlamp readiness..."
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$HEADLAMP_URL" || true)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Headlamp is ready (HTTP 200)"

    # Verify plugin is loaded
    PLUGIN_CHECK=$(curl -sf "$HEADLAMP_URL/plugins" 2>/dev/null || echo "[]")
    if echo "$PLUGIN_CHECK" | grep -q "$PLUGIN_NAME"; then
      echo "Plugin '${PLUGIN_NAME}' is loaded"
    else
      echo "::warning::Plugin '${PLUGIN_NAME}' not found in /plugins response"
    fi
    exit 0
  fi
  echo "  attempt $i/30 — HTTP $HTTP_CODE"
  sleep 5
done

echo "Error: Headlamp did not recover after plugin deploy" >&2
exit 1
