# Headlamp Polaris Plugin

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/polaris)](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)
[![CI](https://github.com/cpfarhood/headlamp-polaris-plugin/actions/workflows/ci.yaml/badge.svg)](https://github.com/cpfarhood/headlamp-polaris-plugin/actions/workflows/ci.yaml)
[![E2E Tests](https://github.com/cpfarhood/headlamp-polaris-plugin/actions/workflows/e2e.yaml/badge.svg)](https://github.com/cpfarhood/headlamp-polaris-plugin/actions/workflows/e2e.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Headlamp](https://headlamp.dev/) plugin that surfaces [Fairwinds Polaris](https://polaris.docs.fairwinds.com/) audit results directly in the Headlamp UI.

**📚 [Documentation](#documentation) | 🚀 [Installation](#installing) | 🔒 [Security](#rbac--security-setup) | 🛠️ [Development](#development)**

## What It Does

Adds a **Polaris** top-level sidebar section to Headlamp with comprehensive security, reliability, and efficiency audit integration:

### Main Views

- **Overview Dashboard** -- cluster score with percentage gauge, check distribution charts, top 10 most common failing checks across the cluster, cluster statistics, and last audit time with manual refresh button
- **Namespaces** -- table of all namespaces with per-namespace score and check counts; click a namespace to open a detailed side panel (1000px wide, theme-aware)
- **Namespace Detail Panel** -- per-namespace score, check counts, resource-level audit results, external Polaris dashboard link, and exemption management

### Integrated Features

- **App Bar Score Badge** -- cluster Polaris score displayed as a colored chip in the top navigation bar (green ≥80%, yellow ≥50%, red <50%); click to navigate to overview
- **Inline Resource Audits** -- Polaris audit results automatically injected into detail views for Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs; shows compact score, failing checks table, and link to full report
- **Exemption Management** -- add or remove Polaris exemptions via annotation patches directly from the UI; supports per-check exemptions or exempt-all
- **Configurable Dashboard URL** -- supports both Kubernetes service proxy URLs and full HTTP/HTTPS URLs for external Polaris deployments
- **Connection Testing** -- test button in settings to verify Polaris dashboard connectivity and show version info
- **Dark Mode Support** -- full theme adaptation using MUI CSS variables; drawer, settings, and all UI elements respect system/Headlamp theme

### Data & Refresh

Data is fetched from the Polaris dashboard API through the Kubernetes service proxy (`/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`) or custom URLs. The plugin is primarily read-only; it only writes when explicitly applying exemption annotations.

Results are refreshed on a user-configurable interval (1 / 5 / 10 / 30 minutes, default 5). Settings are available in **Settings > Plugins > Polaris** and persist in browser localStorage.

Error states are handled explicitly with context-specific messages: RBAC denied (403), Polaris not installed (404/503), malformed JSON, network failures, and CORS issues.

## Prerequisites

| Requirement                      | Minimum version    |
| -------------------------------- | ------------------ |
| Headlamp                         | v0.26+             |
| Polaris (with dashboard enabled) | Any recent release |
| Kubernetes                       | v1.24+             |

Polaris must be deployed in the `polaris` namespace with the dashboard component enabled (`dashboard.enabled: true` in the Helm chart, which is the default). The plugin reads from the `polaris-dashboard` ClusterIP service on port 80.

## Installing

### Option 1: Headlamp Plugin Manager (Recommended)

**⚠️ CRITICAL for Headlamp v0.39.0+:** You **must** set `config.watchPlugins: false` or the plugin will not load. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#critical-headlamp-v0390-configuration) for details.

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin). Configure Headlamp via Helm:

```yaml
config:
  pluginsDir: /headlamp/plugins
  watchPlugins: false # CRITICAL for v0.39.0+

pluginsManager:
  sources:
    - name: headlamp-polaris-plugin
      url: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/download/v0.3.5/headlamp-polaris-plugin-0.3.5.tar.gz
```

Or install via the Headlamp UI:

1. Go to **Settings → Plugins**
2. Click **Catalog** tab
3. Search for "Polaris"
4. Click **Install**

### Option 2: Sidecar Container (Alternative)

For detailed sidecar installation instructions, see [docs/DEPLOYMENT.md#installation-method-2-sidecar-container](docs/DEPLOYMENT.md#installation-method-2-sidecar-container).

```yaml
sidecars:
  - name: headlamp-plugin
    image: node:lts-alpine
    command: ['/bin/sh']
    args:
      - -c
      - |
        npm install -g @kinvolk/headlamp-plugin
        headlamp-plugin install --config /config/plugin.yml
        tail -f /dev/null
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins
      - name: plugin-config
        mountPath: /config
```

### Option 3: Manual Tarball Install

Download the `.tar.gz` from the [GitHub releases page](https://github.com/cpfarhood/headlamp-polaris-plugin/releases), then extract into Headlamp's plugin directory:

```bash
wget https://github.com/cpfarhood/headlamp-polaris-plugin/releases/download/v0.3.5/headlamp-polaris-plugin-0.3.5.tar.gz
tar xzf headlamp-polaris-plugin-0.3.5.tar.gz -C /headlamp/plugins/
```

### Option 4: Build from Source

```bash
git clone https://github.com/cpfarhood/headlamp-polaris-plugin.git
cd headlamp-polaris-plugin
npm install
npm run build
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

For complete installation instructions including Helm integration, FluxCD examples, and production deployment checklist, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## RBAC / Security Setup

The plugin fetches audit data through the Kubernetes API server's **service proxy** sub-resource. The identity making the request (Headlamp's service account, or the user's own token in token-auth mode) must be granted:

| Verb  | API Group   | Resource         | Resource Name       | Namespace |
| ----- | ----------- | ---------------- | ------------------- | --------- |
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

### Minimal RBAC manifests

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: polaris
rules:
  - apiGroups: ['']
    resources: ['services/proxy']
    resourceNames: ['polaris-dashboard']
    verbs: ['get']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: polaris
subjects:
  - kind: ServiceAccount
    name: headlamp # adjust to match your Headlamp service account
    namespace: kube-system # adjust to match the namespace Headlamp runs in
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

## Documentation

Comprehensive documentation is available in the `docs/` directory:

| Document                                          | Description                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**       | System architecture, data flow, component hierarchy, design decisions |
| **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**           | Complete deployment guide with Helm, FluxCD, RBAC, network policies   |
| **[SECURITY.md](SECURITY.md)**                    | Security model, RBAC requirements, vulnerability reporting            |
| **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Common issues, debugging, RBAC testing, network debugging             |
| **[TESTING.md](docs/TESTING.md)**                 | Unit tests, E2E tests, CI/CD, best practices                          |
| **[CONTRIBUTING.md](CONTRIBUTING.md)**            | Development workflow, branching strategy, PR process                  |
| **[CHANGELOG.md](CHANGELOG.md)**                  | Complete release history (v0.0.1 to current)                          |

## Troubleshooting

**For comprehensive troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).**

Quick reference:

| Symptom                         | Likely Cause                                 | Quick Fix                                                             |
| ------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| **Plugin not in sidebar**       | Headlamp v0.39.0+ plugin loading issue       | Set `config.watchPlugins: false` and hard refresh (Cmd+Shift+R)       |
| **403 Access Denied**           | Missing RBAC binding for `services/proxy`    | Apply Role + RoleBinding from RBAC section                            |
| **404 or 503**                  | Polaris not installed, or dashboard disabled | Install Polaris with `dashboard.enabled: true` in `polaris` namespace |
| **Dark mode white backgrounds** | Old plugin version                           | Upgrade to v0.3.5+ and hard refresh browser                           |
| **Settings page empty**         | Old plugin version                           | Upgrade to v0.3.3+                                                    |
| **No data / infinite spinner**  | Network policy or Polaris pod down           | Check network policies and `kubectl get pods -n polaris`              |

## Development

**For detailed development guide, see [CONTRIBUTING.md](CONTRIBUTING.md).**

### Quick Start

```bash
# Clone repository
git clone https://github.com/cpfarhood/headlamp-polaris-plugin.git
cd headlamp-polaris-plugin

# Install dependencies
npm install

# Run with hot reload
npm start  # Opens Headlamp at http://localhost:4466

# Build for production
npm run build        # outputs dist/main.js
npm run package      # creates headlamp-polaris-plugin-<version>.tar.gz

# Run tests
npm test             # unit tests
npm run e2e          # E2E tests (requires Headlamp instance)

# Code quality
npm run lint         # eslint
npm run tsc          # type-check
npm run format       # prettier format
```

### Running Tests

```bash
# Unit tests (Vitest)
npm test
npm run test:watch

# E2E tests (Playwright)
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system --duration=24h)
npm run e2e
npm run e2e:headed   # see browser
```

For complete testing guide including CI/CD integration, see **[docs/TESTING.md](docs/TESTING.md)**.

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

Releases are automated via **GitHub Actions**. To cut a release:

```bash
# 1. Update CHANGELOG.md with new version
# 2. Bump version in package.json and artifacthub-pkg.yml:
git add package.json artifacthub-pkg.yml CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin main

# 3. Create and push tag:
git tag vX.Y.Z
git push origin vX.Y.Z
```

This triggers the **GitHub Actions** release workflow (`.github/workflows/release.yaml`):

1. Build the plugin in a `node:20` container
2. Package a `.tar.gz` tarball
3. Create a GitHub release with the tarball attached
4. Calculate SHA256 checksum
5. Update `artifacthub-pkg.yml` checksum on main branch
6. Force-move the tag to include checksum update

A guard step prevents infinite loops: if the release tarball checksum already matches the metadata, the workflow is skipped.

### ArtifactHub Sync

ArtifactHub pulls plugin metadata from GitHub every **30 minutes**. After creating a release:

- Wait 30 minutes for sync
- Check [ArtifactHub package page](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)
- New version should appear in Headlamp plugin catalog

For complete release process and version numbering guidelines, see **[CONTRIBUTING.md#release-process](CONTRIBUTING.md#release-process)**.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Branching strategy (feature branches required for code changes)
- Commit message conventions (Conventional Commits)
- PR process and review checklist
- Code style guidelines
- Testing requirements

## Links

- **[GitHub Repository](https://github.com/cpfarhood/headlamp-polaris-plugin)** - Source code, issues, releases
- **[Artifact Hub](https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin)** - Plugin catalog listing
- **[Headlamp](https://headlamp.dev/)** - Kubernetes web UI
- **[Fairwinds Polaris](https://polaris.docs.fairwinds.com/)** - Kubernetes best practices audit tool

## License

[MIT License](LICENSE) - see LICENSE file for details.

---

**Made with ❤️ for the Kubernetes community**
