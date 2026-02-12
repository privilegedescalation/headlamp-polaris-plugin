# Kubernetes Deployment

Direct Kubernetes manifest deployment for the Headlamp Polaris Plugin.

## Overview

This guide covers deploying the plugin using raw Kubernetes manifests without Helm. This approach is useful for:

- Environments where Helm is not available
- Highly customized deployments
- GitOps workflows with Kustomize
- Learning the underlying Kubernetes resources

## RBAC Manifests

The plugin requires read-only access to the Polaris dashboard service proxy.

### Complete RBAC Configuration

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

Apply the RBAC manifests:

```bash
kubectl apply -f polaris-plugin-rbac.yaml
```

### RBAC Verification

```bash
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

## Plugin Installation via Init Container

Use an init container to download and install the plugin.

### ConfigMap for Plugin Configuration

```yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: headlamp-plugin-config
  namespace: kube-system
  labels:
    app.kubernetes.io/name: headlamp
    app.kubernetes.io/component: plugin-config
data:
  plugin.yml: |
    - name: headlamp-polaris-plugin
      version: 0.3.5
      url: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v0.3.10/polaris-0.3.10.tar.gz
```

### Headlamp Deployment with Plugin Init Container

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: headlamp
  namespace: kube-system
  labels:
    app.kubernetes.io/name: headlamp
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: headlamp
  template:
    metadata:
      labels:
        app.kubernetes.io/name: headlamp
    spec:
      serviceAccountName: headlamp

      # Init container to install plugins
      initContainers:
        - name: install-plugins
          image: node:lts-alpine
          command:
            - sh
            - -c
            - |
              npm install -g @kinvolk/headlamp-plugin
              headlamp-plugin install --config /config/plugin.yml --plugins-dir /plugins
              echo "Plugin installation complete"
          volumeMounts:
            - name: plugins
              mountPath: /plugins
            - name: plugin-config
              mountPath: /config

      containers:
        - name: headlamp
          image: ghcr.io/headlamp-k8s/headlamp:v0.39.0
          args:
            - "-in-cluster"
            - "-plugins-dir=/headlamp/plugins"
          env:
            - name: HEADLAMP_CONFIG_WATCH_PLUGINS
              value: "false"  # CRITICAL: Must be false for plugin manager
          ports:
            - name: http
              containerPort: 4466
              protocol: TCP
          volumeMounts:
            - name: plugins
              mountPath: /headlamp/plugins
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
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi

      volumes:
        - name: plugins
          emptyDir: {}
        - name: plugin-config
          configMap:
            name: headlamp-plugin-config
```

### Supporting Resources

```yaml
---
# ServiceAccount for Headlamp
apiVersion: v1
kind: ServiceAccount
metadata:
  name: headlamp
  namespace: kube-system
  labels:
    app.kubernetes.io/name: headlamp

---
# Service for Headlamp
apiVersion: v1
kind: Service
metadata:
  name: headlamp
  namespace: kube-system
  labels:
    app.kubernetes.io/name: headlamp
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: headlamp
```

## Complete Deployment Workflow

### 1. Apply All Manifests

```bash
# Create RBAC for Polaris plugin
kubectl apply -f polaris-plugin-rbac.yaml

# Create plugin configuration
kubectl apply -f headlamp-plugin-config.yaml

# Deploy Headlamp with plugin init container
kubectl apply -f headlamp-deployment.yaml
kubectl apply -f headlamp-service.yaml
kubectl apply -f headlamp-serviceaccount.yaml

# Wait for deployment to be ready
kubectl -n kube-system wait --for=condition=available deployment/headlamp --timeout=300s
```

### 2. Verify Deployment

```bash
# Check pods are running
kubectl -n kube-system get pods -l app.kubernetes.io/name=headlamp

# Expected output:
# NAME                        READY   STATUS    RESTARTS   AGE
# headlamp-xxxxxxxxxx-xxxxx   1/1     Running   0          2m

# Check init container logs
kubectl -n kube-system logs deployment/headlamp -c install-plugins

# Expected output:
# Plugin installation complete

# Verify plugin files exist
kubectl -n kube-system exec deployment/headlamp -c headlamp -- \
  ls -la /headlamp/plugins/headlamp-polaris-plugin/

# Expected output:
# drwxr-xr-x  dist/
# -rw-r--r--  package.json

# Test Polaris API access
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json \
  | jq .PolarisOutputVersion

# Expected output: "1.0" or similar
```

### 3. Access Headlamp

```bash
# Port-forward to access locally
kubectl -n kube-system port-forward service/headlamp 8080:80

# Open browser to http://localhost:8080
```

## Kustomize Integration

For GitOps workflows with Kustomize:

### Directory Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── rbac.yaml
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── serviceaccount.yaml
└── overlays/
    ├── production/
    │   ├── kustomization.yaml
    │   └── patches.yaml
    └── staging/
        ├── kustomization.yaml
        └── patches.yaml
```

### Base Kustomization

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: kube-system

commonLabels:
  app.kubernetes.io/name: headlamp
  app.kubernetes.io/managed-by: kustomize

resources:
  - serviceaccount.yaml
  - service.yaml
  - deployment.yaml
  - configmap.yaml
  - rbac.yaml

configMapGenerator:
  - name: headlamp-plugin-config
    files:
      - plugin.yml
```

### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

nameSuffix: -prod

replicas:
  - name: headlamp
    count: 2

patches:
  - path: patches.yaml
```

```yaml
# k8s/overlays/production/patches.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: headlamp
spec:
  template:
    spec:
      containers:
        - name: headlamp
          resources:
            limits:
              cpu: 1000m
              memory: 1Gi
            requests:
              cpu: 200m
              memory: 256Mi
```

### Deploy with Kustomize

```bash
# Build and preview
kubectl kustomize k8s/overlays/production

# Apply
kubectl apply -k k8s/overlays/production
```

## FluxCD Integration

For GitOps with FluxCD:

```yaml
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: headlamp-polaris-plugin
  namespace: flux-system
spec:
  interval: 10m
  path: ./k8s/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: infrastructure
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: headlamp
      namespace: kube-system
```

## Upgrading the Plugin

### Update ConfigMap

```bash
# Edit ConfigMap with new version
kubectl -n kube-system edit configmap headlamp-plugin-config

# Update version and URL:
# version: 0.3.6
# url: https://github.com/.../v0.3.6/polaris-0.3.10.tar.gz

# Restart deployment to trigger init container
kubectl -n kube-system rollout restart deployment/headlamp

# Wait for rollout to complete
kubectl -n kube-system rollout status deployment/headlamp
```

### Verify Upgrade

```bash
# Check init container logs
kubectl -n kube-system logs deployment/headlamp -c install-plugins

# Verify new version in UI
# Navigate to Settings → Plugins in Headlamp
```

## Troubleshooting

### Init Container Fails

```bash
# Check init container logs
kubectl -n kube-system logs deployment/headlamp -c install-plugins

# Common issues:
# 1. Network connectivity to GitHub
# 2. Invalid URL in ConfigMap
# 3. Tarball checksum mismatch
```

### Plugin Not Loading

```bash
# Verify HEADLAMP_CONFIG_WATCH_PLUGINS is false
kubectl -n kube-system get deployment headlamp -o yaml | grep WATCH_PLUGINS

# Expected output:
# - name: HEADLAMP_CONFIG_WATCH_PLUGINS
#   value: "false"

# If not set or "true", update deployment
kubectl -n kube-system edit deployment headlamp
```

### RBAC Permissions Denied

```bash
# Test RBAC
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# If "no", verify RBAC manifests applied:
kubectl -n polaris get role polaris-proxy-reader
kubectl -n polaris get rolebinding headlamp-polaris-proxy
```

## Next Steps

- **[Helm Deployment](helm.md)** - Deploy with Helm for easier management
- **[Production Checklist](production.md)** - Production deployment best practices
- **[Troubleshooting](../troubleshooting/README.md)** - Comprehensive troubleshooting guide

## References

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Kustomize Documentation](https://kustomize.io/)
- [FluxCD Kustomization](https://fluxcd.io/flux/components/kustomize/kustomization/)
