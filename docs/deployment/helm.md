# Helm Deployment

Deploy the Headlamp Polaris Plugin using Helm charts.

## Overview

Helm provides the easiest way to deploy and manage the plugin in production. This guide covers:

- Helm values configuration
- Plugin Manager integration
- FluxCD HelmRelease integration
- Upgrade procedures

## Prerequisites

- Helm v3+ installed
- Kubernetes cluster access
- Headlamp Helm repository added

```bash
# Add Headlamp Helm repository
helm repo add headlamp https://headlamp-k8s.github.io/headlamp/
helm repo update
```

## Basic Helm Installation

### Minimal Configuration

```yaml
# headlamp-values.yaml
config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  enabled: true
  repositories:
    - https://artifacthub.io/packages/search?kind=4
```

```bash
# Install Headlamp
helm install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml

# Wait for deployment
kubectl -n kube-system wait --for=condition=available deployment/headlamp --timeout=300s
```

After installation, install the plugin via Headlamp UI (**Settings → Plugins → Catalog**).

## Complete Production Configuration

```yaml
# headlamp-values.yaml
replicaCount: 2

image:
  repository: ghcr.io/headlamp-k8s/headlamp
  tag: v0.39.0
  pullPolicy: IfNotPresent

config:
  baseURL: ''
  pluginsDir: /headlamp/plugins

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
    nginx.ingress.kubernetes.io/force-ssl-redirect: 'true'
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

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: headlamp
          topologyKey: kubernetes.io/hostname

# OIDC Authentication (optional)
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

Deploy:

```bash
helm upgrade --install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml \
  --wait \
  --timeout 5m
```

## Sidecar Plugin Installation Method

Alternative to Plugin Manager: use an init container to download the plugin.

```yaml
# headlamp-values.yaml
config:
  pluginsDir: /headlamp/plugins

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
```

Create the ConfigMap:

```yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: headlamp-plugin-config
  namespace: kube-system
data:
  plugin.yml: |
    - name: headlamp-polaris-plugin
      version: 0.3.5
      url: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/v0.3.10/polaris-0.3.10.tar.gz
```

Apply ConfigMap then deploy Headlamp:

```bash
kubectl apply -f headlamp-plugin-config.yaml

helm upgrade --install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml
```

## FluxCD HelmRelease Integration

For GitOps workflows with FluxCD:

### HelmRepository

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: headlamp
  namespace: flux-system
spec:
  interval: 1h
  url: https://headlamp-k8s.github.io/headlamp/
```

### HelmRelease

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
      version: 0.26.x # Use semver range
      sourceRef:
        kind: HelmRepository
        name: headlamp
        namespace: flux-system
      interval: 12h

  install:
    crds: CreateReplace
    remediation:
      retries: 3

  upgrade:
    crds: CreateReplace
    remediation:
      retries: 3

  values:
    replicaCount: 2

    config:
      pluginsDir: /headlamp/plugins

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

    resources:
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 128Mi

  # Health checks
  postRenderers:
    - kustomize:
        patches:
          - target:
              kind: Deployment
              name: headlamp
            patch: |
              - op: add
                path: /spec/template/spec/containers/0/livenessProbe
                value:
                  httpGet:
                    path: /
                    port: http
                  initialDelaySeconds: 30
                  periodSeconds: 10
```

Apply FluxCD resources:

```bash
kubectl apply -f helmrepository.yaml
kubectl apply -f helmrelease.yaml

# Watch deployment
flux get helmreleases -n kube-system --watch
```

## RBAC Configuration

After deploying Headlamp, apply RBAC for the plugin:

```bash
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

See [RBAC Permissions](../user-guide/rbac-permissions.md) for advanced RBAC configurations.

## Upgrading

### Upgrade Headlamp

```bash
# Update Helm repo
helm repo update

# Upgrade Headlamp (preserves plugin configuration)
helm upgrade headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml \
  --wait
```

### Upgrade Plugin (Plugin Manager Method)

1. Navigate to **Settings → Plugins** in Headlamp UI
2. Find "headlamp-polaris-plugin"
3. Click **Update** if new version available
4. Hard refresh browser (**Cmd+Shift+R** / **Ctrl+Shift+R**)

### Upgrade Plugin (Sidecar Method)

```bash
# Update ConfigMap with new version
kubectl -n kube-system edit configmap headlamp-plugin-config

# Update version and URL:
# version: 0.3.6
# url: https://github.com/.../v0.3.6/polaris-0.3.10.tar.gz

# Restart deployment to trigger init container
kubectl -n kube-system rollout restart deployment/headlamp
kubectl -n kube-system rollout status deployment/headlamp
```

## Troubleshooting

### Plugin Not Loading

```bash
# Check Headlamp values
helm get values headlamp -n kube-system

# Verify plugin files exist
kubectl -n kube-system exec deployment/headlamp -c headlamp -- \
  ls -la /headlamp/plugins/headlamp-polaris-plugin/

# If missing, reinstall plugin via UI or check init container logs
kubectl -n kube-system logs deployment/headlamp -c install-polaris-plugin
```

### Helm Release Stuck

```bash
# Check Helm release status
helm list -n kube-system

# If stuck, force upgrade
helm upgrade headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml \
  --force \
  --wait
```

### FluxCD Reconciliation Issues

```bash
# Check HelmRelease status
flux get helmreleases -n kube-system

# Check events
kubectl -n kube-system describe helmrelease headlamp

# Force reconciliation
flux reconcile helmrelease headlamp -n kube-system
```

## Next Steps

- **[Kubernetes Deployment](kubernetes.md)** - Raw Kubernetes manifests
- **[Production Checklist](production.md)** - Production deployment best practices
- **[Troubleshooting](../troubleshooting/README.md)** - Comprehensive troubleshooting guide

## References

- [Headlamp Helm Chart](https://github.com/headlamp-k8s/headlamp/tree/main/charts/headlamp)
- [Helm Documentation](https://helm.sh/docs/)
- [FluxCD HelmRelease](https://fluxcd.io/flux/components/helm/helmreleases/)
