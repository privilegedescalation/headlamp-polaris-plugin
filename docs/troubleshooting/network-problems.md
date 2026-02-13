# Network Problems

Troubleshooting network connectivity issues for the Headlamp Polaris Plugin.

## Overview

The plugin accesses Polaris through the Kubernetes service proxy. Network issues can occur at multiple points in this chain:

```
Headlamp Pod → K8s API Server → Polaris Dashboard Service
```

## Common Issues

### NetworkPolicy Blocking Access

**Symptom:** Timeout or connection errors despite correct RBAC

**Cause:** NetworkPolicy in `polaris` namespace blocking API server ingress

**Solution:**

Allow ingress from the Kubernetes API server to Polaris dashboard:

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
    # Allow from API server
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

### Test Network Connectivity

```bash
# 1. Test service proxy endpoint
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json

# If successful: JSON output
# If failed: Check NetworkPolicies and service status

# 2. Check NetworkPolicies
kubectl -n polaris get networkpolicy

# 3. Test direct service access (from within cluster)
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://polaris-dashboard.polaris/results.json

# If this works but service proxy doesn't, check API server network access
```

### CORS Issues (Custom URL)

**Symptom:** Error when using custom Polaris URL in settings

**Cause:** CORS not configured on external Polaris deployment

**Solution:**

Configure Polaris dashboard to allow Headlamp origin:

```yaml
# Polaris Helm values
dashboard:
  enabled: true
  env:
    - name: CORS_ALLOWED_ORIGINS
      value: 'https://headlamp.example.com'
```

Test CORS headers:

```bash
curl -v -H "Origin: https://headlamp.example.com" \
  https://my-polaris.example.com/results.json

# Check for:
# Access-Control-Allow-Origin: https://headlamp.example.com
```

## References

- [Kubernetes NetworkPolicies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Service Proxy](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
