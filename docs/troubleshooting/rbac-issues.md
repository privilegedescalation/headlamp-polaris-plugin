# RBAC Issues

Troubleshooting RBAC permissions and 403 errors for the Headlamp Polaris Plugin.

## Overview

The plugin requires `get` permission on `services/proxy` resource for the `polaris-dashboard` service in the `polaris` namespace. Without this permission, you'll see 403 Forbidden errors.

## Common Scenarios

### 403 Forbidden Error

**Symptom:** Error loading Polaris data, "Access denied (403)" in UI

**Cause:** Missing or incorrect RBAC binding

**Solution:**

```bash
# 1. Verify RBAC resources exist
kubectl -n polaris get role polaris-proxy-reader
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# If missing, apply RBAC:
kubectl apply -f - <<EOF
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

### Token-Auth Mode

**Symptom:** 403 error when using Headlamp with user-supplied tokens

**Cause:** User's own identity lacks the RoleBinding

**Solution:**

Bind the Role to authenticated users or specific users/groups:

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: users-polaris-proxy
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

### Testing Permissions

```bash
# Test service account (in-cluster mode)
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Test user (token-auth mode)
kubectl auth can-i get services/proxy \
  --as=user@example.com \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes
```

For detailed RBAC configuration, see [RBAC Permissions](../user-guide/rbac-permissions.md).

## References

- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Service Proxy RBAC](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
