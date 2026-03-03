# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Headlamp plugin surfacing Fairwinds Polaris audit results. Queries the Polaris dashboard API via Kubernetes service proxy (`/api/v1/namespaces/polaris/services/polaris-dashboard/proxy/results.json`). Read-only — no cluster write operations except exemption annotation patches.

- **Plugin name**: `polaris`
- **Target**: Headlamp >= v0.26
- **Data source**: Polaris dashboard service in `polaris` namespace
- **RBAC**: `get` on `services/proxy` resource `polaris-dashboard` in `polaris` namespace

## Commands

```bash
npm start          # dev server with hot reload
npm run build      # production build
npm run package    # package for headlamp
npm run tsc        # TypeScript type check (no emit)
npm run lint       # ESLint
npm run lint:fix   # ESLint with auto-fix
npm run format     # Prettier write
npm run format:check # Prettier check
npm test           # vitest run
npm run test:watch # vitest watch mode
npx vitest run src/api/polaris.test.ts  # run a single test file
npm run e2e        # Playwright E2E tests
npm run e2e:headed # Playwright headed mode
```

All tests and `tsc` must pass before committing.

## Architecture

```
src/
├── index.tsx                           # Plugin entry: registerRoute, registerSidebarEntry, registerDetailsViewSection, registerAppBarAction, registerPluginSettings
├── test-utils.tsx                      # Shared test utilities
├── api/
│   ├── polaris.ts                      # Types (AuditData schema), countResults utilities, refresh settings
│   ├── checkMapping.ts                 # Polaris check ID → human-readable name mapping
│   ├── topIssues.ts                    # Top failing checks aggregation logic
│   └── PolarisDataContext.tsx           # Shared React context provider (ApiProxy.request + configurable refresh)
└── components/
    ├── DashboardView.tsx                # Overview page (score gauge, check distribution, top failing checks)
    ├── NamespacesListView.tsx           # Namespace list with per-namespace scores
    ├── NamespaceDetailView.tsx          # Per-namespace drill-down with resource table
    ├── InlineAuditSection.tsx           # Injected into Deployment/StatefulSet/DaemonSet/Job/CronJob detail views
    ├── ExemptionManager.tsx             # Polaris exemption annotation management
    ├── AppBarScoreBadge.tsx             # App bar cluster score chip
    └── PolarisSettings.tsx              # Plugin settings (refresh interval, dashboard URL)
```

## Data flow

Data is fetched via `ApiProxy.request` to the Polaris dashboard service proxy and refreshed on a user-configurable interval (stored in localStorage under `polaris-plugin-refresh-interval`, default 5 minutes). Score is computed from result counts (pass/total). `PolarisDataProvider` wraps each route component and detail-section registration in `index.tsx`.

**Sidebar limitation**: Headlamp's sidebar only supports 2-level nesting (parent → children). Namespace navigation is handled via the in-content table on the Namespaces page instead.

## Code conventions

- Functional React components only — no class components
- All imports from `@kinvolk/headlamp-plugin/lib` and `@kinvolk/headlamp-plugin/lib/CommonComponents`
- No additional UI libraries (no MUI direct imports, no Ant Design, etc.)
- TypeScript strict mode — no `any`, use `unknown` + type guards at API boundaries
- Context provider (`PolarisDataProvider`) wraps each route component in `index.tsx`
- Tests: vitest + @testing-library/react, mock with `vi.mock('@kinvolk/headlamp-plugin/lib', ...)`
- `vitest.setup.ts` provides a spec-compliant `localStorage` shim for Node 22+ compatibility

## Testing

Mock pattern for headlamp APIs:
```typescript
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn().mockResolvedValue({}) },
  K8s: { ResourceClasses: {} },
}));
```