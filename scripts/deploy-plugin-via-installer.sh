#!/usr/bin/env bash
# deploy-plugin-via-installer.sh
#
# Deploys the Headlamp Polaris plugin to a running Headlamp instance using
# the Headlamp plugin installer (pluginsManager sidecar) with Artifact Hub
# as the sole distribution channel.
#
# This script:
#   1. Verifies Headlamp connectivity
#   2. Ensures the HelmRelease has pluginsManager configured with the
#      Artifact Hub source for the polaris plugin
#   3. Waits for the plugin to appear in the Headlamp /plugins endpoint
#   4. Validates plugin availability
#
# Requirements:
#   - kubectl configured with cluster access
#   - HEADLAMP_URL environment variable (defaults to in-cluster service)
#
# Usage:
#   ./scripts/deploy-plugin-via-installer.sh
#
# Per INSTALLATION_POLICY.md: Artifact Hub is the ONLY approved distribution
# channel. No kubectl exec/cp, no init containers, no manual tarball extraction.

set -euo pipefail

HEADLAMP_URL="${HEADLAMP_URL:-http://headlamp.kube-system.svc.cluster.local}"
HEADLAMP_NAMESPACE="${HEADLAMP_NAMESPACE:-kube-system}"
HEADLAMP_RELEASE="${HEADLAMP_RELEASE:-headlamp}"
ARTIFACTHUB_SOURCE="https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin"
PLUGIN_NAME="headlamp-polaris"
POLL_INTERVAL=5
POLL_TIMEOUT=120

log() { echo "[deploy-plugin] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── Step 1: Verify Headlamp connectivity ──────────────────────────────────────

log "Checking Headlamp at $HEADLAMP_URL ..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "$HEADLAMP_URL" || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  die "Cannot reach Headlamp at $HEADLAMP_URL"
fi
log "Headlamp responded HTTP $HTTP_CODE"

# ── Step 2: Check current plugin state ────────────────────────────────────────

log "Querying installed plugins ..."
PLUGINS_JSON=$(curl -sf --connect-timeout 10 "$HEADLAMP_URL/plugins" 2>/dev/null || echo "[]")

PLUGIN_FOUND=$(echo "$PLUGINS_JSON" | node -e "
  const plugins = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const found = plugins.find(p =>
    p.name === '$PLUGIN_NAME' ||
    p.name === 'polaris' ||
    p.name.includes('polaris')
  );
  if (found) {
    console.log(JSON.stringify({ name: found.name, version: found.version || 'unknown' }));
  } else {
    console.log('null');
  }
" 2>/dev/null || echo "null")

if [ "$PLUGIN_FOUND" != "null" ]; then
  log "Plugin already installed: $PLUGIN_FOUND"
  DEPLOYED_NAME=$(echo "$PLUGIN_FOUND" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).name" 2>/dev/null || echo "unknown")
  log "Deployed plugin directory name: $DEPLOYED_NAME"
  exit 0
fi

log "Plugin not found — ensuring pluginsManager is configured ..."

# ── Step 3: Configure pluginsManager via HelmRelease ──────────────────────────

# Check if this is a Flux HelmRelease or standalone Helm release
HELMRELEASE_EXISTS=$(kubectl get helmrelease "$HEADLAMP_RELEASE" -n "$HEADLAMP_NAMESPACE" -o name 2>/dev/null || echo "")

if [ -n "$HELMRELEASE_EXISTS" ]; then
  log "Found Flux HelmRelease: $HELMRELEASE_EXISTS"

  # Check if pluginsManager is already configured
  PM_ENABLED=$(kubectl get helmrelease "$HEADLAMP_RELEASE" -n "$HEADLAMP_NAMESPACE" \
    -o jsonpath='{.spec.values.pluginsManager.enabled}' 2>/dev/null || echo "")

  if [ "$PM_ENABLED" != "true" ]; then
    log "Patching HelmRelease to enable pluginsManager with Artifact Hub source ..."
    kubectl patch helmrelease "$HEADLAMP_RELEASE" -n "$HEADLAMP_NAMESPACE" --type merge -p "
spec:
  values:
    pluginsManager:
      enabled: true
      configContent: |
        plugins:
          - name: $PLUGIN_NAME
            source: $ARTIFACTHUB_SOURCE
" || die "Failed to patch HelmRelease"
    log "HelmRelease patched — Flux will reconcile the deployment"
  else
    log "pluginsManager already enabled — checking plugin config ..."

    # Verify polaris is in the config
    CONFIG_CONTENT=$(kubectl get helmrelease "$HEADLAMP_RELEASE" -n "$HEADLAMP_NAMESPACE" \
      -o jsonpath='{.spec.values.pluginsManager.configContent}' 2>/dev/null || echo "")

    if ! echo "$CONFIG_CONTENT" | grep -q "polaris"; then
      log "Adding polaris plugin to pluginsManager config ..."
      UPDATED_CONFIG="${CONFIG_CONTENT}
          - name: $PLUGIN_NAME
            source: $ARTIFACTHUB_SOURCE"
      kubectl patch helmrelease "$HEADLAMP_RELEASE" -n "$HEADLAMP_NAMESPACE" --type merge -p "
spec:
  values:
    pluginsManager:
      configContent: |
        $(echo "$UPDATED_CONFIG" | sed 's/^/        /')
" || die "Failed to update pluginsManager config"
      log "Polaris plugin added to pluginsManager config"
    else
      log "Polaris plugin already in pluginsManager config"
    fi
  fi
else
  # Standalone Helm release — use helm upgrade
  log "No Flux HelmRelease found — checking for standalone Helm release ..."

  HELM_RELEASE=$(helm list -n "$HEADLAMP_NAMESPACE" -q --filter "$HEADLAMP_RELEASE" 2>/dev/null || echo "")

  if [ -n "$HELM_RELEASE" ]; then
    log "Found Helm release: $HELM_RELEASE — upgrading with pluginsManager ..."
    helm upgrade "$HEADLAMP_RELEASE" headlamp/headlamp -n "$HEADLAMP_NAMESPACE" --reuse-values \
      --set pluginsManager.enabled=true \
      --set-string "pluginsManager.configContent=plugins:\n  - name: $PLUGIN_NAME\n    source: $ARTIFACTHUB_SOURCE\n" \
      || die "helm upgrade failed"
    log "Helm release upgraded"
  else
    die "No Headlamp deployment found (checked Flux HelmRelease and Helm release in $HEADLAMP_NAMESPACE)"
  fi
fi

# ── Step 4: Wait for plugin to become available ───────────────────────────────

log "Waiting for plugin to appear (timeout: ${POLL_TIMEOUT}s) ..."
ELAPSED=0

while [ "$ELAPSED" -lt "$POLL_TIMEOUT" ]; do
  PLUGINS_JSON=$(curl -sf --connect-timeout 5 "$HEADLAMP_URL/plugins" 2>/dev/null || echo "[]")
  FOUND=$(echo "$PLUGINS_JSON" | node -e "
    const plugins = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const found = plugins.find(p =>
      p.name === '$PLUGIN_NAME' ||
      p.name === 'polaris' ||
      p.name.includes('polaris')
    );
    console.log(found ? 'yes' : 'no');
  " 2>/dev/null || echo "no")

  if [ "$FOUND" = "yes" ]; then
    log "Plugin is now available!"
    echo "$PLUGINS_JSON" | node -e "
      const plugins = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      const found = plugins.find(p =>
        p.name === '$PLUGIN_NAME' ||
        p.name === 'polaris' ||
        p.name.includes('polaris')
      );
      console.log('[deploy-plugin] Plugin: ' + found.name + '@' + (found.version || 'unknown'));
    " 2>/dev/null
    exit 0
  fi

  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  log "Waiting... (${ELAPSED}s / ${POLL_TIMEOUT}s)"
done

die "Timed out waiting for plugin to appear after ${POLL_TIMEOUT}s"
