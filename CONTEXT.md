# CONTEXT.md - Headlamp Polaris Plugin

**Purpose**: Comprehensive reverse prompt for AI assistants working on this project.

---

## Project Overview

The Headlamp Polaris Plugin surfaces [Fairwinds Polaris](https://www.fairwinds.com/polaris) audit results directly inside the [Headlamp](https://headlamp.dev) Kubernetes UI. It provides a read-only dashboard showing cluster-wide security, reliability, and efficiency scores derived from Polaris policy checks.

- **Stack**: React + TypeScript plugin for Headlamp (v0.26+)
- **Data Source**: Polaris dashboard API via Kubernetes service proxy (read-only)
- **Current Version**: v0.4.1
- **Key Constraint**: No direct Kubernetes resource access - all data fetched through service proxy

## Architecture & Data Flow

### Component Hierarchy

```
src/index.tsx                      # Entry point: registers routes, sidebar, settings
├── PolarisDataContext.tsx         # Shared data fetch with auto-refresh
├── components/
│   ├── DashboardView.tsx          # Overview (score, checks, top issues)
│   ├── NamespacesListView.tsx     # Namespace list with scores
│   ├── NamespaceDetailView.tsx    # Per-namespace drill-down (drawer)
│   ├── PolarisSettings.tsx        # Settings (refresh interval, URL, test)
│   ├── AppBarScoreBadge.tsx       # Cluster score badge in top nav
│   └── InlineAuditSection.tsx     # Injected into workload detail views
└── api/
    └── polaris.ts                 # Types, hooks, utilities
```

### Data Source

- **Service Proxy Path**: `/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`
- **Schema**: `AuditData` with `ClusterInfo`, `Results[]` containing nested `PodResult` and `ContainerResults`
- **Method**: `ApiProxy.request()` from Headlamp plugin SDK (handles K8s API auth automatically)

### State Management

- **Pattern**: React Context (see `src/api/PolarisDataContext.tsx`)
- **Rationale**: ADR-001 - Prevents duplicate API calls when multiple components need same data
- **Auto-refresh**: User-configurable interval (1/5/10/30 min, default 5 min)
- **Storage**: Refresh interval and dashboard URL stored in `localStorage`

### Score Computation

```typescript
// Formula: (pass / total) * 100, rounded to nearest integer
function computeScore(counts: ResultCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.pass / counts.total) * 100);
}
```

## Technology Constraints

### ⚠️ CRITICAL: Headlamp Components Only

**MUST** use `@kinvolk/headlamp-plugin/lib/CommonComponents`
**NEVER** import from `@mui/material` or `@mui/icons-material`

**Why**: Historical issue (v0.3.2) - MUI imports caused plugin load failures. Headlamp provides all needed components as re-exports.

```typescript
// ✅ Correct
import { SectionBox, StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';

// ❌ Wrong - will break plugin
import { Box, Chip } from '@mui/material';
```

### Other Constraints

- **TypeScript Strictness**: No `any`, explicit types, strict mode enabled
- **Packaging**: `@kinvolk/headlamp-plugin` is peer dependency - don't bundle React/MUI
- **Theme Handling**: Use CSS variables (`--mui-palette-*`), not theme imports
- **Sidebar Limitation**: Headlamp only supports 2-level nesting (parent → children)

## Component Patterns & Gotchas

### Headlamp Component Issues

1. **StatusLabel with empty status**
   ```typescript
   // ❌ Renders near-invisible (muted background)
   <StatusLabel status="">{value}</StatusLabel>

   // ✅ Use plain String() for neutral values
   <span>{String(value)}</span>
   ```

2. **Link component crashes on plugin routes**
   ```typescript
   // ❌ Headlamp Link crashes on plugin-registered routes
   import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';

   // ✅ Use react-router-dom Link with Router.createRouteURL
   import { Link } from 'react-router-dom';
   import { Router } from '@kinvolk/headlamp-plugin/lib';

   <Link to={Router.createRouteURL('/polaris/namespaces')}>View</Link>
   ```

3. **Visual components that work well**
   - `PercentageCircle` - Great for score display
   - `PercentageBar` - Great for check distribution
   - `SimpleTable` - Fast, clean tables
   - `NameValueTable` - Key-value pairs
   - `SectionBox` - Card containers with titles

### Code Conventions

- **Functional Components**: Always use function components with hooks
- **Named Exports**: Prefer named exports over default exports
- **Props Interfaces**: Define as TypeScript interfaces, not inline types
- **Import Order**: React → third-party → Headlamp → local (auto-sorted by eslint)

## RBAC & Security

### Minimal Permission Required

The plugin requires **only** this RBAC permission:

| Verb | API Group | Resource | Resource Name | Namespace |
|------|-----------|----------|---------------|-----------|
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

### Example Role

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
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

### Security Notes

- **Namespaced Role**: MUST be namespaced Role, NOT ClusterRole
- **ResourceNames Required**: Always specify `resourceNames: ["polaris-dashboard"]`
- **No Write Operations**: Plugin only performs GET, never create/update/delete
- **Token-Auth Mode**: When Headlamp uses user tokens, each user needs the RoleBinding
- **Network Policy**: If enforced, allow API server → `polaris-dashboard:80` ingress
- **Audit Logging**: Every proxy request logged as K8s API audit event

## Development Workflow

### Commands

```bash
# Install dependencies
npm install

# Start development mode (hot reload at localhost:4466)
npm start

# Build plugin
npm run build

# Create tarball for distribution
npm run package

# Type-check without emitting
npm run tsc

# Lint
npm run lint

# Run unit tests
npm test

# Run E2E tests (requires cluster access)
npm run e2e

# Format code
npm run format

# Check formatting (CI)
npm run format:check
```

### Branching Strategy

- ✅ **ALWAYS use feature branches** for code changes (`feat/*`, `fix/*`, `docs/*`)
- ✅ **MAY push directly to main** for: documentation-only changes, version bump commits
- ❌ **NEVER push code changes directly to main**

### Commit Convention

Use Conventional Commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `chore:` - Maintenance (deps, config)
- `test:` - Test changes
- `ci:` - CI/CD changes

### PR Process

All PRs must pass:
1. Build (`npm run build`)
2. Lint (`npm run lint`)
3. Type-check (`npm run tsc`)
4. Unit tests (`npm test`)
5. Format check (`npm run format:check`)

**Before committing**: Always run `npx prettier --write src/`

## Testing Strategy

### Unit Tests (Vitest)

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

- **Framework**: Vitest with jsdom environment
- **Test files**: `*.test.ts`, `*.test.tsx` in `src/`
- **Setup**: `vitest.setup.ts` with `@testing-library/jest-dom`
- **Coverage**: Focus on meaningful tests, not just numbers
- **Test utilities**: `src/test-utils.tsx` provides test wrapper with context

### E2E Tests (Playwright)

```bash
npm run e2e           # Headless
npm run e2e:headed    # With browser UI
```

- **Framework**: Playwright
- **Test files**: `e2e/*.spec.ts`
  - `polaris.spec.ts` - Sidebar, overview, namespaces, detail drawer
  - `settings.spec.ts` - Plugin settings page
  - `appbar.spec.ts` - App bar score badge
- **Auth**: Supports both OIDC (Authentik) and token-based auth (see `e2e/auth.setup.ts`)
- **CI**: Runs on GitHub Actions with `k3s-animaniacs` runner

### Local E2E Setup

```bash
# Token-based auth
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system --duration=24h)
npm run e2e

# OIDC auth (Authentik)
export AUTHENTIK_USERNAME=your-username
export AUTHENTIK_PASSWORD=your-password
npm run e2e
```

## CI/CD & Release

### CI Workflow (`.github/workflows/ci.yaml`)

Runs on push to main and all PRs:
1. Checkout
2. `npm ci`
3. `npm run build`
4. `npm run lint`
5. `npm run tsc`
6. `npm run format:check`
7. `npm test`

Runner: `local-ubuntu-latest`

### E2E Workflow (`.github/workflows/e2e.yaml`)

Runs on push, PR, and manual trigger:
1. Checkout
2. `npm ci`
3. `npm run e2e`

Runner: `k3s-animaniacs` (has cluster access)
Requires: `HEADLAMP_URL`, `HEADLAMP_TOKEN` or `AUTHENTIK_USERNAME`/`AUTHENTIK_PASSWORD`

### Release Workflow (`.github/workflows/release.yaml`)

**Manual trigger** via workflow_dispatch with version input:

```bash
# Via GitHub UI or CLI
gh workflow run release.yaml -f version=0.4.2
```

Steps:
1. Validate version format (semver)
2. Bump `package.json` + `artifacthub-pkg.yml`
3. Build plugin
4. Package tarball
5. Compute SHA256 checksum
6. Commit version bump
7. Create git tag
8. Create GitHub release
9. Upload tarball to release

**Guard**: Skips if checksum already matches (prevents infinite loop)

**Post-release**: ArtifactHub pulls metadata every 30 min (no webhook, pull-based)

### Version Bump Requirements

**ALWAYS bump both files in the same commit**:
- `package.json` - `version` field
- `artifacthub-pkg.yml` - `version` field + `digest` (checksum) + `archive.url`

## Known Issues & Workarounds

### ⚠️ Headlamp v0.39.0 Known Issues

**AutoSizer JavaScript Error**
- **Symptom**: Console shows `TypeError: undefined is not an object (evaluating 'io.AutoSizer')`
- **Impact**: Cosmetic error in Settings page, doesn't break functionality
- **Root Cause**: Headlamp core bug, not plugin-related
- **Workaround**: None needed, can be ignored

**Plugin Loading (RESOLVED)**
- **Old Issue**: Previously thought `config.watchPlugins: false` was required
- **Resolution**: Plugins load correctly with default `watchPlugins: true`
- **Note**: If you see old docs mentioning `watchPlugins: false`, ignore them

### Polaris Dashboard Behavior

**Stale Audit Data**
- **Symptom**: Plugin shows old audit timestamp
- **Root Cause**: Polaris dashboard runs audit once at pod startup, then caches results
- **Does NOT**: Continuously re-audit in real-time
- **Workaround**: Restart Polaris pods for fresh data
  ```bash
  kubectl rollout restart deployment -n polaris polaris-dashboard
  ```
- **Load Balancing**: Service balances across multiple pods - each may have different audit timestamps
- **Plugin Auto-Refresh**: Works correctly - just fetches whatever Polaris currently has cached

### Skipped Count Limitation

**What It Shows**:
- Only checks with `Severity: "ignore"` in Polaris API response
- Does NOT include annotation-based exemptions (`polaris.fairwinds.com/*-exempt`)

**Why**:
- Polaris omits exempted checks from `results.json`
- Plugin has no access to raw K8s resources to compute exemptions
- By design: service proxy limitation

**Workaround**:
- Link to native Polaris dashboard for full exemption count
- UI tooltip explains this limitation

## Deployment Patterns

### Plugin Manager (Recommended)

Install via Headlamp UI (Settings → Plugins → Catalog) or Helm values:

```yaml
pluginsManager:
  enabled: true
  configContent: |
    plugins:
      - name: polaris
        source: https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin
```

### Sidecar Container (Alternative)

```yaml
spec:
  containers:
    - name: headlamp
      # ... main container
    - name: headlamp-plugin
      image: node:lts-alpine
      command:
        - /bin/sh
        - -c
        - |
          npx @headlamp-k8s/pluginctl@latest install \
            --config /config/plugin.yml \
            --folderName /headlamp/plugins \
            --watch
      volumeMounts:
        - name: plugins-dir
          mountPath: /headlamp/plugins
        - name: plugin-config
          mountPath: /config
  volumes:
    - name: plugins-dir
      emptyDir: {}
    - name: plugin-config
      configMap:
        name: headlamp-plugin-config
```

### Manual Tarball

```bash
# Download release
wget https://github.com/cpfarhood/headlamp-polaris-plugin/releases/download/v0.4.1/headlamp-polaris-plugin-0.4.1.tgz

# Extract to plugin directory
tar -xzf headlamp-polaris-plugin-0.4.1.tgz -C /headlamp/plugins/

# Restart Headlamp
kubectl rollout restart deployment headlamp -n kube-system
```

## Project Files Reference

```
src/
  index.tsx                    # Entry point: registers sidebar, routes, settings, etc.
  api/
    polaris.ts                 # Core types, usePolarisData hook, utilities
    PolarisDataContext.tsx      # React Context provider for shared data
  components/
    DashboardView.tsx          # Overview page (score, checks, top issues)
    NamespacesListView.tsx     # Namespace table with scores
    NamespaceDetailView.tsx    # Drawer panel with per-namespace drill-down
    PolarisSettings.tsx        # Settings page (refresh, URL, test)
    AppBarScoreBadge.tsx       # Cluster score chip in top nav bar
    InlineAuditSection.tsx     # Injected into resource detail views
  test-utils.tsx               # Test helpers (wrapper with context)

.github/workflows/
  ci.yaml                      # Lint, type-check, build, test
  e2e.yaml                     # Playwright E2E tests
  release.yaml                 # Automated releases

e2e/                           # Playwright tests
  polaris.spec.ts              # Main plugin functionality
  settings.spec.ts             # Settings page
  appbar.spec.ts               # App bar badge
  auth.setup.ts                # OIDC/token auth setup

docs/                          # Comprehensive documentation
  architecture/                # Overview, design decisions, ADRs
  deployment/                  # Helm, Kubernetes, production guides
  troubleshooting/             # Common issues, RBAC, network problems
  getting-started/             # Quick start, prerequisites, installation

package.json                   # Version, scripts, dependencies
artifacthub-pkg.yml            # ArtifactHub metadata (version, checksum)
tsconfig.json                  # Extends @kinvolk/headlamp-plugin config
vitest.config.mts              # Vitest config (jsdom, excludes e2e/)
.eslintrc.js                   # Extends @headlamp-k8s/eslint-config
.prettierrc.js                 # Uses @headlamp-k8s prettier config
```

## MCP Servers (Claude Code)

- **GitHub**: Source control (`github-mcp-server`), repo at `cpfarhood/headlamp-polaris-plugin`
- **Kubernetes (local)**: Cluster access via `kubernetes-mcp-server`
- **Flux (local)**: Flux Operator access via `flux-operator-mcp`
- **Playwright**: Browser automation via `@playwright/mcp`

## Common Tasks Quick Reference

```bash
# Start development
npm install && npm start

# Run all checks before PR
npm run build && npm run lint && npm run tsc && npm test && npm run format

# Create release (maintainers only)
# 1. Edit CHANGELOG.md
# 2. Trigger release workflow:
gh workflow run release.yaml -f version=0.4.2

# Run E2E tests locally
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system --duration=24h)
npm run e2e

# Fix formatting issues
npx prettier --write src/

# Check Polaris audit freshness
kubectl get --raw "/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json" | jq -r '.AuditTime'

# Restart Polaris for fresh audit
kubectl rollout restart deployment -n polaris polaris-dashboard
```

## Anti-Patterns (What NOT to Do)

- ❌ Import from `@mui/material` or `@mui/icons-material` → breaks plugin
- ❌ Use `any` type → strict TypeScript required
- ❌ Push code changes directly to main → always use feature branches
- ❌ Grant broader RBAC than `get services/proxy` → security risk
- ❌ Use ClusterRole instead of namespaced Role → violates least privilege
- ❌ Forget to run `npx prettier --write src/` → CI will fail
- ❌ Use inline styles without CSS variables → breaks dark mode
- ❌ Try to query K8s resources directly → plugin only has service proxy access
- ❌ Import Headlamp `Link` for plugin routes → use react-router-dom `Link` + `Router.createRouteURL()`
- ❌ Assume Polaris continuously re-audits → it only audits at pod startup

## Quick Diagnosis Guide

```
Symptom: Plugin not in sidebar
→ Check: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
→ Check: Plugin installed? kubectl get configmap headlamp-plugin-config -n kube-system

Symptom: 403 Access Denied
→ Check: RBAC binding exists? kubectl get role,rolebinding -n polaris
→ Fix: Apply RBAC example from docs/deployment/rbac.md

Symptom: 404 or 503
→ Check: Polaris installed? kubectl get pods -n polaris
→ Check: Service exists? kubectl get svc polaris-dashboard -n polaris

Symptom: Stale audit data
→ Fix: kubectl rollout restart deployment -n polaris polaris-dashboard
→ Verify: Check AuditTime in UI matches current date

Symptom: Settings page empty or broken
→ Check: Plugin version ≥ v0.3.3?
→ Fix: Upgrade plugin and hard refresh browser

Symptom: CI prettier check fails
→ Fix: npx prettier --write src/
→ Commit: Include formatting fixes in your PR

Symptom: Dark mode white backgrounds
→ Check: Plugin version ≥ v0.3.5?
→ Fix: Upgrade and hard refresh browser
```

## Historical Context

### Why Service Proxy Instead of ConfigMaps?

Early versions (< v0.0.10) incorrectly documented ConfigMap RBAC. The plugin **never** accessed ConfigMaps - it always used the service proxy. This was clarified in v0.0.10.

### Why No MUI Imports?

v0.3.2 removed direct MUI imports because they caused plugin load failures. Headlamp provides all needed MUI components as re-exports through `CommonComponents`.

### Why React Context?

ADR-001 documents the switch to React Context. Before v0.3.0, each component called `usePolarisData()` independently, causing duplicate API requests. Context ensures a single shared fetch.

### Why No Continuous Polaris Audits?

Polaris dashboard mode runs a one-time audit at pod startup and caches results. This is by design in Polaris itself. For continuous auditing, Polaris would need to be configured in webhook mode (admission controller), which is a different deployment pattern.

---

**Last Updated**: 2026-02-12
**Version**: v0.4.1
**Target Headlamp**: v0.26+
**Target Polaris**: v9.x
