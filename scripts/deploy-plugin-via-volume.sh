#!/usr/bin/env bash
# deploy-plugin-via-volume.sh
#
# Copies the built plugin into the shared PVC so Headlamp picks it up.
# Uses a temporary Kubernetes pod to write to the PVC — the CI runner
# does NOT need the PVC mounted locally.
#
# Usage:
#   scripts/deploy-plugin-via-volume.sh
#
# Environment:
#   HEADLAMP_NAMESPACE  — namespace where Headlamp runs (default: kube-system)
#   HEADLAMP_DEPLOY     — Headlamp deployment name (default: headlamp)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HEADLAMP_NAMESPACE="${HEADLAMP_NAMESPACE:-kube-system}"
HEADLAMP_DEPLOY="${HEADLAMP_DEPLOY:-headlamp}"

# The deployed directory name must match the plugin's registered name.
# PR #56 aligns registerPluginSettings to "polaris"; the directory must match.
PLUGIN_DIR_NAME="polaris"
DIST_DIR="$REPO_ROOT/dist"

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

echo "Deploying plugin to shared volume via temporary pod..."
echo "  Source:    $DIST_DIR"
echo "  PVC:       headlamp-plugins"
echo "  Plugin:    $PLUGIN_DIR_NAME"

# Create tarball of plugin dist + package.json
TAR_FILE=$(mktemp /tmp/plugin-XXXXXX.tar.gz)
tar -czf "$TAR_FILE" -C "$DIST_DIR" . -C "$REPO_ROOT" package.json
echo "  Tarball:   $TAR_FILE ($(du -h "$TAR_FILE" | cut -f1))"

# Clean up any previous deploy pod
kubectl delete pod plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found --wait=false 2>/dev/null || true
sleep 2

# Run a temporary pod that mounts the PVC and receives the tarball via stdin
echo "Starting deploy pod..."
kubectl run plugin-deploy \
  --rm -i \
  --restart=Never \
  --image=busybox:1.36 \
  --namespace="$HEADLAMP_NAMESPACE" \
  --overrides="{
    \"spec\": {
      \"containers\": [{
        \"name\": \"plugin-deploy\",
        \"image\": \"busybox:1.36\",
        \"stdin\": true,
        \"command\": [\"sh\", \"-c\",
          \"rm -rf /plugins/${PLUGIN_DIR_NAME} && mkdir -p /plugins/${PLUGIN_DIR_NAME} && tar -xzf - -C /plugins/${PLUGIN_DIR_NAME} && echo Files deployed: && ls -la /plugins/${PLUGIN_DIR_NAME}/\"
        ],
        \"volumeMounts\": [{
          \"name\": \"plugins\",
          \"mountPath\": \"/plugins\"
        }]
      }],
      \"volumes\": [{
        \"name\": \"plugins\",
        \"persistentVolumeClaim\": {
          \"claimName\": \"headlamp-plugins\"
        }
      }]
    }
  }" < "$TAR_FILE"

rm -f "$TAR_FILE"

# Restart Headlamp to pick up the new plugin
echo "Restarting Headlamp deployment to load plugin..."
kubectl rollout restart "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE"
kubectl rollout status "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE" --timeout=120s

echo "Plugin deployed successfully."
