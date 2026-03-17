#!/usr/bin/env bash
# deploy-plugin-via-volume.sh
#
# Copies the built plugin into the shared PVC so Headlamp picks it up.
# Uses a temporary Kubernetes Job to write to the PVC — the CI runner
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

echo "Deploying plugin to shared volume via temporary job..."
echo "  Source:    $DIST_DIR"
echo "  PVC:       headlamp-plugins"
echo "  Plugin:    $PLUGIN_DIR_NAME"

# Create tarball of plugin dist + package.json
TAR_FILE=$(mktemp /tmp/plugin-XXXXXX.tar.gz)
tar -czf "$TAR_FILE" -C "$DIST_DIR" . -C "$REPO_ROOT" package.json
echo "  Tarball:   $TAR_FILE ($(du -h "$TAR_FILE" | cut -f1))"

# Find the node where Headlamp is running — the PVC is ReadWriteOnce so
# the deploy job must land on the same node to mount it.
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
fi

# Clean up any previous deploy resources
kubectl delete pod plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found --wait=true 2>/dev/null || true
kubectl delete configmap plugin-tarball -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true
sleep 2

# Store the tarball in a ConfigMap (binary-safe via --from-file)
echo "Creating ConfigMap with plugin tarball..."
kubectl create configmap plugin-tarball \
  -n "$HEADLAMP_NAMESPACE" \
  --from-file=plugin.tar.gz="$TAR_FILE"

# Build the Pod manifest as a temp file to avoid heredoc YAML escaping issues
POD_FILE=$(mktemp /tmp/plugin-deploy-pod-XXXXXX.yaml)

cat > "$POD_FILE" <<'YAMLDOC'
apiVersion: v1
kind: Pod
metadata:
  name: plugin-deploy
spec:
  restartPolicy: Never
  containers:
    - name: deploy
      image: busybox:1.36
      command: ["sh", "-c"]
      args:
        - |
          echo "Extracting plugin to shared volume..."
          rm -rf /plugins/PLUGIN_DIR_PLACEHOLDER
          mkdir -p /plugins/PLUGIN_DIR_PLACEHOLDER
          tar -xzf /tarball/plugin.tar.gz -C /plugins/PLUGIN_DIR_PLACEHOLDER
          echo "Files deployed:"
          ls -la /plugins/PLUGIN_DIR_PLACEHOLDER/
      volumeMounts:
        - name: plugins
          mountPath: /plugins
        - name: tarball
          mountPath: /tarball
          readOnly: true
  volumes:
    - name: plugins
      persistentVolumeClaim:
        claimName: headlamp-plugins
    - name: tarball
      configMap:
        name: plugin-tarball
YAMLDOC

# Substitute plugin dir name
sed -i "s/PLUGIN_DIR_PLACEHOLDER/${PLUGIN_DIR_NAME}/g" "$POD_FILE"

# Add nodeName if we know which node Headlamp is on
if [ -n "$HEADLAMP_NODE" ]; then
  sed -i "/restartPolicy: Never/i\\  nodeName: ${HEADLAMP_NODE}" "$POD_FILE"
fi

echo "Starting deploy pod..."
kubectl apply -n "$HEADLAMP_NAMESPACE" -f "$POD_FILE"
rm -f "$POD_FILE"

# Wait for the pod to complete (Succeeded phase)
echo "Waiting for deploy pod to complete..."
kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/plugin-deploy \
  -n "$HEADLAMP_NAMESPACE" --timeout=120s

# Show logs
kubectl logs plugin-deploy -n "$HEADLAMP_NAMESPACE" 2>/dev/null || true

# Clean up
kubectl delete pod plugin-deploy -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true
kubectl delete configmap plugin-tarball -n "$HEADLAMP_NAMESPACE" --ignore-not-found 2>/dev/null || true

rm -f "$TAR_FILE"

# Restart Headlamp to pick up the new plugin
echo "Restarting Headlamp deployment to load plugin..."
kubectl rollout restart "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE"
kubectl rollout status "deployment/$HEADLAMP_DEPLOY" -n "$HEADLAMP_NAMESPACE" --timeout=120s

echo "Plugin deployed successfully."
