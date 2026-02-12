# Prerequisites

Before installing the Headlamp Polaris Plugin, ensure your environment meets the following requirements.

## Required Components

| Requirement                      | Minimum Version    | Recommended Version |
| -------------------------------- | ------------------ | ------------------- |
| **Kubernetes**                   | v1.24+             | v1.28+              |
| **Headlamp**                     | v0.26+             | v0.39+              |
| **Polaris** (dashboard enabled)  | Any recent release | Latest stable       |
| **Browser**                      | Modern (ES2020+)   | Latest Chrome/Firefox/Safari/Edge |

## Polaris Requirements

The plugin requires Polaris to be deployed with the dashboard component enabled:

- **Namespace:** `polaris` (default expected namespace)
- **Dashboard enabled:** `dashboard.enabled: true` in Helm chart (default)
- **Service:** `polaris-dashboard` ClusterIP service on port 80

### Verify Polaris Installation

```bash
# Check Polaris pods are running
kubectl -n polaris get pods

# Expected output:
# NAME                                 READY   STATUS    RESTARTS   AGE
# polaris-dashboard-xxxxxxxxx-xxxxx    1/1     Running   0          1h
# polaris-webhook-xxxxxxxxx-xxxxx      1/1     Running   0          1h

# Check Polaris dashboard service exists
kubectl -n polaris get svc polaris-dashboard

# Expected output:
# NAME                TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
# polaris-dashboard   ClusterIP   10.96.xxx.xxx   <none>        80/TCP    1h

# Test Polaris dashboard API
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq .PolarisOutputVersion

# Expected output:
# "1.0"
```

### Install Polaris (if not present)

```bash
# Add Fairwinds Helm repository
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm repo update

# Install Polaris with dashboard enabled
helm install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true

# Wait for pods to be ready
kubectl -n polaris wait --for=condition=ready pod -l app.kubernetes.io/name=polaris --timeout=300s
```

## Headlamp Requirements

### Verify Headlamp Installation

```bash
# Check Headlamp is deployed
kubectl -n kube-system get pods -l app.kubernetes.io/name=headlamp

# Expected output:
# NAME                        READY   STATUS    RESTARTS   AGE
# headlamp-xxxxxxxxxx-xxxxx   1/1     Running   0          1h

# Check Headlamp version (must be v0.26+)
kubectl -n kube-system get deployment headlamp -o jsonpath='{.spec.template.spec.containers[0].image}'

# Expected output:
# ghcr.io/headlamp-k8s/headlamp:v0.39.0  (or similar)
```

### Install Headlamp (if not present)

```bash
# Add Headlamp Helm repository
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/
helm repo update

# Install Headlamp
helm install headlamp headlamp/headlamp \
  --namespace kube-system \
  --set config.pluginsDir="/headlamp/plugins" \
  --set config.watchPlugins=false \
  --set pluginsManager.enabled=true

# Wait for pod to be ready
kubectl -n kube-system wait --for=condition=ready pod -l app.kubernetes.io/name=headlamp --timeout=300s
```

## RBAC Requirements

The plugin requires permissions to access the Polaris dashboard via Kubernetes service proxy.

### Required Permission

| Verb  | API Group   | Resource         | Resource Name       | Namespace |
| ----- | ----------- | ---------------- | ------------------- | --------- |
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

### Verify RBAC Permissions

```bash
# Test if Headlamp service account has permission
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes

# If "no", you need to create RBAC (see installation guide)
```

## Network Requirements

### Service Proxy Access

The plugin accesses Polaris through the Kubernetes API server's service proxy:

```
Headlamp Pod → Kubernetes API Server → Polaris Dashboard Service
```

**Required network paths:**
- Headlamp pod → Kubernetes API server (443)
- Kubernetes API server → Polaris dashboard service (80)

### NetworkPolicy Considerations

If the `polaris` namespace has NetworkPolicies enabled, ensure the Kubernetes API server can reach the `polaris-dashboard` service on port 80.

### Test Network Connectivity

```bash
# Test service proxy endpoint from API server
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq . > /dev/null

# If successful, no output
# If failed, check NetworkPolicies and service status
```

## Browser Requirements

The plugin uses modern JavaScript features and requires:

- **ES2020+ support**
- **localStorage** enabled
- **JavaScript** enabled
- **Cookies** enabled (for Headlamp session)

### Tested Browsers

| Browser          | Minimum Version |
| ---------------- | --------------- |
| Chrome/Chromium  | 80+             |
| Firefox          | 75+             |
| Safari           | 13.1+           |
| Edge             | 80+             |

## Optional Components

### OIDC Authentication (for multi-user deployments)

If using Headlamp with OIDC authentication, each user must have RBAC permissions for service proxy access (see [RBAC Permissions](../user-guide/rbac-permissions.md)).

### Ingress (for external access)

If exposing Headlamp externally, configure an Ingress with TLS:

```yaml
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
```

## Pre-Installation Checklist

Before proceeding to installation, verify:

- [ ] Kubernetes cluster v1.24+ running
- [ ] Polaris deployed in `polaris` namespace with dashboard enabled
- [ ] Polaris dashboard service accessible via service proxy
- [ ] Headlamp v0.26+ deployed
- [ ] RBAC permissions configured (or ready to configure)
- [ ] Network connectivity between API server and Polaris dashboard
- [ ] Modern browser available

## Next Steps

Once all prerequisites are met:

1. **[Installation Guide](installation.md)** - Choose installation method and deploy the plugin
2. **[Quick Start](quick-start.md)** - Get up and running in 5 minutes
3. **[RBAC Permissions](../user-guide/rbac-permissions.md)** - Detailed RBAC configuration

## Troubleshooting

If any prerequisite check fails, see:

- **[Troubleshooting Guide](../troubleshooting/README.md)** - Common issues and solutions
- **[RBAC Issues](../troubleshooting/rbac-issues.md)** - Permission debugging
- **[Network Problems](../troubleshooting/network-problems.md)** - Connectivity issues
