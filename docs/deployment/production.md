# Production Deployment

Production deployment checklist, best practices, and security considerations for the Headlamp Polaris Plugin.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Production Checklist](#production-checklist)
- [Security Best Practices](#security-best-practices)
- [High Availability](#high-availability)
- [Monitoring and Observability](#monitoring-and-observability)
- [Performance Tuning](#performance-tuning)
- [Disaster Recovery](#disaster-recovery)
- [Known Issues](#known-issues)

## Pre-Deployment Checklist

Before deploying to production:

### Infrastructure

- [ ] Kubernetes cluster v1.24+ running
- [ ] Polaris deployed in `polaris` namespace
- [ ] Polaris dashboard service (`polaris-dashboard:80`) accessible
- [ ] Headlamp v0.26+ deployed (v0.39+ recommended)
- [ ] Ingress controller configured (if exposing externally)
- [ ] TLS certificates provisioned (cert-manager recommended)

### Verification Commands

```bash
# Verify Polaris
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# Test Polaris API
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Verify Headlamp
kubectl -n kube-system get deployment headlamp
kubectl -n kube-system get svc headlamp
```

## Production Checklist

### Deployment

- [ ] Plugin installed via Plugin Manager or sidecar init container
- [ ] `config.watchPlugins: false` set in Headlamp configuration
- [ ] RBAC Role and RoleBinding applied
- [ ] NetworkPolicies configured (if using strict network policies)
- [ ] Headlamp pods running with 2+ replicas (high availability)
- [ ] Resource limits and requests configured

### Post-Deployment Verification

```bash
# 1. Verify Polaris API is accessible via service proxy
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion
# Expected: "1.0" or similar

# 2. Verify RBAC permissions
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard
# Expected: yes

# 3. Check Headlamp logs for plugin loading
kubectl -n kube-system logs deployment/headlamp | grep -i polaris
# Expected: No errors related to plugin loading

# 4. Verify plugin files exist
kubectl -n kube-system exec deployment/headlamp -c headlamp -- ls -la /headlamp/plugins/headlamp-polaris-plugin/
# Expected: dist/, package.json present
```

### UI Verification

- [ ] Navigate to **Settings → Plugins**
- [ ] Verify "headlamp-polaris-plugin" is listed with correct version
- [ ] Sidebar shows "Polaris" entry
- [ ] Click **Polaris → Overview** - page loads successfully
- [ ] Cluster score gauge displays
- [ ] Namespaces table loads with data
- [ ] App bar shows Polaris score badge
- [ ] Click namespace - detail drawer opens
- [ ] Test inline audit section on a Deployment/StatefulSet

## Security Best Practices

### RBAC

**Principle of Least Privilege:**

```yaml
# ✅ GOOD: Scoped to specific service
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    resourceNames: ["polaris-dashboard"]
    verbs: ["get"]

# ❌ BAD: Too broad
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    verbs: ["get"]  # Allows proxy to ALL services
```

**Token-Auth Mode:**

When Headlamp uses user-supplied tokens (OIDC), each user needs the RoleBinding:

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: authenticated-users-polaris-proxy
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

For fine-grained control, bind specific users or groups:

```yaml
subjects:
  - kind: Group
    name: sre-team  # Only SRE team
    apiGroup: rbac.authorization.k8s.io
```

### Network Policies

If using strict NetworkPolicies:

```yaml
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-apiserver-to-polaris
  namespace: polaris
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: polaris
      app.kubernetes.io/component: dashboard
  policyTypes:
    - Ingress
  ingress:
    # Allow from API server (performs the proxy hop)
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

**Note:** The API server proxies the request, not the Headlamp pod directly.

### Audit Logging

Kubernetes audit logs record every service proxy request:

- **What's logged:** User/service account, timestamp, response code
- **Volume:** Auto-refresh interval affects audit log volume
- **Recommendation:** Configure audit policy level if concerned about log volume

```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata  # Log metadata only (not full request/response)
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

**Recommendation:** Restrict plugin access to authorized users only (not `system:authenticated` unless appropriate).

## High Availability

### Headlamp Replicas

Deploy Headlamp with 2+ replicas for high availability:

```yaml
# helm-values.yaml
replicaCount: 2

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: headlamp
          topologyKey: kubernetes.io/hostname

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

### Pod Disruption Budget

Ensure at least one replica is always available during node maintenance:

```yaml
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: headlamp-pdb
  namespace: kube-system
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: headlamp
```

### Health Checks

Configure liveness and readiness probes:

```yaml
livenessProbe:
  httpGet:
    path: /
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Monitoring and Observability

### Metrics to Monitor

**Application Metrics:**

- Headlamp pod CPU/memory usage
- HTTP request latency and error rates
- Plugin load time

**Polaris Metrics:**

- Polaris dashboard API response time
- Service proxy request latency
- RBAC denial rate (403 errors)

### Prometheus Integration

Example ServiceMonitor for Headlamp:

```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: headlamp
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: headlamp
  endpoints:
    - port: http
      interval: 30s
      path: /metrics
```

### Logging

**Headlamp Logs:**

```bash
# View logs
kubectl -n kube-system logs deployment/headlamp -f

# Filter for plugin-related logs
kubectl -n kube-system logs deployment/headlamp | grep -i polaris
```

**Polaris Dashboard Logs:**

```bash
kubectl -n polaris logs deployment/polaris-dashboard -f
```

### Alerts

Recommended alerts:

- Headlamp pod not ready
- High error rate (4xx/5xx)
- Polaris dashboard unavailable
- RBAC denials (403 errors)

Example PrometheusRule:

```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: headlamp-alerts
  namespace: kube-system
spec:
  groups:
    - name: headlamp
      interval: 30s
      rules:
        - alert: HeadlampPodNotReady
          expr: kube_pod_status_ready{namespace="kube-system", pod=~"headlamp-.*"} == 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Headlamp pod not ready"
            description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} has been not ready for 5 minutes."
```

## Performance Tuning

### Plugin Refresh Interval

The plugin auto-refreshes Polaris data at a configurable interval (default: 5 minutes).

**Recommendations:**

- **High-traffic clusters:** 10-30 minutes (reduces API server load)
- **Low-traffic clusters:** 1-5 minutes (more real-time data)

Configure via **Settings → Plugins → Polaris** in Headlamp UI.

### Browser Caching

The plugin uses localStorage for settings. Browser cache can affect plugin loading.

**Best Practice:** Instruct users to hard refresh after plugin updates (**Cmd+Shift+R** / **Ctrl+Shift+R**).

### Resource Limits

Recommended resource limits for Headlamp with plugin:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

Adjust based on cluster size and user count.

## Disaster Recovery

### Backup Considerations

**What to back up:**

- Headlamp Helm values or Kubernetes manifests
- RBAC manifests (Role, RoleBinding)
- Plugin configuration (ConfigMap if using sidecar method)

**What NOT to back up:**

- Plugin tarball (available on GitHub releases)
- Polaris audit data (regenerated by Polaris)
- Browser localStorage (user-specific settings)

### Recovery Procedure

If Headlamp or plugin becomes unavailable:

1. **Verify Polaris is running:**
   ```bash
   kubectl -n polaris get pods
   kubectl -n polaris get svc polaris-dashboard
   ```

2. **Redeploy Headlamp:**
   ```bash
   helm upgrade --install headlamp headlamp/headlamp \
     --namespace kube-system \
     --values headlamp-values.yaml
   ```

3. **Reapply RBAC:**
   ```bash
   kubectl apply -f polaris-plugin-rbac.yaml
   ```

4. **Verify plugin files:**
   ```bash
   kubectl -n kube-system exec deployment/headlamp -- \
     ls /headlamp/plugins/headlamp-polaris-plugin/
   ```

5. **Hard refresh browser:**
   **Cmd+Shift+R** / **Ctrl+Shift+R**

## Known Issues

### Plugin Loading Issue (Headlamp v0.39.0+)

**Symptom:** Plugin appears in Settings but not in sidebar

**Cause:** `config.watchPlugins: true` (default) treats catalog plugins as development plugins

**Fix:**

```yaml
config:
  watchPlugins: false  # Required for plugin manager
```

**Root Cause:**

With `watchPlugins: true`, Headlamp backend serves plugin metadata but frontend never executes the JavaScript. This causes plugins to appear in Settings but no sidebar/routes/settings work.

**Documentation:** See `deployment/PLUGIN_LOADING_FIX.md` in repository for full analysis.

**After Fix:**

- Restart Headlamp deployment
- Hard refresh browser (**Cmd+Shift+R** / **Ctrl+Shift+R**)

### Skipped Count Limitation

**Symptom:** "Skipped" count in UI is lower than native Polaris dashboard

**Cause:** Plugin only counts checks with `Severity: "ignore"` from API response

**Explanation:**

Polaris omits annotation-based exemptions (e.g., `polaris.fairwinds.com/*-exempt`) from the `results.json` endpoint. The native Polaris dashboard computes skipped count by querying raw Kubernetes resources and parsing annotations.

**Workaround:** Use "View in Polaris Dashboard" link for accurate exemption count.

**Future Enhancement:** Would require cluster-wide read access to all workload types (significant RBAC expansion).

### ArtifactHub Sync Delay

**Symptom:** New plugin version not appearing in Headlamp catalog

**Cause:** ArtifactHub syncs from GitHub every 30 minutes (no webhook/push mechanism)

**Solution:** Wait 30 minutes after GitHub release for new version to appear in catalog.

## Troubleshooting

For production issues, see:

- **[Troubleshooting Guide](../troubleshooting/README.md)** - Comprehensive troubleshooting
- **[RBAC Issues](../troubleshooting/rbac-issues.md)** - Permission debugging
- **[Network Problems](../troubleshooting/network-problems.md)** - Connectivity issues

## Next Steps

- **[Kubernetes Deployment](kubernetes.md)** - Raw manifest deployment
- **[Helm Deployment](helm.md)** - Helm chart deployment
- **[Troubleshooting](../troubleshooting/README.md)** - Issue resolution

## References

- [Kubernetes Production Best Practices](https://kubernetes.io/docs/setup/best-practices/)
- [Headlamp Security](https://headlamp.dev/docs/latest/installation/in-cluster/#security)
- [Polaris Configuration](https://polaris.docs.fairwinds.com/customization/checks/)
