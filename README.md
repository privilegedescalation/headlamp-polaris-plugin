# headlamp-polaris-plugin

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/polaris)](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)

A [Headlamp](https://headlamp.dev/) plugin that surfaces [Fairwinds Polaris](https://polaris.docs.fairwinds.com/) audit results directly in the Headlamp UI.

## What It Does

Adds a **Polaris** top-level sidebar section to Headlamp with the following views:

- **Overview** -- cluster score as a percentage (color-coded green/amber/red), check summary (pass/warning/danger/skipped counts), and cluster info (nodes, pods, namespaces, controllers)
- **Namespaces** -- table of all namespaces with per-namespace score, pass/warning/danger/skipped counts; click a namespace to drill down
- **Namespace detail** -- per-namespace score, check counts, and a resource table showing pass/warning/danger per workload
- **External link** -- quick jump to the native Polaris dashboard via the Kubernetes service proxy (from namespace detail view)

Data is fetched from the Polaris dashboard API through the Kubernetes service proxy (`/api/v1/namespaces/polaris/services/polaris-dashboard/proxy/results.json`). The plugin is read-only -- it never writes to the cluster.

Results are refreshed on a user-configurable interval (1 / 5 / 10 / 30 minutes, default 5). The setting is available in **Settings > Plugins > Polaris** and persists in the browser's localStorage.

Error states are handled explicitly: RBAC denied (403), Polaris not installed (404/503), malformed JSON, and loading.

## Prerequisites

| Requirement | Minimum version |
|-------------|----------------|
| Headlamp | v0.26+ |
| Polaris (with dashboard enabled) | Any recent release |
| Kubernetes | v1.24+ |

Polaris must be deployed in the `polaris` namespace with the dashboard component enabled (`dashboard.enabled: true` in the Helm chart, which is the default). The plugin reads from the `polaris-dashboard` ClusterIP service on port 80.

## Installing

### Option 1: Artifact Hub + Headlamp plugin manager (recommended)

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin). Configure Headlamp's `pluginsManager` in your Helm values to install it automatically:

```yaml
pluginsManager:
  sources:
    - url: https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin
```

Headlamp will fetch and install the plugin on startup.

### Option 2: Docker init container

The plugin ships as a container image at `git.farh.net/farhoodliquor/headlamp-polaris-plugin`.

Add it as an init container in your Headlamp Helm values:

```yaml
initContainers:
  - name: polaris-plugin
    image: git.farh.net/farhoodliquor/headlamp-polaris-plugin:latest
    command: ["sh", "-c", "cp -r /plugins/* /headlamp/plugins/"]
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins

volumes:
  - name: plugins
    emptyDir: {}

volumeMounts:
  - name: plugins
    mountPath: /headlamp/plugins
```

### Option 3: Manual tarball install

Download the `.tar.gz` from the [GitHub releases page](https://github.com/cpfarhood/headlamp-polaris-plugin/releases) or the [Gitea releases page](https://git.farh.net/farhoodliquor/headlamp-polaris-plugin/releases), then extract into Headlamp's plugin directory:

```bash
tar xzf headlamp-polaris-plugin-<version>.tar.gz -C /headlamp/plugins/
```

### Option 4: Build from source

```bash
npm install
npm run build
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

## Installing Dev/Preview Versions

Dev preview versions (e.g., `v0.2.0-dev.4`) are published to [GitHub Releases](https://github.com/cpfarhood/headlamp-polaris-plugin/releases) but are **not available via ArtifactHub**. These versions contain experimental features and are intended for testing.

To install a dev version, use the direct URL method:

### Sidecar container pattern (recommended)

Create a ConfigMap with the dev version URL:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: headlamp-plugin-config
  namespace: kube-system
data:
  plugin.yml: |
    plugins:
      - url: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/download/v0.2.0-dev.4/headlamp-polaris-plugin-0.2.0-dev.4.tar.gz
```

Then configure Headlamp to use a sidecar container that installs from this config:

```yaml
# In Headlamp Helm values or deployment
containers:
  - name: headlamp-plugin-installer
    image: node:lts-alpine
    command: ["/bin/sh", "-c"]
    args:
      - |
        npm install -g @kinvolk/headlamp-plugin
        headlamp-plugin install --config /config/plugin.yml
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins
      - name: plugin-config
        mountPath: /config
volumes:
  - name: plugins
    emptyDir: {}
  - name: plugin-config
    configMap:
      name: headlamp-plugin-config
```

### Manual download

Browse [GitHub Releases](https://github.com/cpfarhood/headlamp-polaris-plugin/releases), download the dev version tarball, and extract it to your Headlamp plugins directory.

**Note:** Dev versions are tagged with the `-dev.N` suffix and may introduce breaking changes or unstable features. Use stable versions for production deployments.

## RBAC / Security Setup

The plugin fetches audit data through the Kubernetes API server's **service proxy** sub-resource. The identity making the request (Headlamp's service account, or the user's own token in token-auth mode) must be granted:

| Verb | API Group | Resource | Resource Name | Namespace |
|------|-----------|----------|---------------|-----------|
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

### Minimal RBAC manifests

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
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: polaris
subjects:
  - kind: ServiceAccount
    name: headlamp              # adjust to match your Headlamp service account
    namespace: kube-system      # adjust to match the namespace Headlamp runs in
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

Apply with `kubectl apply -f polaris-rbac.yaml`.

### Token-auth mode

When Headlamp is configured for user-supplied tokens (rather than a fixed service account), **each user** must have the RoleBinding above attached to their own identity. A 403 error in the plugin means the currently logged-in user lacks this binding.

### NetworkPolicy

If the `polaris` namespace enforces network policies, ensure ingress is allowed from the Kubernetes API server (which performs the proxy hop) to `polaris-dashboard` on port 80.

### Read-only access

The plugin only performs `GET` requests through the service proxy. No `create`, `update`, `delete`, or `patch` verbs are required. Do not grant broader access than `get` on `services/proxy`.

### Audit logging

Every proxied request is recorded in Kubernetes API audit logs as a `get` on `services/proxy` in the `polaris` namespace. If the auto-refresh interval generates more audit volume than desired, increase the refresh interval in the plugin settings or adjust your audit policy.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| **403 Access Denied** | Missing RBAC binding for `services/proxy` | Apply the Role + RoleBinding from the RBAC section above |
| **404 or 503** | Polaris not installed, or dashboard disabled | Install Polaris with `dashboard.enabled: true` in the `polaris` namespace |
| **No data** | Polaris running but no workloads scanned yet | Wait for the next Polaris audit cycle or restart the Polaris pod |
| **Stale data** | Refresh interval too long | Lower the interval in **Settings > Plugins > Polaris** |

## Development

### Setup

```bash
git clone https://github.com/cpfarhood/headlamp-polaris-plugin.git
cd headlamp-polaris-plugin
npm install
```

### Run locally (hot reload)

```bash
npm start
```

This starts the Headlamp plugin dev server. Point a running Headlamp instance at the dev server to see changes live.

### Build for production

```bash
npm run build        # outputs dist/main.js
npm run package      # creates headlamp-polaris-plugin-<version>.tar.gz
```

### Type-check, lint, format, and test

```bash
npm run tsc          # type-check without emitting
npm run lint         # eslint
npm run format:check # prettier check
npm test             # vitest unit tests
```

## Project Structure

```
src/
  index.tsx                           -- Entry point. Registers sidebar entries and routes.
  api/
    polaris.ts                        -- TypeScript types (AuditData schema), usePolarisData hook,
                                         countResults utilities, refresh interval settings.
    polaris.test.ts                   -- Unit tests for utility functions (vitest).
    PolarisDataContext.tsx             -- React context provider; shared data fetch across views.
  components/
    DashboardView.tsx                 -- Overview page (score, check summary with skipped, cluster info).
    NamespacesListView.tsx            -- Namespace list with scores and links to detail views.
    NamespaceDetailView.tsx           -- Per-namespace drill-down with resource table.
    PolarisSettings.tsx               -- Plugin settings page (refresh interval selector).
vitest.config.mts                     -- Vitest configuration (jsdom environment).
```

## Data Source

The plugin fetches live audit results from the Polaris dashboard HTTP API via the Kubernetes service proxy:

```
GET /api/v1/namespaces/polaris/services/polaris-dashboard/proxy/results.json
```

This endpoint is served by the `polaris-dashboard` ClusterIP service, which is created by the Polaris Helm chart when `dashboard.enabled: true`. The JSON response matches Polaris's `AuditData` schema (`pkg/validator/output.go`):

```
AuditData
  ClusterInfo      -- nodes, pods, namespaces, controllers
  Results[]        -- per-workload results
    Results{}      -- top-level check results (ResultSet)
    PodResult
      Results{}    -- pod-level check results
      ContainerResults[]
        Results{}  -- container-level check results
```

Each check in a `ResultSet` has `Success` (bool) and `Severity` (`"warning"`, `"danger"`, or `"ignore"`). Checks with `Severity: "ignore"` and `Success: false` are counted as skipped. The cluster score is computed client-side as `pass / total * 100`.

## Known Limitations

### Skipped Count and Annotation-Based Exemptions

The **Skipped** count shown in the plugin only reflects checks with `Severity: "ignore"` in the Polaris API response. It does **not** include annotation-based exemptions (e.g., `polaris.fairwinds.com/privilegeEscalationAllowed-exempt: "true"`).

**Why?** Polaris completely omits exempted checks from the `results.json` endpoint. The native Polaris dashboard UI computes the "skipped" count client-side by:
1. Querying Kubernetes resources (Deployments, DaemonSets, StatefulSets, Pods) directly
2. Parsing their annotations for `polaris.fairwinds.com/*-exempt` keys
3. Counting how many checks were exempted

This plugin only has access to the processed audit results via the service proxy and does not query raw Kubernetes resources. To show accurate exemption counts, the plugin would need to:
- Request cluster-wide read access to all workload types (requires additional RBAC grants beyond `services/proxy`)
- Parse annotations on every workload in every namespace
- Cross-reference with the Polaris check catalog to count exemptions

This is a significant architectural change and is not currently implemented. Hover over the "Skipped" count in the UI to see a tooltip explaining this limitation.

**Workaround:** Use the "View in Polaris Dashboard" link from any namespace detail view to see the full exemption count in the native dashboard.

## Releasing

Releases are automated via CI. To cut a release:

```bash
# Bump version in package.json and artifacthub-pkg.yml (version + archive-url), then:
git add package.json artifacthub-pkg.yml
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

This triggers the **Gitea Actions** release workflow (`.gitea/workflows/release.yaml`):
1. Build the plugin in a `node:20` container
2. Package a `.tar.gz` tarball
3. Build and push a Docker image to `git.farh.net/farhoodliquor/headlamp-polaris-plugin:{tag}` and `:latest`
4. Create a Gitea release with the tarball attached
5. Create a GitHub release with the same tarball (for Artifact Hub)
6. Update `artifacthub-pkg.yml` checksum on main and force-move the tag to match

A guard step prevents infinite loops: if the release tarball checksum already matches the metadata, the build is skipped.

### CI secrets

| Secret | Where | Purpose |
|---|---|---|
| `REGISTRY_TOKEN` | Gitea | Personal access token with `package:write` scope for Docker image push |
| `GH_PAT` | Gitea | GitHub personal access token for creating GitHub releases |

The Gitea release uses the built-in `github.token`. The `archive-checksum` in `artifacthub-pkg.yml` is updated automatically by the release workflow.

## Links

- [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)
- [GitHub (mirror)](https://github.com/cpfarhood/headlamp-polaris-plugin)
- [Gitea (source of truth)](https://git.farh.net/farhoodliquor/headlamp-polaris-plugin)
- [Headlamp](https://headlamp.dev/)
- [Fairwinds Polaris](https://polaris.docs.fairwinds.com/)

## License

MIT
