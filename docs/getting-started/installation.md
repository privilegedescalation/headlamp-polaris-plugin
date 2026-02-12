# Installation Guide

This guide covers all installation methods for the Headlamp Polaris Plugin.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Option 1: Plugin Manager (Recommended)](#option-1-plugin-manager-recommended)
  - [Option 2: Sidecar Container](#option-2-sidecar-container)
  - [Option 3: Manual Tarball](#option-3-manual-tarball)
  - [Option 4: Build from Source](#option-4-build-from-source)
- [Post-Installation](#post-installation)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before installation, ensure all [prerequisites](prerequisites.md) are met:

- Kubernetes v1.24+
- Headlamp v0.26+ (v0.39+ recommended)
- Polaris deployed with dashboard enabled
- RBAC permissions configured

## Installation Methods

### Option 1: Plugin Manager (Recommended)

**Best for:** Production deployments, managed updates, ease of use

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin) and can be installed via the Headlamp Plugin Manager.

#### Via Headlamp UI

1. **Navigate to Plugin Settings:**
   - Open Headlamp in your browser
   - Go to **Settings → Plugins**
   - Click the **Catalog** tab

2. **Search and Install:**
   - Search for "Polaris"
   - Find "Headlamp Polaris Plugin"
   - Click **Install**

3. **Hard Refresh Browser:**
   - **Mac:** Cmd+Shift+R
   - **Windows/Linux:** Ctrl+Shift+R

4. **Verify Installation:**
   - Sidebar should show "Polaris" entry
   - Click **Polaris** → Overview page loads

#### Via Helm Configuration

Add to your Headlamp Helm values:

```yaml
# headlamp-values.yaml
config:
  pluginsDir: /headlamp/plugins
  watchPlugins: false  # CRITICAL for v0.39.0+

pluginsManager:
  enabled: true
  repositories:
    - https://artifacthub.io/packages/search?kind=4
```

Deploy or update Headlamp:

```bash
helm upgrade --install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml
```

Then install the plugin via Headlamp UI as described above.

#### Critical Configuration for Headlamp v0.39.0+

**⚠️ IMPORTANT:** You **must** set `config.watchPlugins: false` or the plugin will not load.

**Why?**
- With `watchPlugins: true` (default), catalog-managed plugins are treated as "development directory" plugins
- This causes the backend to serve metadata but the frontend never executes the JavaScript
- Result: Plugin appears in Settings but no sidebar/routes/settings work

**Fix:**
```yaml
config:
  watchPlugins: false  # Required for plugin manager
```

See [deployment/PLUGIN_LOADING_FIX.md](../deployment/production.md#plugin-loading-issue-headlamp-v0390) for full root cause analysis.

### Option 2: Sidecar Container

**Best for:** Controlled plugin versions, air-gapped environments, specific version pinning

This method uses an init container to download and install the plugin from a tarball URL.

#### Helm Values Configuration

```yaml
# headlamp-values.yaml
config:
  pluginsDir: /headlamp/plugins
  watchPlugins: false

initContainers:
  - name: install-polaris-plugin
    image: node:lts-alpine
    command:
      - sh
      - -c
      - |
        npm install -g @kinvolk/headlamp-plugin
        headlamp-plugin install --config /config/plugin.yml --plugins-dir /plugins
    volumeMounts:
      - name: plugins
        mountPath: /plugins
      - name: plugin-config
        mountPath: /config

volumes:
  - name: plugins
    emptyDir: {}
  - name: plugin-config
    configMap:
      name: headlamp-plugin-config
```

#### Plugin Configuration ConfigMap

```yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: headlamp-plugin-config
  namespace: kube-system
data:
  plugin.yml: |
    - name: headlamp-polaris-plugin
      version: 0.3.5
      url: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v0.3.10/polaris-0.3.10.tar.gz
```

#### Apply Configuration

```bash
# Create ConfigMap
kubectl apply -f headlamp-plugin-config.yaml

# Deploy/update Headlamp with sidecar
helm upgrade --install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml

# Wait for pod to be ready
kubectl -n kube-system wait --for=condition=ready pod -l app.kubernetes.io/name=headlamp --timeout=300s

# Verify plugin files
kubectl -n kube-system exec -it deployment/headlamp -c headlamp -- ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected output:
# drwxr-xr-x  dist/
# -rw-r--r--  package.json
```

### Option 3: Manual Tarball

**Best for:** Testing specific versions, offline installations

Download the plugin tarball and extract it into Headlamp's plugin directory.

#### Download and Extract

```bash
# Download latest release
VERSION=0.3.5
wget https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v${VERSION}/headlamp-polaris-plugin-${VERSION}.tar.gz

# Extract to plugin directory
tar xzf headlamp-polaris-plugin-${VERSION}.tar.gz -C /headlamp/plugins/

# Verify extraction
ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected output:
# drwxr-xr-x  dist/
# -rw-r--r--  package.json
```

#### Kubernetes Volume Mount

If Headlamp runs in Kubernetes, mount the plugin directory as a volume:

```yaml
# headlamp-values.yaml
config:
  pluginsDir: /plugins

volumes:
  - name: plugins
    hostPath:
      path: /path/to/plugins  # Where you extracted the tarball
      type: Directory

volumeMounts:
  - name: plugins
    mountPath: /plugins
    readOnly: true
```

**Note:** This method is not recommended for production (hostPath is node-specific).

### Option 4: Build from Source

**Best for:** Development, contributing, testing unreleased features

Clone the repository and build the plugin from source.

#### Clone and Build

```bash
# Clone repository
git clone https://github.com/privilegedescalation/headlamp-polaris-plugin.git
cd headlamp-polaris-plugin

# Install dependencies
npm install

# Build plugin
npm run build

# Package tarball (optional)
npm run package

# Extract to Headlamp plugin directory
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

#### Development Mode (Hot Reload)

For active development with hot reload:

```bash
# Start Headlamp with plugin hot reload
npm start

# Opens Headlamp at http://localhost:4466
# Changes to src/ automatically rebuild and reload
```

See [Development Workflow](../development/workflow.md) for detailed development setup.

## Post-Installation

After installing the plugin via any method:

### 1. Configure RBAC

Apply RBAC permissions for the plugin to access Polaris:

```bash
# Create polaris-plugin-rbac.yaml
cat <<EOF | kubectl apply -f -
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: polaris
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    resourceNames: ["polaris-dashboard"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: polaris
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
EOF
```

See [RBAC Permissions](../user-guide/rbac-permissions.md) for detailed RBAC configuration.

### 2. Restart Headlamp (if needed)

```bash
# If you updated Helm values or ConfigMaps
kubectl -n kube-system rollout restart deployment/headlamp

# Wait for pod to be ready
kubectl -n kube-system wait --for=condition=ready pod -l app.kubernetes.io/name=headlamp --timeout=300s
```

### 3. Clear Browser Cache

**Critical:** Hard refresh your browser to load the new plugin JavaScript:

- **Mac:** Cmd+Shift+R
- **Windows/Linux:** Ctrl+Shift+R

### 4. Verify Installation

**UI Verification:**
1. Navigate to **Settings → Plugins**
2. Verify "headlamp-polaris-plugin" is listed
3. Check version matches installed version
4. Verify **Polaris** appears in sidebar
5. Click **Polaris** → Overview page loads
6. Cluster score displays correctly

**CLI Verification:**

```bash
# Verify plugin files exist
kubectl -n kube-system exec -it deployment/headlamp -c headlamp -- ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected output:
# drwxr-xr-x  dist/
# -rw-r--r--  package.json

# Check Headlamp logs for errors
kubectl -n kube-system logs deployment/headlamp | grep -i polaris

# Expected: No errors related to plugin loading

# Test Polaris API access
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Expected: "1.0" or similar
```

## Troubleshooting

### Plugin Not in Sidebar

**Symptom:** Plugin listed in Settings → Plugins but no "Polaris" entry in sidebar

**Causes:**
1. `watchPlugins: true` (should be `false` for v0.39.0+)
2. Browser cache not cleared
3. Plugin JavaScript failed to load

**Solution:**

```bash
# 1. Check Headlamp config
kubectl -n kube-system get configmap headlamp -o yaml | grep watchPlugins

# If "true" or missing, fix it:
kubectl -n kube-system edit configmap headlamp
# Set: watchPlugins: "false"

# 2. Restart Headlamp
kubectl -n kube-system rollout restart deployment/headlamp

# 3. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

# 4. Check browser console for JavaScript errors
# Open DevTools → Console tab
```

### 403 Forbidden Error

**Symptom:** Error loading Polaris data, 403 in browser console

**Cause:** RBAC permissions missing or incorrect

**Solution:**

See [RBAC Issues](../troubleshooting/rbac-issues.md) for detailed debugging.

### 404 Not Found Error

**Symptom:** Error loading Polaris data, 404 in browser console

**Causes:**
1. Polaris not deployed
2. Polaris service name incorrect
3. Polaris namespace incorrect

**Solution:**

```bash
# Verify Polaris deployment
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# If service doesn't exist, install Polaris:
helm install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true
```

### Plugin Version Mismatch

**Symptom:** Settings shows old version, ArtifactHub shows new version

**Cause:** ArtifactHub sync delay (30 minutes) or plugin manager cache

**Solution:**

```bash
# Wait 30 minutes for ArtifactHub sync
# Or manually force Headlamp restart:
kubectl -n kube-system rollout restart deployment/headlamp
```

## Next Steps

- **[Quick Start](quick-start.md)** - Get up and running in 5 minutes
- **[Configuration](../user-guide/configuration.md)** - Customize refresh intervals, dashboard URLs
- **[Features](../user-guide/features.md)** - Learn about all plugin features
- **[Troubleshooting](../troubleshooting/README.md)** - Comprehensive troubleshooting guide

## References

- [Headlamp Plugin Documentation](https://headlamp.dev/docs/latest/development/plugins/)
- [Headlamp Helm Chart](https://github.com/headlamp-k8s/headlamp/tree/main/charts/headlamp)
- [Polaris Installation](https://polaris.docs.fairwinds.com/infrastructure-as-code/)
- [Artifact Hub Package](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)
