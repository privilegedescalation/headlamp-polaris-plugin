#!/usr/bin/env bash
# deploy-plugin-via-volume.sh
#
# Copies the built plugin into the shared PVC so Headlamp picks it up.
# The PVC must already be mounted on the CI runner at PLUGIN_VOLUME_PATH.
#
# Usage:
#   scripts/deploy-plugin-via-volume.sh [plugin-volume-path]
#
# Environment:
#   PLUGIN_VOLUME_PATH  — mount point of the shared PVC (default: /mnt/headlamp-plugins)
#   HEADLAMP_NAMESPACE  — namespace where Headlamp runs (default: kube-system)
#   HEADLAMP_DEPLOY     — Headlamp deployment name (default: headlamp)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_VOLUME_PATH="${1:-${PLUGIN_VOLUME_PATH:-/mnt/headlamp-plugins}}"
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

echo "Deploying plugin to shared volume..."
echo "  Source:      $DIST_DIR"
echo "  Destination: $PLUGIN_VOLUME_PATH/$PLUGIN_DIR_NAME"

# Clean any previous version and copy fresh build
rm -rf "${PLUGIN_VOLUME_PATH:?}/${PLUGIN_DIR_NAME}"
mkdir -p "$PLUGIN_VOLUME_PATH/$PLUGIN_DIR_NAME"
cp -a "$DIST_DIR"/. "$PLUGIN_VOLUME_PATH/$PLUGIN_DIR_NAME/"
cp "$REPO_ROOT/package.json" "$PLUGIN_VOLUME_PATH/$PLUGIN_DIR_NAME/"

echo "Plugin files deployed:"
ls -la "$PLUGIN_VOLUME_PATH/$PLUGIN_DIR_NAME/"

# Restart Headlamp to pick up the new plugin
echo "Restarting Headlamp deployment to load plugin..."
kubectl rollout restart "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE"
kubectl rollout status "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE" --timeout=120s

echo "Plugin deployed successfully."
