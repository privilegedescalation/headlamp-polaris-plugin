# Configuration Guide

Customize the Headlamp Polaris Plugin to fit your environment.

## Plugin Settings

Access plugin settings via **Settings → Plugins → Polaris** in the Headlamp UI.

## Refresh Interval

**What it does:** Controls how often the plugin fetches the latest audit data from Polaris.

### Available Options

- **1 minute** - Most frequent updates, highest API load
- **5 minutes** - **Default**, balanced load and freshness
- **10 minutes** - Moderate refresh rate
- **30 minutes** - Light load, best for large clusters

### How to Change

1. Navigate to **Settings → Plugins → Polaris**
2. Click the **Refresh Interval** dropdown
3. Select your desired interval
4. Click **Save**
5. Changes take effect immediately (no browser refresh needed)

### Impact

**Affects:**

- Dashboard overview page
- Namespace list and detail views
- Inline audit sections on resource pages
- App bar score badge

**API Load:**

- Each refresh triggers one HTTP GET to Polaris dashboard
- Each request is logged in Kubernetes audit logs
- Longer intervals reduce API server and audit log pressure

### Performance Considerations

**For small clusters (<100 pods):**

- Recommended: 5 minutes (default)
- Acceptable: 1 minute (if real-time data is critical)

**For large clusters (>1000 pods):**

- Recommended: 10-30 minutes
- Reason: Reduces audit log volume and API server load
- Example: 10 users × 1-minute refresh = ~14,400 audit logs/day
- Example: 10 users × 30-minute refresh = ~480 audit logs/day

**For production environments:**

- Start with 5 minutes
- Monitor API server metrics and audit log volume
- Increase interval if needed

## Dashboard URL

**What it does:** Specifies which Polaris instance the plugin connects to.

### Default Configuration

**Service proxy path (default):**

```
/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/
```

This uses the Kubernetes API server to proxy requests to the Polaris dashboard service in the `polaris` namespace.

**Advantages:**

- Uses existing Headlamp authentication (service account or user token)
- Works with Headlamp's OIDC and token-auth modes
- No additional RBAC or network configuration needed
- Respects Kubernetes NetworkPolicies

### Custom URL Scenarios

#### External Polaris (HTTPS)

If Polaris is deployed outside the cluster with an external URL:

```
https://polaris.example.com/
```

**Requirements:**

- Polaris dashboard must be accessible from browser
- CORS must be configured on Polaris to allow Headlamp origin
- HTTPS recommended for production

#### Custom Namespace

If Polaris is deployed in a different namespace:

```
/api/v1/namespaces/custom-namespace/services/polaris-dashboard:80/proxy/
```

**Requirements:**

- Update RBAC Role namespace to match
- Service name must still be `polaris-dashboard` (or adjust in URL)

#### Non-Standard Port

If Polaris dashboard uses a different port:

```
/api/v1/namespaces/polaris/services/polaris-dashboard:8080/proxy/
```

#### Local Development

For local Polaris development instance:

```
http://localhost:8080/
```

**Note:** Browser may block mixed content (HTTPS Headlamp → HTTP Polaris).

### How to Change Dashboard URL

1. Navigate to **Settings → Plugins → Polaris**
2. Update the **Dashboard URL** field
3. Click **Test Connection** to verify (recommended)
4. Click **Save** if connection test succeeds

### Connection Testing

**What it does:** Verifies the plugin can reach the Polaris dashboard and fetch audit data.

**To test:**

1. Enter Dashboard URL in settings
2. Click **Test Connection**
3. Wait for response (2-5 seconds)

**Success Response:**

```
✓ Connected to Polaris v4.2.0
```

**Error Responses:**

| Error                       | Meaning                   | Solution                                                    |
| --------------------------- | ------------------------- | ----------------------------------------------------------- |
| **403 Forbidden**           | RBAC permission denied    | Check RBAC bindings (see [RBAC Guide](rbac-permissions.md)) |
| **404 Not Found**           | Polaris service not found | Verify Polaris is running: `kubectl get svc -n polaris`     |
| **503 Service Unavailable** | Polaris pod not ready     | Check pod status: `kubectl get pods -n polaris`             |
| **Network Error**           | Cannot reach URL          | Check URL format, CORS (for external), NetworkPolicies      |
| **CORS Error**              | Cross-origin blocked      | Configure Polaris dashboard CORS headers                    |

### CORS Configuration (External Polaris)

If using an external Polaris URL, configure CORS to allow Headlamp origin.

**Polaris Helm values:**

```yaml
dashboard:
  enabled: true
  env:
    - name: CORS_ALLOWED_ORIGINS
      value: 'https://headlamp.example.com'
```

**Test CORS:**

```bash
curl -v -H "Origin: https://headlamp.example.com" \
  https://polaris.example.com/results.json \
  | grep -i "access-control"

# Expected:
# Access-Control-Allow-Origin: https://headlamp.example.com
```

## Advanced Configuration

### Persistent Settings Storage

Plugin settings are stored in browser **localStorage**:

**Keys:**

- `polaris-plugin-refresh-interval` - Refresh interval in seconds (number)
- `polaris-plugin-dashboard-url` - Dashboard URL (string)

**View settings:**

```javascript
// Open browser DevTools Console (F12)
console.log('Refresh Interval:', localStorage.getItem('polaris-plugin-refresh-interval'));
console.log('Dashboard URL:', localStorage.getItem('polaris-plugin-dashboard-url'));
```

**Reset to defaults:**

```javascript
// Open browser DevTools Console (F12)
localStorage.removeItem('polaris-plugin-refresh-interval');
localStorage.removeItem('polaris-plugin-dashboard-url');
// Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

**Notes:**

- Settings are per-browser, per-user
- Private/incognito mode may clear settings on browser close
- Settings are NOT synced across devices

## Configuration Best Practices

### For Development Clusters

**Recommended Settings:**

- **Refresh Interval:** 1-5 minutes (faster feedback loop)
- **Dashboard URL:** Service proxy (default)

**Why:** Development clusters are typically small, so API load is minimal. Faster refresh helps catch issues quickly during development.

### For Staging Clusters

**Recommended Settings:**

- **Refresh Interval:** 5-10 minutes (balanced)
- **Dashboard URL:** Service proxy (default)

**Why:** Staging should mirror production configuration. 5-10 minutes provides reasonable freshness without excessive load.

### For Production Clusters

**Recommended Settings:**

- **Refresh Interval:** 10-30 minutes (reduce load)
- **Dashboard URL:** Service proxy (default)

**Why:** Production clusters are larger and more critical. Longer intervals reduce audit log volume and API pressure. Polaris audits typically run every 10-30 minutes anyway, so more frequent plugin refreshes don't provide much value.

### For Multi-Tenant Environments

**Recommended Settings:**

- **Refresh Interval:** 10-30 minutes (minimize per-user load)
- **Dashboard URL:** Service proxy with per-namespace RBAC

**Why:** Many concurrent Headlamp users can create significant API load. Longer intervals prevent thundering herd issues.

### For External Polaris

**Recommended Settings:**

- **Refresh Interval:** 5-10 minutes (depends on network latency)
- **Dashboard URL:** `https://polaris.example.com/`
- **CORS:** Must be configured on Polaris side

**Why:** External Polaris avoids Kubernetes service proxy overhead but requires CORS configuration and network accessibility.

## Troubleshooting Configuration

### Settings Not Saving

**Symptom:** Changes to settings revert after clicking Save

**Possible Causes:**

1. Browser blocks localStorage (privacy mode)
2. Browser extension interfering
3. JavaScript error in console

**Solution:**

1. Open browser DevTools Console (F12)
2. Check for JavaScript errors
3. Disable privacy mode or try different browser
4. Check if localStorage is enabled:
   ```javascript
   console.log('localStorage available:', typeof localStorage !== 'undefined');
   ```

### Settings Lost After Browser Restart

**Symptom:** Settings reset to defaults when you reopen browser

**Cause:** Browser privacy settings clear localStorage on exit

**Solution:**

- Use normal browsing mode (not private/incognito)
- Check browser settings for "Clear data on exit"
- Consider requesting ConfigMap-based settings (future feature)

### Connection Test Fails

**Symptom:** Test Connection button shows error

**Solutions by error type:**

**403 Forbidden:**

```bash
# Verify RBAC exists
kubectl -n polaris get role polaris-proxy-reader
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# Test permission
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard
```

**404 Not Found:**

```bash
# Verify Polaris is running
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# If missing, install Polaris
helm install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true
```

**503 Service Unavailable:**

```bash
# Check pod status
kubectl -n polaris get pods

# Check pod logs
kubectl -n polaris logs deployment/polaris-dashboard
```

**Network Error / CORS:**

```bash
# For external Polaris, test CORS
curl -v -H "Origin: https://headlamp.example.com" \
  https://polaris.example.com/results.json

# Check for Access-Control-Allow-Origin header
```

### Refresh Interval Not Working

**Symptom:** Data doesn't refresh automatically

**Check:**

1. Verify setting is saved (localStorage key exists)
2. Check browser console for errors
3. Verify Polaris is returning data (manual refresh works)
4. Ensure you're on a Polaris plugin page (not other Headlamp pages)

**Debug:**

```javascript
// Check refresh interval
console.log(localStorage.getItem('polaris-plugin-refresh-interval'));

// Should return: "300" (5 minutes), "600" (10 minutes), etc.
```

## Configuration Checklist

Before going to production, verify:

- [ ] Refresh interval set appropriately (10-30 min for large clusters)
- [ ] Dashboard URL tested and working
- [ ] Connection test passes
- [ ] RBAC permissions granted (see [RBAC Guide](rbac-permissions.md))
- [ ] NetworkPolicies allow API server → Polaris (if using network policies)
- [ ] CORS configured (if using external Polaris)
- [ ] Browser localStorage enabled
- [ ] Settings persist across browser restarts

## Future Configuration Options

**Planned features:**

- ConfigMap-based settings (server-side, not localStorage)
- Per-cluster settings (multi-cluster Headlamp support)
- Webhook notifications for score changes
- Custom check severity overrides
- Exemption management UI (requires RBAC PATCH permission)

## Next Steps

- **[Features Guide](features.md)** - Learn about all plugin features
- **[RBAC Permissions](rbac-permissions.md)** - Configure advanced RBAC for token-auth, OIDC
- **[Troubleshooting](../troubleshooting/README.md)** - Diagnose common configuration issues

## References

- [Polaris Configuration](https://polaris.docs.fairwinds.com/customization/checks/)
- [Kubernetes Service Proxy](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
