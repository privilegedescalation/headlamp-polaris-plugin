# RBAC Permissions Guide

Understanding and configuring RBAC for the Headlamp Polaris Plugin.

## Quick Reference

The plugin requires **one permission** to function:

| Verb  | API Group   | Resource         | Resource Name       | Namespace |
| ----- | ----------- | ---------------- | ------------------- | --------- |
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

This allows the plugin to fetch audit results via the Kubernetes service proxy.

**Why this permission?**

- Plugin accesses Polaris through Kubernetes API server's service proxy
- Service proxy requires `get` verb on `services/proxy` resource
- Scoped to specific service (`polaris-dashboard`) for security
- Read-only (no write operations)

## Standard Setup (Service Account Mode)

**Best for:** Headlamp running with a fixed service account in the cluster (in-cluster mode)

This is the most common deployment pattern for production Headlamp instances.

### Step 1: Create Role

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: polaris
  labels:
    app.kubernetes.io/name: headlamp-polaris-plugin
    app.kubernetes.io/component: rbac
rules:
  - apiGroups: ['']
    resources: ['services/proxy']
    resourceNames: ['polaris-dashboard']
    verbs: ['get']
```

**Key points:**

- **Role** (not ClusterRole) - Scoped to `polaris` namespace only
- **resourceNames** - Restricts access to `polaris-dashboard` service only
- **verbs: ["get"]** - Read-only permission

### Step 2: Create RoleBinding

```yaml
---
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
    name: headlamp # Adjust to your Headlamp SA name
    namespace: kube-system # Adjust to Headlamp's namespace
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

**Adjust for your environment:**

- `subjects[0].name` - Your Headlamp service account name (often `headlamp`)
- `subjects[0].namespace` - Namespace where Headlamp runs (often `kube-system`)

### Step 3: Apply and Verify

```bash
# Apply RBAC manifests
kubectl apply -f polaris-rbac.yaml

# Verify Role exists
kubectl -n polaris get role polaris-proxy-reader

# Verify RoleBinding exists
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# Test permission
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes
```

## Token-Auth Mode (Per-User Permissions)

**Best for:** Headlamp configured for user-supplied tokens, OIDC, or external authentication

In token-auth mode, **each user's own identity** is used for Kubernetes API requests (not a shared service account).

### Why Per-User RBAC?

With service account mode:

- Single RoleBinding grants access to all Headlamp users
- Kubernetes sees all requests as `system:serviceaccount:kube-system:headlamp`

With token-auth mode:

- Each user's own token (OIDC, kubeconfig) is used
- Kubernetes sees requests as `user@example.com` or `system:serviceaccount:team-ns:user-sa`
- **Each user needs individual RBAC permissions**

### Option 1: Grant to All Authenticated Users

**Use case:** Everyone with cluster access should see Polaris data

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: authenticated-users-polaris-proxy
  namespace: polaris
subjects:
  - kind: Group
    name: system:authenticated # All authenticated users
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

**Security consideration:** This grants Polaris access to **everyone** with cluster access. Ensure Polaris data is not sensitive in your environment.

### Option 2: Grant to Specific Users

**Use case:** Fine-grained control, only SRE/DevOps teams

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sre-team-polaris-proxy
  namespace: polaris
subjects:
  - kind: User
    name: alice@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: User
    name: bob@example.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

**Maintenance:** Add/remove users as team membership changes.

### Option 3: Grant to OIDC Groups

**Use case:** OIDC provider with group claims (most flexible)

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: oidc-group-polaris-proxy
  namespace: polaris
subjects:
  - kind: Group
    name: sre-team # OIDC group claim
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: devops-team
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

**Requirements:**

- OIDC provider must include group claims in token
- Headlamp must be configured to extract groups from OIDC token
- Group names must match exactly (case-sensitive)

**Example OIDC group claim:**

```json
{
  "sub": "user@example.com",
  "groups": ["sre-team", "developers"]
}
```

### Verify User Permission

```bash
# Test specific user
kubectl auth can-i get services/proxy \
  --as=user@example.com \
  -n polaris \
  --resource-name=polaris-dashboard

# Test OIDC group
kubectl auth can-i get services/proxy \
  --as=user@example.com \
  --as-group=sre-team \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes (if bound correctly)
```

## Multi-Namespace Polaris Deployments

**Scenario:** Polaris deployed in multiple namespaces (e.g., per-team Polaris instances)

### Create Role per Namespace

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: team-a-polaris # First Polaris instance
rules:
  - apiGroups: ['']
    resources: ['services/proxy']
    resourceNames: ['polaris-dashboard']
    verbs: ['get']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: team-b-polaris # Second Polaris instance
rules:
  - apiGroups: ['']
    resources: ['services/proxy']
    resourceNames: ['polaris-dashboard']
    verbs: ['get']
```

### Create RoleBindings per Namespace

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: team-a-polaris
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: team-b-polaris
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

**Plugin configuration:**
Users can switch between instances via **Settings → Plugins → Polaris → Dashboard URL**.

## Network Security

### NetworkPolicy Requirements

If the `polaris` namespace enforces NetworkPolicies, ensure the Kubernetes API server can reach Polaris dashboard.

**Why?** The Kubernetes API server proxies plugin requests, so it needs network access to Polaris.

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
    # Allow from Kubernetes API server
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

**Note:** Headlamp pod itself does NOT need direct network access to Polaris (API server does the proxying).

### Service Mesh Considerations

If using Istio, Linkerd, or other service meshes:

**No special configuration needed** - Service proxy requests bypass the mesh (go through API server).

## OAuth2 / OIDC Integration

When using OAuth2/OIDC authentication with Headlamp:

### How It Works

1. **User authenticates** with OIDC provider (e.g., Google, Okta, Keycloak)
2. **OIDC provider issues token** with user identity and group claims
3. **Headlamp receives token** and passes it to Kubernetes API
4. **Plugin makes request** using user's token (not service account)
5. **Kubernetes RBAC evaluates** user's permissions against RoleBinding

### Required Configuration

**Headlamp Helm values:**

```yaml
env:
  - name: HEADLAMP_CONFIG_OIDC_CLIENT_ID
    value: 'headlamp'
  - name: HEADLAMP_CONFIG_OIDC_CLIENT_SECRET
    valueFrom:
      secretKeyRef:
        name: headlamp-oidc
        key: client-secret
  - name: HEADLAMP_CONFIG_OIDC_ISSUER_URL
    value: 'https://auth.example.com/realms/kubernetes'
  - name: HEADLAMP_CONFIG_OIDC_SCOPES
    value: 'openid,profile,email,groups'
```

**RBAC for OIDC users:**

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: oidc-polaris-proxy
  namespace: polaris
subjects:
  - kind: Group
    name: kubernetes-admins # OIDC group claim
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

### Testing OIDC Permissions

```bash
# Simulate OIDC user with group
kubectl auth can-i get services/proxy \
  --as=user@example.com \
  --as-group=kubernetes-admins \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected: yes
```

## Audit Logging Considerations

Every plugin data fetch creates a Kubernetes API audit log entry.

### Example Audit Log

```json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "Metadata",
  "verb": "get",
  "user": {
    "username": "system:serviceaccount:kube-system:headlamp"
  },
  "sourceIPs": ["10.96.0.1"],
  "objectRef": {
    "resource": "services",
    "subresource": "proxy",
    "namespace": "polaris",
    "name": "polaris-dashboard",
    "apiVersion": "v1"
  },
  "responseStatus": {
    "code": 200
  }
}
```

### Volume Estimates

**Per user:**

- 1 refresh per 5 minutes = 288 requests/day
- 1 refresh per 30 minutes = 48 requests/day

**Cluster-wide:**

- 10 concurrent users × 5-minute refresh = 2,880 audit logs/day
- 100 concurrent users × 30-minute refresh = 4,800 audit logs/day

### Reducing Audit Volume

**Option 1: Increase refresh interval**

```
Settings → Plugins → Polaris → Refresh Interval → 30 minutes
```

**Option 2: Adjust audit policy level**

```yaml
# kube-apiserver audit policy
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata # Log metadata only, not full request/response
    verbs: ['get']
    resources:
      - group: ''
        resources: ['services/proxy']
    namespaces: ['polaris']
```

**Option 3: Filter audit logs**
If using a log aggregator (e.g., Elasticsearch), create filters to exclude or downsample Polaris proxy requests.

## Troubleshooting RBAC

### "403 Forbidden" Error in Plugin

**Symptom:** Plugin shows "Access denied (403)" error when loading data

**Diagnosis:**

1. **Check Role exists:**

   ```bash
   kubectl -n polaris get role polaris-proxy-reader
   ```

   If missing: Apply Role manifest

2. **Check RoleBinding exists:**

   ```bash
   kubectl -n polaris get rolebinding headlamp-polaris-proxy
   ```

   If missing: Apply RoleBinding manifest

3. **Test permission:**

   ```bash
   # Service account mode
   kubectl auth can-i get services/proxy \
     --as=system:serviceaccount:kube-system:headlamp \
     -n polaris \
     --resource-name=polaris-dashboard

   # Token-auth mode (replace with your username)
   kubectl auth can-i get services/proxy \
     --as=user@example.com \
     -n polaris \
     --resource-name=polaris-dashboard
   ```

   Expected: `yes`

4. **Verify RoleBinding subjects match:**
   ```bash
   kubectl -n polaris get rolebinding headlamp-polaris-proxy -o yaml
   ```
   Check `subjects[].name` and `subjects[].namespace` match your Headlamp SA or user

### "404 Not Found" Error

**This is NOT an RBAC issue.** 404 means Polaris service doesn't exist.

**Check:**

```bash
kubectl -n polaris get svc polaris-dashboard
```

If missing, install Polaris with dashboard enabled.

### Permission Test Passes but Plugin Still Shows 403

**Possible causes:**

1. **Wrong namespace in RoleBinding:**

   - RoleBinding must be in `polaris` namespace (where the service is)
   - Common mistake: Creating RoleBinding in `kube-system`

2. **Wrong resourceName:**

   - Must match service name exactly: `polaris-dashboard`
   - Check: `kubectl -n polaris get svc`

3. **Browser caching old 403:**

   - Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

4. **Token expired (OIDC mode):**
   - Re-authenticate with OIDC provider
   - Check token expiration in browser DevTools (Application → Session Storage)

## Security Best Practices

### 1. Use Namespaced Roles (Not ClusterRoles)

✅ **Good:**

```yaml
kind: Role
metadata:
  namespace: polaris
```

❌ **Bad:**

```yaml
kind: ClusterRole
# Grants access to all namespaces
```

**Why:** Namespaced Roles limit scope to `polaris` namespace only. ClusterRoles would allow access to service proxies in all namespaces.

### 2. Always Specify resourceNames

✅ **Good:**

```yaml
resourceNames: ['polaris-dashboard']
```

❌ **Bad:**

```yaml
resourceNames: [] # Allows access to ALL services
```

**Why:** `resourceNames` restricts permission to a specific service. Without it, the binding grants access to proxy all services in the namespace.

### 3. Use Read-Only Verb

✅ **Good:**

```yaml
verbs: ['get']
```

❌ **Bad:**

```yaml
verbs: ['get', 'create', 'update', 'delete']
```

**Why:** Plugin only needs `get` to fetch audit results. Additional verbs violate principle of least privilege.

### 4. Review Bindings Quarterly

- Remove users who no longer need access
- Update OIDC group bindings when org structure changes
- Audit who has access: `kubectl -n polaris get rolebindings -o yaml`

### 5. Monitor Audit Logs

Set alerts for:

- Unusual access patterns (e.g., 403 spikes = permission issues)
- High request volume (e.g., misconfigured refresh interval)
- Access from unexpected users (security monitoring)

### 6. Avoid Wildcard Permissions

❌ **Never do this:**

```yaml
rules:
  - apiGroups: ['*']
    resources: ['*']
    verbs: ['*']
```

This grants cluster-admin equivalent permissions. Always use specific resources and verbs.

## Next Steps

- **[Features Guide](features.md)** - Learn about plugin capabilities
- **[Configuration Guide](configuration.md)** - Configure refresh intervals and dashboard URL
- **[Troubleshooting RBAC](../troubleshooting/rbac-issues.md)** - Detailed RBAC debugging

## References

- [Kubernetes RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Service Proxy Authorization](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
- [Headlamp OIDC Configuration](https://headlamp.dev/docs/latest/installation/in-cluster/configuration/#oidc-configuration)
- [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
