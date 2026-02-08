# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Headlamp plugin that surfaces Fairwinds Polaris audit results inside the Headlamp UI. Queries the Polaris dashboard API via the Kubernetes service proxy (`/api/v1/namespaces/polaris/services/polaris-dashboard/proxy/results.json`). Target Headlamp ≥ v0.26.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build the plugin (standard Headlamp plugin build)
npx @kinvolk/headlamp-plugin build

# Start development mode with hot reload
npx @kinvolk/headlamp-plugin start

# Type-check without emitting
npx tsc --noEmit

# Lint
npx eslint src/

# Run tests
npm test
```

## Architecture

```
src/
├── index.tsx                           # Entry point: registers sidebar entries + routes
├── api/
│   ├── polaris.ts                      # Types (AuditData schema), usePolarisData hook, countResults utilities, refresh settings
│   ├── polaris.test.ts                 # Unit tests for utility functions (vitest)
│   └── PolarisDataContext.tsx           # React context provider for shared data fetch
└── components/
    ├── DashboardView.tsx                # Overview page (score, check summary with skipped count, cluster info)
    ├── NamespacesListView.tsx           # Namespace list with scores and links to detail views
    ├── NamespaceDetailView.tsx          # Per-namespace drill-down with resource table
    └── PolarisSettings.tsx              # Plugin settings (refresh interval selector)
```

Top-level sidebar section at `/polaris` with sub-routes for namespaces list (`/polaris/namespaces`) and per-namespace views (`/polaris/ns/:namespace`). Data is fetched via `ApiProxy.request` to the Polaris dashboard service proxy and refreshed on a user-configurable interval (stored in localStorage under `polaris-plugin-refresh-interval`, default 5 minutes). Score is computed from result counts (pass/total). Skipped checks are always displayed in summaries.

**Sidebar limitation**: Headlamp's sidebar only supports 2-level nesting (parent → children). The `Collapse` component is driven by route-based selection, not click-to-toggle, so 3-level hierarchies don't expand properly. Namespace navigation is handled via the in-content table on the Namespaces page instead.

## Security / RBAC Requirements

The plugin reaches Polaris through the Kubernetes API server's service proxy sub-resource (`/api/v1/namespaces/polaris/services/polaris-dashboard/proxy/...`). The Headlamp service account (or the user's bearer token when Headlamp runs in token-auth mode) must be granted:

| Verb | API Group | Resource | Resource Name | Namespace |
|------|-----------|----------|---------------|-----------|
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

Minimal RBAC example:

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
    name: headlamp            # adjust to match your Headlamp SA
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
```

Additional considerations:

- **NetworkPolicy**: If the `polaris` namespace enforces network policies, allow ingress from the Headlamp pod (or the API server, since it performs the proxy hop) to `polaris-dashboard` on port 80.
- **Polaris dashboard listen address**: The Polaris Helm chart exposes the dashboard on a ClusterIP service (`polaris-dashboard:80`). If the chart is installed with `dashboard.enabled: false`, the service will not be created, resulting in a 404 error for proxy requests.
- **No write operations**: The plugin only performs `GET` requests through the proxy. No `create`, `update`, or `delete` verbs are required. Do not grant broader service proxy access than `get`.
- **Token-auth mode**: When Headlamp is configured for user-supplied tokens (rather than a fixed service account), each user's own RBAC bindings must include the role above. A 403 from the plugin means the logged-in user lacks the binding.
- **Audit logging**: Kubernetes API audit logs will record every proxied request as a `get` on `services/proxy` in the `polaris` namespace. Set an appropriate audit policy level if request volume from the auto-refresh interval is a concern.

## Key Constraints

- **Data source**: Polaris dashboard API via K8s service proxy. Requires Polaris deployed in the `polaris` namespace with a `polaris-dashboard` service. No CRDs, no cluster write operations.
- **UI components**: Use only Headlamp-provided components (`@kinvolk/headlamp-plugin/lib/CommonComponents`). Do not import raw MUI packages. No custom theming.
- **Error handling**: Must handle 403 (RBAC denied), 404 (Polaris not installed), malformed JSON, and loading states with distinct visual states.
- **TypeScript strictness**: No `any`, no implicit `unknown` casting, no dead code, no unused imports.
- **Packaging**: `@kinvolk/headlamp-plugin` is a peer dependency. Do not bundle React or MUI.

## MCP Servers

The project has MCP server integrations configured in `.mcp.json`:
- **Gitea** (git.farh.net): Source control via `gitea-mcp-server`
- **Kubernetes** (local): Cluster access via `kubernetes-mcp-server`
- **Flux** (local): Flux Operator access via `flux-operator-mcp`
