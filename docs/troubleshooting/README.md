# Troubleshooting

Quick diagnosis guide and common issues for the Headlamp Polaris Plugin.

## Quick Diagnosis

| Symptom                         | Likely Cause                                 | Quick Fix                                                             | Details                                                 |
| ------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| **Plugin not in sidebar**       | Browser cache or plugin not installed        | Hard refresh browser (Cmd+Shift+R) and verify plugin files exist      | [Common Issues](common-issues.md#plugin-not-in-sidebar) |
| **403 Access Denied**           | Missing RBAC binding for `services/proxy`    | Apply Role + RoleBinding from RBAC section                            | [RBAC Issues](rbac-issues.md)                           |
| **404 or 503**                  | Polaris not installed, or dashboard disabled | Install Polaris with `dashboard.enabled: true` in `polaris` namespace | [Common Issues](common-issues.md#404-not-found)         |
| **Dark mode white backgrounds** | Old plugin version                           | Upgrade to v0.3.5+ and hard refresh browser                           | [Common Issues](common-issues.md#dark-mode-issues)      |
| **Settings page empty**         | Old plugin version                           | Upgrade to v0.3.3+                                                    | [Common Issues](common-issues.md#settings-page-empty)   |
| **No data / infinite spinner**  | Network policy or Polaris pod down           | Check network policies and `kubectl get pods -n polaris`              | [Network Problems](network-problems.md)                 |
| **Namespace drawer white**      | CSS variable issue                           | Update to v0.3.5+ with `--mui-palette-background-paper`               | [Common Issues](common-issues.md#dark-mode-issues)      |
| **Cluster score not updating**  | Auto-refresh disabled or interval too long   | Check Settings → Plugins → Polaris refresh interval                   | [Common Issues](common-issues.md#data-not-refreshing)   |
| **Custom URL not working**      | CORS or incorrect URL format                 | Test with curl, check CORS headers                                    | [Network Problems](network-problems.md#cors-issues)     |

## Detailed Guides

- **[Common Issues](common-issues.md)** - Comprehensive guide to frequent problems and solutions
- **[RBAC Issues](rbac-issues.md)** - Permission debugging, 403 errors, token-auth mode
- **[Network Problems](network-problems.md)** - NetworkPolicies, connectivity, proxy issues, CORS

## Diagnostic Commands

### Quick Health Check

```bash
# 1. Verify Polaris is running
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# 2. Test Polaris API access
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Expected output: "1.0" or similar

# 3. Verify RBAC permissions
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes

# 4. Check Headlamp pod is running
kubectl -n kube-system get pods -l app.kubernetes.io/name=headlamp

# 5. Check Headlamp logs for plugin errors
kubectl -n kube-system logs deployment/headlamp | grep -i polaris

# Expected: No errors
```

### Plugin Loading Verification

```bash
# Verify plugin files exist
kubectl -n kube-system exec deployment/headlamp -c headlamp -- \
  ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected output:
# drwxr-xr-x  dist/
# -rw-r--r--  package.json
```

### RBAC Verification

```bash
# Check Role exists
kubectl -n polaris get role polaris-proxy-reader

# Check RoleBinding exists
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# Test permission (service account mode)
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Test permission (user token mode, replace with your user)
kubectl auth can-i get services/proxy \
  --as=user@example.com \
  -n polaris \
  --resource-name=polaris-dashboard
```

### Network Debugging

```bash
# Test from kubectl (uses same service proxy)
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json

# Check NetworkPolicies
kubectl -n polaris get networkpolicy

# Test direct service access (from within cluster)
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://polaris-dashboard.polaris/results.json
```

## Browser Debugging

### Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for errors containing "polaris" or "plugin"

**Common errors:**

- `createSvgIcon is not defined` → MUI import issue (plugin bug)
- `403 Forbidden` → RBAC permission denied
- `404 Not Found` → Polaris not installed or wrong URL
- `Failed to fetch` → Network policy or CORS issue

### Clear Browser Cache

**Critical:** After plugin updates, hard refresh to clear cached JavaScript:

- **Mac:** Cmd+Shift+R
- **Windows/Linux:** Ctrl+Shift+R
- **Alternatively:** Clear all browser data for Headlamp URL

### Check localStorage

```javascript
// Open browser console and run:
localStorage.getItem('polaris-plugin-refresh-interval');
localStorage.getItem('polaris-plugin-dashboard-url');

// Reset to defaults:
localStorage.removeItem('polaris-plugin-refresh-interval');
localStorage.removeItem('polaris-plugin-dashboard-url');
```

## Still Having Issues?

If the quick diagnosis doesn't resolve your issue:

1. **Check detailed guides:**

   - [Common Issues](common-issues.md)
   - [RBAC Issues](rbac-issues.md)
   - [Network Problems](network-problems.md)

2. **Review documentation:**

   - [Installation Guide](../getting-started/installation.md)
   - [RBAC Permissions](../user-guide/rbac-permissions.md)
   - [Deployment Guide](../deployment/kubernetes.md)

3. **Open a GitHub issue:**
   - [GitHub Issues](https://github.com/privilegedescalation/headlamp-polaris-plugin/issues)
   - Include: Headlamp version, plugin version, error messages, logs

## References

- [Headlamp Troubleshooting](https://headlamp.dev/docs/latest/troubleshooting/)
- [Polaris Troubleshooting](https://polaris.docs.fairwinds.com/troubleshooting/)
- [Kubernetes RBAC Troubleshooting](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#troubleshooting)
