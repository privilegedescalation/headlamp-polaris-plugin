# Deployment Guide

This document provides comprehensive deployment instructions for the Headlamp Polaris Plugin in production Kubernetes environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Helm Integration](#helm-integration)
- [RBAC Configuration](#rbac-configuration)
- [Network Policies](#network-policies)
- [Plugin Manager Setup](#plugin-manager-setup)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Components

1. **Kubernetes Cluster:** v1.19 or later
2. **Headlamp:** v0.26 or later (v0.39+ recommended)
3. **Polaris:** Deployed and accessible via service
4. **RBAC:** Permissions to create Roles and RoleBindings

### Pre-Deployment Verification

```bash
# Verify Polaris is deployed
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# Verify Polaris dashboard is responding
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Verify Headlamp is deployed
kubectl -n kube-system get pods -l app.kubernetes.io/name=headlamp
```

## Installation Methods

### Method 1: Headlamp Plugin Manager (Recommended)

**Best for:** Production deployments, managed updates

1. **Enable Plugin Manager in Headlamp:**

   ```yaml
   # headlamp-values.yaml
   config:
     pluginsDir: "/headlamp/plugins"

pluginsManager:
     enabled: true
     repositories:
       - https://artifacthub.io/packages/search?kind=4
   ```

2. **Deploy/Update Headlamp:**

   ```bash
   helm upgrade --install headlamp headlamp/headlamp \
     --namespace kube-system \
     --values headlamp-values.yaml
   ```

3. **Install Plugin via UI:**
   - Navigate to Headlamp → Settings → Plugins
   - Search for "Polaris"
   - Click "Install"
   - Refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

### Method 2: Sidecar Container (Alternative)

**Best for:** Controlled plugin versions, air-gapped environments

```yaml
# headlamp-values.yaml
config:
  pluginsDir: "/headlamp/plugins"
  watchPlugins: false  # CRITICAL: Must be false for plugin manager

replicaCount: 1

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

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: headlamp-plugin-config
  namespace: kube-system
data:
  plugin.yml: |
    - name: headlamp-polaris-plugin
      version: 0.3.4
      url: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v0.3.10/polaris-0.3.10.tar.gz
```

### Method 3: Volume Mount (Development)

**Best for:** Local testing, development

```yaml
# headlamp-values.yaml
config:
  pluginsDir: "/plugins"

volumes:
  - name: plugins
    hostPath:
      path: /path/to/plugins
      type: Directory

volumeMounts:
  - name: plugins
    mountPath: /plugins
    readOnly: true
```

Then manually place `headlamp-polaris-plugin/` in the host path.

## Helm Integration

### Complete Helm Values Example

```yaml
# headlamp-values.yaml
replicaCount: 2

image:
  repository: ghcr.io/headlamp-k8s/headlamp
  tag: v0.39.0

config:
  baseURL: ""
  pluginsDir: "/headlamp/plugins"
  watchPlugins: false  # MUST be false for plugin manager

pluginsManager:
  enabled: true
  repositories:
    - https://artifacthub.io/packages/search?kind=4

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: headlamp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: headlamp-tls
      hosts:
        - headlamp.example.com

serviceAccount:
  create: true
  name: headlamp

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

# OIDC Authentication (optional)
env:
  - name: HEADLAMP_CONFIG_OIDC_CLIENT_ID
    value: "headlamp"
  - name: HEADLAMP_CONFIG_OIDC_CLIENT_SECRET
    valueFrom:
      secretKeyRef:
        name: headlamp-oidc
        key: client-secret
  - name: HEADLAMP_CONFIG_OIDC_ISSUER_URL
    value: "https://auth.example.com/realms/kubernetes"
  - name: HEADLAMP_CONFIG_OIDC_SCOPES
    value: "openid,profile,email,groups"
```

### FluxCD HelmRelease Example

```yaml
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: headlamp
  namespace: kube-system
spec:
  interval: 30m
  chart:
    spec:
      chart: headlamp
      version: 0.26.x
      sourceRef:
        kind: HelmRepository
        name: headlamp
        namespace: flux-system
      interval: 12h

  values:
    config:
      pluginsDir: "/headlamp/plugins"
      watchPlugins: false

    pluginsManager:
      enabled: true
      repositories:
        - https://artifacthub.io/packages/search?kind=4

    service:
      type: ClusterIP

    ingress:
      enabled: true
      className: nginx
      hosts:
        - host: headlamp.example.com
          paths:
            - path: /
              pathType: Prefix
```

## RBAC Configuration

### Minimal Role for Plugin

The plugin requires **read-only** access to the Polaris dashboard service proxy.

```yaml
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
```

### RoleBinding Options

#### Option A: Headlamp Service Account (In-Cluster Mode)

```yaml
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
```

#### Option B: User Groups (Token/OIDC Mode)

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: users-polaris-proxy
  namespace: polaris
subjects:
  - kind: Group
    name: system:authenticated  # All authenticated users
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

#### Option C: Specific Users (Fine-Grained Control)

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devops-polaris-proxy
  namespace: polaris
subjects:
  - kind: User
    name: alice@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: User
    name: bob@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: devops-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

### Complete RBAC Manifest

```yaml
---
# Role: Read-only access to Polaris service proxy
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: polaris
  labels:
    app.kubernetes.io/name: headlamp-polaris-plugin
    app.kubernetes.io/component: rbac
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    resourceNames: ["polaris-dashboard"]
    verbs: ["get"]

---
# RoleBinding: Grant Headlamp service account access
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: polaris
  labels:
    app.kubernetes.io/name: headlamp-polaris-plugin
    app.kubernetes.io/component: rbac
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

Apply with:
```bash
kubectl apply -f polaris-plugin-rbac.yaml
```

## Network Policies

### Required Network Access

The plugin requires network connectivity:
- **Headlamp pod** → **Kubernetes API server** (service proxy)
- **Kubernetes API server** → **Polaris dashboard service** (port 80)

### Network Policy Example

If your `polaris` namespace has strict NetworkPolicies:

```yaml
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-headlamp-to-polaris
  namespace: polaris
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: polaris
      app.kubernetes.io/component: dashboard
  policyTypes:
    - Ingress
  ingress:
    # Allow from API server (service proxy)
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
        - podSelector:
            matchLabels:
              component: kube-apiserver
      ports:
        - protocol: TCP
          port: 80
```

**Note:** The API server performs the proxy hop, not the Headlamp pod directly.

## Plugin Manager Setup

### Critical Configuration

**❌ WRONG (Will not load plugins):**
```yaml
config:
  watchPlugins: true  # Default, treats catalog plugins as dev plugins
```

**✅ CORRECT:**
```yaml
config:
  watchPlugins: false  # Required for plugin manager catalog plugins
```

### Why `watchPlugins: false` is Required

- **With `watchPlugins: true`:** Headlamp backend serves plugin metadata, but frontend never executes the JavaScript (treated as development directory plugin)
- **Result:** Plugins appear in Settings but no sidebar/routes/settings work
- **Fix:** Set `watchPlugins: false` in Headlamp configuration
- **Documentation:** See `deployment/PLUGIN_LOADING_FIX.md` for root cause analysis

### Plugin Manager Verification

```bash
# Check Headlamp config
kubectl -n kube-system get configmap headlamp -o yaml | grep watchPlugins

# Expected output:
# watchPlugins: "false"

# Check plugin is installed
kubectl -n kube-system exec -it deployment/headlamp -- ls -la /headlamp/plugins/

# Expected output:
# drwxr-xr-x headlamp-polaris-plugin/
```

## Production Checklist

### Pre-Deployment

- [ ] Polaris deployed and running
- [ ] Polaris dashboard service exists (`polaris-dashboard` in `polaris` namespace)
- [ ] RBAC Role and RoleBinding created
- [ ] Headlamp v0.26+ deployed
- [ ] `watchPlugins: false` set in Headlamp config

### Deployment

- [ ] Plugin installed via plugin manager or sidecar
- [ ] Headlamp pods restarted (if config changed)
- [ ] Browser cache cleared (Cmd+Shift+R / Ctrl+Shift+R)

### Post-Deployment Verification

```bash
# 1. Verify Polaris is accessible via service proxy
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Expected: "1.0" or similar

# 2. Verify RBAC is correct
kubectl auth can-i get services/proxy --as=system:serviceaccount:kube-system:headlamp -n polaris --resource-name=polaris-dashboard

# Expected: yes

# 3. Check Headlamp logs
kubectl -n kube-system logs deployment/headlamp | grep -i polaris

# Expected: No errors related to plugin loading

# 4. Verify plugin files exist
kubectl -n kube-system exec -it deployment/headlamp -- ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected: dist/, package.json present
```

### UI Verification

- [ ] Navigate to Headlamp → Settings → Plugins
- [ ] Plugin "headlamp-polaris-plugin" listed
- [ ] Sidebar shows "Polaris" entry
- [ ] Click "Polaris" → Overview page loads
- [ ] Cluster score displays correctly
- [ ] Namespaces page shows table
- [ ] App bar shows Polaris score badge

## Troubleshooting

### Plugin Not Appearing in Sidebar

**Symptom:** Plugin listed in Settings → Plugins but no sidebar entry

**Causes:**
1. `watchPlugins: true` (should be `false`)
2. Browser cache not cleared

**Solution:**
```bash
# Fix Headlamp config
kubectl -n kube-system edit configmap headlamp
# Set watchPlugins: false

# Restart Headlamp
kubectl -n kube-system rollout restart deployment/headlamp

# Clear browser cache
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

### 403 Forbidden Error

**Symptom:** Error loading Polaris data, 403 in console

**Cause:** RBAC missing or incorrect

**Solution:**
```bash
# Verify RBAC exists
kubectl -n polaris get role polaris-proxy-reader
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# Test permission
kubectl auth can-i get services/proxy --as=system:serviceaccount:kube-system:headlamp -n polaris --resource-name=polaris-dashboard

# If "no", create RBAC (see RBAC Configuration section)
```

### 404 Not Found Error

**Symptom:** Error loading Polaris data, 404 in console

**Causes:**
1. Polaris not deployed
2. Polaris service name wrong
3. Polaris namespace wrong

**Solution:**
```bash
# Check Polaris deployment
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# If service doesn't exist, install Polaris:
helm install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true
```

### Custom Dashboard URL Not Working

**Symptom:** Error when using custom Polaris URL in settings

**Causes:**
1. URL format incorrect
2. CORS not configured on external Polaris
3. Network policy blocking external access

**Solution:**
```bash
# Test URL manually
curl -v https://my-polaris.example.com/results.json

# For external Polaris, check CORS headers
# Must allow Headlamp origin
```

### Plugin Shows Old Version

**Symptom:** Plugin version in Settings doesn't match expected

**Cause:** Plugin manager hasn't synced from ArtifactHub

**Solution:**
```bash
# Wait 30 minutes (ArtifactHub sync interval)
# Or manually refresh plugin list in Headlamp UI

# Force Headlamp restart
kubectl -n kube-system rollout restart deployment/headlamp
```

### Network Policy Blocking Access

**Symptom:** Timeout or connection errors despite correct RBAC

**Cause:** NetworkPolicy in `polaris` namespace blocking API server

**Solution:**
```bash
# Check NetworkPolicies
kubectl -n polaris get networkpolicy

# Test connectivity from API server (if possible)
# Add NetworkPolicy to allow API server → Polaris dashboard (see Network Policies section)
```

## Security Considerations

### Least Privilege

- Grant only `get` on `services/proxy`, not broader permissions
- Use `resourceNames` to restrict to specific service (`polaris-dashboard`)
- Scope to `polaris` namespace only (Role, not ClusterRole)

### Audit Logging

Kubernetes audit logs will record:
- User/service account accessing service proxy
- Timestamp and response code

Configure audit policy if needed:
```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    verbs: ["get"]
    resources:
      - group: ""
        resources: ["services/proxy"]
    namespaces: ["polaris"]
```

### Data Sensitivity

Polaris audit data may contain:
- Resource names and namespaces
- Configuration details
- Potential security vulnerabilities

**Recommendation:** Restrict plugin access to authorized users only (not `system:authenticated` group unless appropriate).

## Upgrading

### Plugin Upgrade via Plugin Manager

1. Navigate to Settings → Plugins
2. Find "headlamp-polaris-plugin"
3. Click "Update" if new version available
4. Refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

### Sidecar Method Upgrade

1. Update ConfigMap with new version/URL
2. Restart Headlamp deployment
3. Verify new version in Settings → Plugins

```bash
kubectl -n kube-system edit configmap headlamp-plugin-config
# Update version and URL

kubectl -n kube-system rollout restart deployment/headlamp
```

## References

- [Headlamp Deployment](https://headlamp.dev/docs/latest/installation/)
- [Headlamp Helm Chart](https://github.com/headlamp-k8s/headlamp/tree/main/charts/headlamp)
- [Polaris Installation](https://polaris.docs.fairwinds.com/infrastructure-as-code/)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Kubernetes Service Proxy](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/#manually-constructing-apiserver-proxy-urls)
