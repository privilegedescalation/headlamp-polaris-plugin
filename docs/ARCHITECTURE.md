# Architecture

This document describes the architecture, design decisions, and data flow of the Headlamp Polaris Plugin.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Component Hierarchy](#component-hierarchy)
- [State Management](#state-management)
- [Design Decisions](#design-decisions)
- [Integration Points](#integration-points)
- [Known Limitations](#known-limitations)

## Overview

The Headlamp Polaris Plugin is a **read-only dashboard** that surfaces Fairwinds Polaris audit results within the Headlamp UI. It fetches data from the Polaris dashboard API via the Kubernetes service proxy and presents it in a hierarchical navigation structure.

**Key Characteristics:**
- **Read-only:** No write operations to cluster or Polaris
- **Service proxy based:** Uses K8s API server proxy to reach Polaris
- **React Context for state:** Shared data fetch across components
- **Headlamp plugin API:** Integrates via official plugin system
- **Type-safe:** Full TypeScript with strict mode

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Headlamp UI (React)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  App Bar     │  │  Sidebar     │  │  Routes      │      │
│  │  (Badge)     │  │  (Navigation)│  │  (Views)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │ Plugin Registry │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│              ┌─────────────▼──────────────┐                 │
│              │  Polaris Plugin     │                 │
│              ├────────────────────────────┤                 │
│              │ • registerSidebarEntry     │                 │
│              │ • registerRoute            │                 │
│              │ • registerAppBarAction     │                 │
│              │ • registerPluginSettings   │                 │
│              │ • registerDetailsViewSection│                 │
│              └─────────────┬──────────────┘                 │
│                            │                                 │
│              ┌─────────────▼──────────────┐                 │
│              │  PolarisDataContext        │                 │
│              │  (React Context Provider)  │                 │
│              └─────────────┬──────────────┘                 │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│    ┌────▼─────┐     ┌──────▼──────┐   ┌──────▼──────┐     │
│    │Dashboard │     │ Namespaces  │   │  Namespace  │     │
│    │View      │     │ ListView    │   │  Detail     │     │
│    └──────────┘     └─────────────┘   └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  ApiProxy      │
                    │  (Headlamp)    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  Kubernetes    │
                    │  API Server    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  Service Proxy │
                    │  /api/v1/ns/   │
                    │  polaris/svcs/ │
                    │  polaris-      │
                    │  dashboard/    │
                    │  proxy/        │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  Polaris       │
                    │  Dashboard     │
                    │  (ClusterIP)   │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  results.json  │
                    │  (AuditData)   │
                    └────────────────┘
```

## Data Flow

### 1. Initial Load

```
User loads Headlamp
    ↓
Headlamp loads plugins
    ↓
Plugin registers routes, sidebar, app bar actions
    ↓
User navigates to /polaris
    ↓
DashboardView mounts
    ↓
PolarisDataContext.Provider wraps component
    ↓
usePolarisDataContext() hook triggers fetch
    ↓
ApiProxy.request() → K8s API → Service Proxy → Polaris
    ↓
AuditData returned and cached in Context
    ↓
Components receive data and render
```

### 2. Data Refresh

```
User clicks "Refresh" button or auto-refresh interval elapses
    ↓
refresh() function called in Context
    ↓
setRefreshKey() increments (forces re-fetch)
    ↓
useEffect dependency triggers new fetch
    ↓
ApiProxy.request() → Polaris Dashboard
    ↓
Context state updated with new data
    ↓
All consuming components re-render automatically
```

### 3. Navigation Flow

```
User clicks "Polaris" in sidebar
    ↓
Route: /c/main/polaris (DashboardView)
    ↓
Display cluster score, check distribution
    ↓
User clicks "Namespaces" submenu
    ↓
Route: /c/main/polaris/namespaces (NamespacesListView)
    ↓
Display table of namespaces with scores
    ↓
User clicks namespace button in table
    ↓
Drawer opens, URL hash updates (#namespace-name)
    ↓
NamespaceDetailView renders in drawer
    ↓
Display namespace score + resource table
```

## Component Hierarchy

### Plugin Entry Point

**`src/index.tsx`**
- Registers sidebar entries (Polaris → Overview, Namespaces)
- Registers routes (`/polaris`, `/polaris/namespaces`)
- Registers app bar action (score badge)
- Registers plugin settings page
- Registers details view section (inline audit)

### Data Layer

**`src/api/PolarisDataContext.tsx`**
- React Context Provider for shared data
- Fetches AuditData from Polaris dashboard
- Handles auto-refresh based on user settings
- Provides `{ data, loading, error, refresh }` to consumers

**`src/api/polaris.ts`**
- TypeScript types for AuditData schema
- Utility functions: `countResults()`, `computeScore()`
- Settings management: `getRefreshInterval()`, `setRefreshInterval()`
- Constants: `DASHBOARD_URL_DEFAULT`, `INTERVAL_OPTIONS`

**`src/api/checkMapping.ts`**
- Maps Polaris check IDs to human-readable names
- Used for display in UI (e.g., "hostIPCSet" → "Host IPC")

**`src/api/topIssues.ts`**
- Aggregates failing checks across cluster
- Groups by check ID and severity
- Used for top issues dashboard

### View Components

**`src/components/DashboardView.tsx`**
- **Route:** `/polaris`
- **Purpose:** Cluster-wide overview
- **Features:**
  - Cluster score (percentage)
  - Check distribution (pass/warning/danger/skipped)
  - Cluster info (Polaris version, last audit time)
  - Refresh button
- **Data:** Uses `usePolarisDataContext()`

**`src/components/NamespacesListView.tsx`**
- **Route:** `/polaris/namespaces`
- **Purpose:** List all namespaces with scores
- **Features:**
  - Table with namespace, score, pass/warning/danger counts
  - Clickable namespace buttons (opens drawer)
  - Sorted by score (lowest first)
- **Data:** Uses `usePolarisDataContext()`, aggregates by namespace

**`src/components/NamespaceDetailView.tsx`**
- **Route:** Drawer on `/polaris/namespaces#<namespace>`
- **Purpose:** Namespace-level drill-down
- **Features:**
  - Namespace score
  - Resource table (kind, name, score, counts)
  - URL hash navigation
  - Keyboard shortcuts (Escape to close)
- **Data:** Filters `usePolarisDataContext()` by namespace

### UI Components

**`src/components/AppBarScoreBadge.tsx`**
- **Location:** Headlamp app bar (top-right)
- **Purpose:** Quick cluster score visibility
- **Features:**
  - Color-coded badge (green ≥80%, orange ≥50%, red <50%)
  - Clickable (navigates to `/polaris`)
  - Shield emoji icon
- **Data:** Uses `usePolarisDataContext()`

**`src/components/PolarisSettings.tsx`**
- **Location:** Settings → Plugins → Polaris
- **Purpose:** Plugin configuration
- **Features:**
  - Refresh interval selector (1 min to 30 min)
  - Dashboard URL input (custom Polaris instances)
  - Connection test button
- **Data:** localStorage for persistence

**`src/components/InlineAuditSection.tsx`**
- **Location:** Resource detail pages (Deployment, StatefulSet, etc.)
- **Purpose:** Show Polaris audit inline
- **Features:**
  - Pass/warning/danger counts
  - Check details with messages
  - Severity badges
- **Data:** Uses `usePolarisDataContext()`, filters by resource

**`src/components/ExemptionManager.tsx`**
- **Location:** (Planned feature, UI exists but not fully integrated)
- **Purpose:** Manage Polaris exemptions via annotations
- **Features:**
  - View current exemptions
  - Add exemptions for failing checks
  - Remove exemptions

## State Management

### Why React Context?

**Decision:** Use React Context instead of Redux/Zustand

**Rationale:**
1. **Simple state:** Single AuditData object shared across views
2. **Read-only:** No complex mutations or transactions
3. **Headlamp constraints:** Plugin cannot add dependencies (Redux not bundled)
4. **Performance:** Data changes infrequently (refresh interval 1-30 min)

### Context Structure

```typescript
interface PolarisDataContextValue {
  data: AuditData | null;      // Audit results or null if loading/error
  loading: boolean;             // True during initial fetch
  error: string | null;         // Error message if fetch failed
  refresh: () => void;          // Manual refresh function
}
```

### Data Fetching Strategy

1. **Initial fetch:** On first mount of any component using the context
2. **Auto-refresh:** Based on user setting (default 5 minutes)
3. **Manual refresh:** Via refresh button in UI
4. **Caching:** Data persists in context until refresh (no per-route refetch)

### localStorage Usage

Settings persisted in localStorage:
- **`polaris-plugin-refresh-interval`**: Number (seconds), default 300
- **`polaris-plugin-dashboard-url`**: String, default service proxy path

No sensitive data stored in localStorage.

## Design Decisions

### 1. Service Proxy vs. Direct Access

**Decision:** Use Kubernetes service proxy, not direct ClusterIP access

**Rationale:**
- Headlamp already has K8s API credentials (service account or user token)
- Service proxy leverages existing RBAC (no new credentials needed)
- Works with Headlamp's token auth and OIDC
- Simpler deployment (no additional network policies for plugin)

**Trade-off:**
- Requires `get` permission on `services/proxy` resource
- Path is longer: `/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`

### 2. Two-Level Sidebar Nesting

**Decision:** Sidebar has "Polaris" → "Overview" and "Namespaces" (2 levels max)

**Rationale:**
- Headlamp sidebar supports 2-level nesting maximum
- Deeper nesting (e.g., Polaris → Namespaces → <each namespace>) doesn't work
- Sidebar Collapse component is route-based, not click-to-toggle

**Alternative Considered:**
- Dynamic sidebar with namespace entries → rejected (Headlamp limitation)

**Current Solution:**
- Use table in NamespacesListView with clickable namespace buttons
- Namespace detail opens in drawer (not new route)

### 3. Drawer Navigation Instead of Routes

**Decision:** Namespace detail uses drawer, not dedicated route

**Rationale:**
- Better UX (drawer overlays table, no navigation loss)
- URL hash preserves navigation state (`#namespace-name`)
- Keyboard shortcuts (Escape to close)
- Sidebar doesn't support 3-level nesting for per-namespace routes

**Implementation:**
- URL: `/polaris/namespaces#kube-system`
- Drawer controlled by hash presence
- `useEffect` watches hash changes

### 4. No MUI Direct Imports

**Decision:** Never import from `@mui/material` or `@mui/icons-material`

**Rationale:**
- Headlamp plugin environment doesn't provide full MUI library
- Importing MUI causes `createSvgIcon undefined` error
- Plugins must use Headlamp CommonComponents only

**Alternative:**
- Use standard HTML elements with inline styles
- Use theme-aware CSS variables (`--mui-palette-*`)

### 5. TypeScript Strict Mode

**Decision:** Enable all TypeScript strict checks

**Rationale:**
- Catch errors at compile time
- Better IDE support and autocomplete
- Enforces type safety (no `any`, no implicit unknowns)

**Impact:**
- More verbose code (explicit types required)
- Better maintainability and refactorability

### 6. Auto-Refresh Default: 5 Minutes

**Decision:** Default refresh interval is 5 minutes (configurable)

**Rationale:**
- Polaris audits typically run every 10-30 minutes
- Balance between data freshness and API load
- User can configure from 1 minute to 30 minutes

**Considered:**
- WebSocket/SSE for real-time updates → rejected (Polaris dashboard doesn't support)
- Shorter default → rejected (unnecessary API calls)

## Integration Points

### Headlamp Plugin API

**Version:** ≥ v0.13.0

**Registration Functions Used:**

```typescript
// Sidebar navigation
registerSidebarEntry({ parent, name, label, url, icon })

// Routes
registerRoute({ path, sidebar, name, exact, component })

// App bar actions
registerAppBarAction(component)

// Plugin settings
registerPluginSettings(name, component, displaySaveButton)

// Resource detail sections
registerDetailsViewSection(component)
```

**Key Changes in v0.13.0:**
- `registerDetailsViewSection` now takes 1 argument (component), not 2 (name, component)
- `registerAppBarAction` now takes 1 argument (component), not 2 (name, component)

### Headlamp CommonComponents

**Used Components:**
- `SectionBox` - Card-like container with title
- `SectionHeader` - Page header with title
- `StatusLabel` - Color-coded status badges
- `NameValueTable` - Key-value table layout
- `SimpleTable` - Data table with sorting
- `Drawer` - Right-side overlay panel
- `Loader` - Loading spinner

**Router:**
- `Router.createRouteURL()` - Generate plugin route URLs
- React Router's `useHistory()`, `useParams()`, `useLocation()`

### Kubernetes API (via ApiProxy)

**Used for:**
- Fetching Polaris results: `ApiProxy.request(dashboardUrl + 'results.json')`
- No direct K8s API calls (all data from Polaris dashboard)

**RBAC Required:**
- `get` on `services/proxy` for `polaris-dashboard` in `polaris` namespace

## Known Limitations

### 1. Sidebar Nesting Depth

**Limitation:** Headlamp sidebar supports only 2 levels

**Impact:** Cannot have dynamic per-namespace sidebar entries

**Workaround:** Use table with drawer navigation

### 2. Skipped Checks Visibility

**Limitation:** Skipped checks (severity "ignore") counted but details not shown in dashboard

**Reason:** Polaris API groups skipped checks but doesn't provide per-check details

**Impact:** Users see skipped count but can't drill down to specific skipped checks

**Documented:** README, tooltip on skipped count

### 3. No Write Operations

**Limitation:** Plugin cannot modify Polaris configuration or exemptions

**Reason:** Read-only by design (service proxy only has `get` permission)

**Impact:** Exemption manager UI exists but requires manual annotation edits

**Future:** Could add PATCH permission to enable exemption annotations via UI

### 4. No Real-Time Updates

**Limitation:** Data refreshes on interval (1-30 minutes), not real-time

**Reason:** Polaris dashboard doesn't support WebSocket/SSE

**Impact:** Users may see stale data between refreshes

**Workaround:** Manual refresh button, configurable interval

### 5. MUI Import Restrictions

**Limitation:** Cannot import MUI components directly

**Reason:** Headlamp plugin environment doesn't provide full MUI bundle

**Impact:** Must use Headlamp CommonComponents or HTML elements

**Documented:** CLAUDE.md, CONTRIBUTING.md

### 6. Single Cluster Support

**Limitation:** Plugin shows data for current cluster only

**Reason:** Headlamp's multi-cluster support is route-based (`/c/<cluster>/...`)

**Impact:** Users must switch clusters in Headlamp to see different cluster's Polaris data

**Future:** Could enhance to aggregate multi-cluster if Headlamp API supports it

## Performance Considerations

### Bundle Size

- **Current:** ~27 KB minified (gzip: ~7.6 KB)
- **Target:** Keep under 50 KB to ensure fast loading
- **Strategy:** No heavy dependencies, tree-shaking enabled

### Data Fetching

- **Lazy loading:** Data not fetched until user navigates to plugin
- **Caching:** Single fetch shared across all views (React Context)
- **Refresh strategy:** User-controlled interval prevents excessive API calls

### Rendering

- **React.memo:** Not needed (data changes infrequently)
- **Virtual scrolling:** Not needed (namespace/resource lists typically <100 items)
- **Component splitting:** Lazy load views if bundle grows significantly

## Future Architecture Enhancements

### Potential Improvements

1. **WebWorker for data processing**
   - Offload `countResults()` aggregation for large clusters
   - Keep UI responsive during heavy computation

2. **IndexedDB caching**
   - Cache audit data offline
   - Show stale data + "refresh available" indicator

3. **GraphQL/REST API abstraction**
   - Decouple from Polaris dashboard JSON format
   - Support multiple backend sources

4. **Plugin-to-plugin communication**
   - Integrate with other Headlamp plugins (e.g., policy enforcement)
   - Shared state between plugins

5. **Incremental updates**
   - Fetch only changed namespaces/resources
   - Reduce bandwidth and processing

## References

- [Headlamp Plugin Development](https://headlamp.dev/docs/latest/development/plugins/)
- [Fairwinds Polaris Documentation](https://polaris.docs.fairwinds.com/)
- [React Context API](https://react.dev/reference/react/useContext)
- [Kubernetes Service Proxy](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
