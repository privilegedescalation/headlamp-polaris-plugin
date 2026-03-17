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

# Find the node where Headlamp is running — the PVC is ReadWriteOnce so
# the deploy pod must land on the same node to mount it.
HEADLAMP_NODE=$(kubectl get pods -n "$HEADLAMP_NAMESPACE" \
  -l "app.kubernetes.io/name=headlamp" \
  -o jsonpath='{.items[0].spec.nodeName}' 2>/dev/null || true)
if [ -z "$HEADLAMP_NODE" ]; then
  HEADLAMP_NODE=$(kubectl get pods -n "$HEADLAMP_NAMESPACE" \
    -l "app.kubernetes.io/instance=headlamp" \
    -o jsonpath='{.items[0].spec.nodeName}' 2>/dev/null || true)
fi
if [ -n "$HEADLAMP_NODE" ]; then
  echo "  Headlamp node: $HEADLAMP_NODE (scheduling deploy job there)"
  NODE_SELECTOR="\"nodeName\": \"$HEADLAMP_NODE\","
else
  echo "  WARNING: Could not determine Headlamp node"
  NODE_SELECTOR=""
fi

# Base64-encode the tarball so we can embed it in the pod command
# (avoids unreliable kubectl run --rm -i stdin piping)
TARBALL_B64=$(base64 -w0 "$TAR_FILE")
echo "  Encoded size: $(echo -n "$TARBALL_B64" | wc -c) bytes"

# Clean up any previous deploy job/pod
kubectl delete job plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true
kubectl delete pod plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true
sleep 2

# Create a Job that decodes the tarball and extracts to the PVC
echo "Starting deploy job..."
cat <<JOBEOF | kubectl apply -n "$HEADLAMP_NAMESPACE" -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: plugin-deploy
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 60
  template:
    spec:
      ${NODE_SELECTOR}
      restartPolicy: Never
      containers:
        - name: deploy
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              echo "Decoding and extracting plugin..."
              echo "${TARBALL_B64}" | base64 -d > /tmp/plugin.tar.gz
              rm -rf /plugins/${PLUGIN_DIR_NAME}
              mkdir -p /plugins/${PLUGIN_DIR_NAME}
              tar -xzf /tmp/plugin.tar.gz -C /plugins/${PLUGIN_DIR_NAME}
              echo "Files deployed:"
              ls -la /plugins/${PLUGIN_DIR_NAME}/
          volumeMounts:
            - name: plugins
              mountPath: /plugins
      volumes:
        - name: plugins
          persistentVolumeClaim:
            claimName: headlamp-plugins
JOBEOF

# Wait for the job to complete
echo "Waiting for deploy job to complete..."
kubectl wait --for=condition=complete job/plugin-deploy \
  -n "$HEADLAMP_NAMESPACE" --timeout=120s

# Show logs
kubectl logs job/plugin-deploy -n "$HEADLAMP_NAMESPACE" 2>/dev/null || true

# Clean up
kubectl delete job plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true

rm -f "$TAR_FILE"

# Restart Headlamp to pick up the new plugin
echo "Restarting Headlamp deployment to load plugin..."
kubectl rollout restart "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE"
kubectl rollout status "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE" --timeout=120s

echo "Plugin deployed successfully."
