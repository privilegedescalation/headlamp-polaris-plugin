# Troubleshooting Guide

This guide covers common issues encountered when using the Headlamp Polaris Plugin and their solutions.

## Table of Contents

- [Plugin Not Showing in Sidebar](#plugin-not-showing-in-sidebar)
- [403 Forbidden Error](#403-forbidden-error)
- [404 Not Found Error](#404-not-found-error)
- [Plugin Settings Page Empty](#plugin-settings-page-empty)
- [Dark Mode Issues](#dark-mode-issues)
- [Data Not Loading / Infinite Spinner](#data-not-loading--infinite-spinner)
- [Browser Console Errors](#browser-console-errors)
- [Network and RBAC Debugging](#network-and-rbac-debugging)
- [Plugin Installation Issues](#plugin-installation-issues)
- [ArtifactHub Sync Delays](#artifacthub-sync-delays)

---

## Plugin Not Showing in Sidebar

### Symptoms
- Plugin appears in Settings → Plugins but sidebar entry is missing
- No "Polaris" section in navigation
- Routes like `/polaris` return 404 or blank page

### Common Causes

**1. Headlamp v0.39.0+ Plugin Loading Issue**

**Root Cause**: Headlamp v0.39.0+ changed plugin loading behavior. With `config.watchPlugins: true` (default), catalog-managed plugins are treated as "development directory" plugins, causing the backend to serve metadata but frontend to never execute the JavaScript.

**Solution**: Set `config.watchPlugins: false` in Headlamp configuration.

```yaml
# HelmRelease values
config:
  watchPlugins: false  # CRITICAL for plugin manager
```

After applying this change:
1. Restart Headlamp pod
2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
3. Clear browser cache if needed

**References**: See `deployment/PLUGIN_LOADING_FIX.md` for complete root cause analysis.

**2. Plugin Not Installed**

**Check plugin installation**:
```bash
# View Headlamp pod logs (plugin sidecar)
kubectl logs -n kube-system deployment/headlamp -c headlamp-plugin

# Expected output:
# Installing plugin from https://github.com/.../headlamp-polaris-plugin-X.Y.Z.tar.gz
# Plugin installed successfully
```

**Verify plugin files exist**:
```bash
kubectl exec -n kube-system deployment/headlamp -c headlamp -- ls -la /headlamp/plugins/
# Should show: headlamp-polaris-plugin/
```

**3. JavaScript Cached by Browser**

After upgrading the plugin, old JavaScript may be cached.

**Solution**:
- Hard refresh: Cmd+Shift+R (macOS) or Ctrl+Shift+R (Linux/Windows)
- Clear browser cache for Headlamp domain
- Open DevTools → Application → Clear Storage → Clear all

**4. Plugin Disabled in Settings**

**Check Settings → Plugins**:
- Navigate to Headlamp Settings → Plugins
- Ensure "Polaris" plugin is enabled (toggle should be ON)
- If disabled, enable it and refresh the page

---

## 403 Forbidden Error

### Symptoms
- Error message: "Error loading Polaris audit data: 403 Forbidden"
- Browser console shows 403 response from API proxy
- Plugin sidebar shows but data fails to load

### Root Cause
User or service account lacks `services/proxy` permission on `polaris-dashboard` service in the `polaris` namespace.

### Solution

**1. Verify RBAC Configuration**

Check if Role exists:
```bash
kubectl get role polaris-proxy-reader -n polaris -o yaml
```

Expected output:
```yaml
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

**2. Verify RoleBinding**

For service account mode:
```bash
kubectl get rolebinding headlamp-polaris-proxy -n polaris -o yaml
```

Expected subjects:
```yaml
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
```

For OIDC mode:
```bash
kubectl get rolebinding -n polaris -o yaml | grep -A 5 polaris-proxy-reader
```

Ensure your user or group is bound to the `polaris-proxy-reader` role.

**3. Create Missing RBAC**

If RBAC is missing, apply the minimal configuration:

```bash
kubectl apply -f - <<EOF
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

**4. Test RBAC Permissions**

Service account mode:
```bash
# Impersonate Headlamp service account
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  --resource-name=polaris-dashboard \
  -n polaris
# Expected: yes
```

OIDC mode (test as yourself):
```bash
kubectl auth can-i get services/proxy \
  --resource-name=polaris-dashboard \
  -n polaris
# Expected: yes (if you have proper RoleBinding)
```

**5. Restart Headlamp**

After applying RBAC changes:
```bash
kubectl rollout restart deployment headlamp -n kube-system
```

---

## 404 Not Found Error

### Symptoms
- Error message: "Error loading Polaris audit data: 404 Not Found"
- Service proxy request returns 404
- Polaris dashboard not reachable

### Root Cause
Polaris dashboard service doesn't exist or is in a different namespace.

### Solution

**1. Verify Polaris Installation**

Check if Polaris is installed:
```bash
kubectl get pods -n polaris
# Expected: polaris-dashboard-* pod running
```

Check if service exists:
```bash
kubectl get service polaris-dashboard -n polaris
# Expected: ClusterIP service on port 80
```

**2. Verify Service Name and Port**

The plugin expects:
- **Namespace**: `polaris`
- **Service Name**: `polaris-dashboard`
- **Port**: `80` (or named port `dashboard`)

If your service has a different name or is in a different namespace, you'll need to modify the plugin source or redeploy Polaris with standard naming.

**3. Test Service Proxy Manually**

```bash
kubectl proxy &
curl http://localhost:8001/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json
```

If this returns JSON, the service proxy works and the issue is elsewhere.
If this returns 404, Polaris service is not configured correctly.

**4. Check Polaris Dashboard Configuration**

Verify Polaris is running with dashboard enabled:
```bash
kubectl get deployment polaris-dashboard -n polaris -o yaml | grep -A 5 dashboard
```

If `dashboard.enabled: false` in Helm values, enable it:
```yaml
# values.yaml
dashboard:
  enabled: true
```

**5. Reinstall Polaris**

If Polaris is missing or misconfigured:
```bash
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm upgrade --install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true
```

---

## Plugin Settings Page Empty

### Symptoms
- Settings → Polaris shows title but no content
- Refresh interval and dashboard URL fields not visible

### Root Cause (Fixed in v0.3.3)
Plugin settings registration name didn't match `package.json` name.

### Solution

Upgrade to v0.3.3 or later:
```bash
# Via Headlamp UI: Settings → Plugins → Update
# Or redeploy with latest version
```

If manually installing, ensure plugin name matches `package.json`:
```typescript
registerPluginSettings('headlamp-polaris-plugin', PolarisSettings, true);
// NOT 'polaris' — must match package.json name
```

---

## Dark Mode Issues

### Symptoms
- Drawer background remains white in dark mode
- Text is hard to read in dark mode
- Theme colors don't match Headlamp UI

### Solution (Fixed in v0.3.5)

Upgrade to v0.3.5 or later for complete dark mode support.

**Verify CSS Variables**:
The plugin uses MUI CSS variables for theming:
- `--mui-palette-background-default` (drawer background)
- `--mui-palette-text-primary` (text color)
- `--mui-palette-primary-main` (links, buttons)
- `--mui-palette-error-main` (danger states)

These automatically adapt to Headlamp's theme (light/dark/system).

**Hard Refresh Required**:
After upgrading from v0.3.4 or earlier, hard refresh your browser:
- macOS: Cmd+Shift+R
- Linux/Windows: Ctrl+Shift+R

**Clear Browser Cache**:
If hard refresh doesn't help, clear cache for Headlamp domain.

---

## Data Not Loading / Infinite Spinner

### Symptoms
- Plugin shows "Loading Polaris audit data..." forever
- No error message in UI
- Data never appears

### Debugging Steps

**1. Check Browser Console**

Open DevTools (F12) → Console tab.

Look for:
- Network errors (CORS, timeouts, 5xx responses)
- JavaScript errors
- Failed API requests

**2. Check Network Tab**

Open DevTools → Network tab → Filter by "results.json"

Expected request:
```
GET /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json
Status: 200
Response: JSON data
```

Common issues:
- **Status 0 / Failed**: Network policy blocking request
- **Status 403**: RBAC issue (see [403 Forbidden Error](#403-forbidden-error))
- **Status 404**: Service not found (see [404 Not Found Error](#404-not-found-error))
- **Status 500**: Polaris dashboard error
- **Status 502/504**: Service unreachable (network policy or pod down)

**3. Check Polaris Dashboard Health**

```bash
# Check if Polaris pod is running
kubectl get pods -n polaris

# Check Polaris logs
kubectl logs -n polaris deployment/polaris-dashboard

# Test direct access to Polaris
kubectl port-forward -n polaris svc/polaris-dashboard 8080:80
curl http://localhost:8080/results.json
```

**4. Check Network Policies**

If your cluster uses NetworkPolicies:
```bash
kubectl get networkpolicy -n polaris
```

Ensure API server (or Headlamp pod) can reach Polaris dashboard.

**Example fix**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-server-to-polaris
  namespace: polaris
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: polaris
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector: {}  # Allow from all namespaces (API server)
      ports:
        - protocol: TCP
          port: 8080
```

**5. Increase Timeout / Disable Auto-Refresh**

If Polaris responds slowly:
- Open Settings → Polaris
- Increase refresh interval to 10+ minutes
- Or set to "Manual only" to disable auto-refresh

---

## Browser Console Errors

### Common Errors and Solutions

**Error: "Failed to fetch"**

**Cause**: Network request failed (CORS, network policy, timeout)

**Solution**:
1. Check Network tab for actual HTTP status
2. Verify network policies allow API server → Polaris
3. Check Polaris pod is running

---

**Error: "Unexpected token < in JSON"**

**Cause**: API returned HTML (error page) instead of JSON

**Solution**:
1. Check Network tab response body (likely 404 or 500 error page)
2. Verify Polaris service exists and is healthy
3. Check service proxy URL is correct

---

**Error: "registerPluginSettings is not a function"**

**Cause**: Headlamp version too old (< v0.26)

**Solution**: Upgrade Headlamp to v0.26 or later.

---

**Error: "Cannot read property 'AuditData' of undefined"**

**Cause**: Polaris returned empty or malformed response

**Solution**:
1. Check Polaris logs for errors
2. Verify Polaris is scanning the cluster (check audit timestamp)
3. Test `/results.json` endpoint directly

---

## Network and RBAC Debugging

### Comprehensive RBAC Test

Run this script to test all RBAC components:

```bash
#!/bin/bash
NS="polaris"
SA="headlamp"
SA_NS="kube-system"

echo "=== Testing RBAC for Polaris Plugin ==="

# 1. Check if service exists
echo "1. Service check:"
kubectl get svc polaris-dashboard -n $NS || echo "❌ Service not found"

# 2. Check if Role exists
echo "2. Role check:"
kubectl get role polaris-proxy-reader -n $NS || echo "❌ Role not found"

# 3. Check if RoleBinding exists
echo "3. RoleBinding check:"
kubectl get rolebinding headlamp-polaris-proxy -n $NS || echo "❌ RoleBinding not found"

# 4. Test service account permissions
echo "4. Permission test (service account):"
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:$SA_NS:$SA \
  --resource-name=polaris-dashboard \
  -n $NS

# 5. Test actual proxy request (requires kubectl proxy)
echo "5. Proxy test:"
kubectl proxy &
PROXY_PID=$!
sleep 2
curl -s http://localhost:8001/api/v1/namespaces/$NS/services/polaris-dashboard:80/proxy/results.json | jq '.DisplayName' || echo "❌ Proxy request failed"
kill $PROXY_PID

echo "=== Test complete ==="
```

### Network Policy Debugging

Test connectivity from Headlamp to Polaris:

```bash
# Create debug pod in kube-system namespace
kubectl run netdebug -n kube-system --rm -it --image=nicolaka/netshoot -- bash

# Inside pod, test DNS and HTTP
nslookup polaris-dashboard.polaris.svc.cluster.local
curl -v http://polaris-dashboard.polaris.svc.cluster.local/results.json
```

If this fails, network policies are blocking traffic.

### API Server Audit Logs

If you have audit logging enabled, check for denied requests:

```bash
# View recent audit logs (location varies by cluster)
kubectl logs -n kube-system kube-apiserver-* | grep polaris-dashboard

# Look for lines with:
# "reason": "Forbidden"
# "user": "system:serviceaccount:kube-system:headlamp"
```

---

## Plugin Installation Issues

### Sidecar Fails to Install Plugin

**Symptoms**:
- Plugin sidecar logs show download errors
- Plugin directory is empty
- Settings → Plugins shows nothing

**Check sidecar logs**:
```bash
kubectl logs -n kube-system deployment/headlamp -c headlamp-plugin
```

**Common errors**:

**1. Network timeout downloading tarball**

```
Error: connect ETIMEDOUT
```

**Solution**: Check cluster egress network policies allow HTTPS to GitHub.

---

**2. Invalid tarball URL**

```
Error: 404 Not Found
```

**Solution**: Verify `archive-url` in plugin config matches GitHub release:
```bash
kubectl get configmap headlamp-plugin-config -n kube-system -o yaml
```

Expected format:
```
https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v0.3.10/polaris-0.3.10.tar.gz
```

---

**3. Permission denied writing to /headlamp/plugins**

**Solution**: Ensure volume mount is writable:
```yaml
volumeMounts:
  - name: plugins
    mountPath: /headlamp/plugins
```

---

### Plugin Manager Not Working

**Symptoms**:
- Headlamp → Settings → Plugins shows "Catalog" tab but plugins don't install
- "Install" button does nothing

**Root Cause**: Plugin manager requires `config.pluginsDir` to be set.

**Solution**: Configure Headlamp for plugin manager:
```yaml
# HelmRelease values
config:
  pluginsDir: /headlamp/plugins
  watchPlugins: false  # CRITICAL for v0.39.0+
```

---

## ArtifactHub Sync Delays

### Symptoms
- New version released on GitHub but not showing in ArtifactHub
- Headlamp plugin catalog shows old version

### Root Cause
ArtifactHub pulls metadata every 30 minutes. There is no webhook or push mechanism.

### Solution

**Wait 30 minutes** after pushing a GitHub release, then check:
```
https://artifacthub.io/packages/headlamp/headlamp-polaris-plugin/headlamp-polaris-plugin
```

**Verify metadata**:
1. Check `artifacthub-pkg.yml` is in repository root
2. Check `headlamp/plugin/archive-url` points to GitHub release
3. Check `headlamp/plugin/archive-checksum` matches tarball SHA256

**Force sync** (ArtifactHub UI):
- Log in to ArtifactHub as package maintainer
- Go to package settings
- Click "Reindex now"

**Note**: First sync after repository registration may take up to 1 hour.

---

## Still Having Issues?

If none of these solutions work, gather debugging information and open an issue:

### Required Information

1. **Version Information**:
   ```bash
   kubectl get pods -n kube-system -l app.kubernetes.io/name=headlamp -o yaml | grep image:
   ```

2. **Plugin Version**:
   - Check Settings → Plugins in Headlamp UI
   - Or: `kubectl exec -n kube-system deployment/headlamp -c headlamp -- cat /headlamp/plugins/headlamp-polaris-plugin/package.json`

3. **Browser Console Output**:
   - Open DevTools (F12) → Console
   - Screenshot or copy errors

4. **Network Tab**:
   - Open DevTools → Network
   - Screenshot failed requests to `results.json`

5. **Pod Logs**:
   ```bash
   kubectl logs -n kube-system deployment/headlamp -c headlamp --tail=100
   kubectl logs -n polaris deployment/polaris-dashboard --tail=100
   ```

6. **RBAC Configuration**:
   ```bash
   kubectl get role,rolebinding -n polaris
   ```

### Where to Get Help

- **GitHub Issues**: [https://github.com/privilegedescalation/headlamp-polaris-plugin/issues](https://github.com/privilegedescalation/headlamp-polaris-plugin/issues)
- **GitHub Discussions**: [https://github.com/privilegedescalation/headlamp-polaris-plugin/discussions](https://github.com/privilegedescalation/headlamp-polaris-plugin/discussions)

Include the debugging information above when opening an issue.
