# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Headlamp plugin surfacing Fairwinds Polaris audit results. Queries the Polaris dashboard API via Kubernetes service proxy (`/api/v1/namespaces/polaris/services/http:polaris-dashboard:80/proxy/results.json`). Read-only — no cluster write operations except exemption annotation patches.

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

```text
src/
├── index.tsx                           # Plugin entry: registerRoute, registerSidebarEntry, registerDetailsViewSection, registerAppBarAction, registerPluginSettings; PolarisErrorBoundary
├── test-utils.tsx                      # Shared test fixtures (makeResult, makeAuditData)
├── api/
│   ├── polaris.ts                      # Types (AuditData schema), countResults utilities, refresh settings, getPolarisApiPath, isFullUrl
│   ├── checkMapping.ts                 # Polaris check ID → human-readable name mapping
│   ├── topIssues.ts                    # Top failing checks aggregation logic
│   └── PolarisDataContext.tsx           # Shared React context provider (ApiProxy.request + configurable refresh)
└── components/
    ├── DashboardView.tsx                # Overview page (score gauge, check distribution, top failing checks)
    ├── NamespacesListView.tsx           # Namespace list with per-namespace scores + MUI Drawer detail panel
    ├── InlineAuditSection.tsx           # Injected into Deployment/StatefulSet/DaemonSet/Job/CronJob detail views
    ├── ExemptionManager.tsx             # Polaris exemption annotation management
    ├── AppBarScoreBadge.tsx             # App bar cluster score chip
    └── PolarisSettings.tsx              # Plugin settings (refresh interval, dashboard URL)
```

## Data flow

Data is fetched via `ApiProxy.request` to the Polaris dashboard service proxy and refreshed on a user-configurable interval (stored in localStorage under `polaris-plugin-refresh-interval`, default 5 minutes). Score is computed from result counts (pass/total). `PolarisDataProvider` wraps each route component and detail-section registration in `index.tsx`.

**Sidebar limitation**: Headlamp's sidebar only supports 2-level nesting (parent → children). Namespace navigation is handled via the in-content table on the Namespaces page instead.

## Code conventions

- Functional React components only — class components only for error boundaries (PolarisErrorBoundary in index.tsx)
- All imports from `@kinvolk/headlamp-plugin/lib` and `@kinvolk/headlamp-plugin/lib/CommonComponents`
- `@mui/material` is available as a shared external via Headlamp — use `useTheme` from `@mui/material/styles` for theming, MUI `Drawer`/`IconButton` etc. as needed. Do NOT add `@mui/material` to package.json dependencies.
- Use `useTheme()` + `theme.palette.*` for all theme-aware colors — never use `var(--mui-palette-*)` CSS variables
- No other UI libraries (no Ant Design, etc.)
- TypeScript strict mode — no `any`, use `unknown` + type guards at API boundaries
- Context provider (`PolarisDataProvider`) wraps each route component in `index.tsx`
- All registered components wrapped in `PolarisErrorBoundary` for graceful error handling
- Tests: vitest + @testing-library/react, mock with `vi.mock('@kinvolk/headlamp-plugin/lib', ...)` and `vi.mock('@mui/material/styles', ...)`
- `vitest.setup.ts` provides a spec-compliant `localStorage` shim for Node 22+ compatibility

## Testing

Mock pattern for headlamp APIs:

```typescript
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn().mockResolvedValue({}) },
  K8s: { ResourceClasses: {} },
}));
```
