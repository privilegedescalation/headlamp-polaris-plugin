# Architecture Overview

High-level architecture of the Headlamp Polaris Plugin.

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
  data: AuditData | null; // Audit results or null if loading/error
  loading: boolean; // True during initial fetch
  error: string | null; // Error message if fetch failed
  refresh: () => void; // Manual refresh function
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

## Integration Points

### Headlamp Plugin API

**Version:** ≥ v0.13.0

**Registration Functions Used:**

```typescript
// Sidebar navigation
registerSidebarEntry({ parent, name, label, url, icon });

// Routes
registerRoute({ path, sidebar, name, exact, component });

// App bar actions
registerAppBarAction(component);

// Plugin settings
registerPluginSettings(name, component, displaySaveButton);

// Resource detail sections
registerDetailsViewSection(component);
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

## Next Steps

- **[Data Flow](data-flow.md)** - Detailed data flow diagrams and sequences
- **[Design Decisions](design-decisions.md)** - Architecture decision records
- **[ADRs](adr/README.md)** - Formal Architecture Decision Records

## References

- [Headlamp Plugin Development](https://headlamp.dev/docs/latest/development/plugins/)
- [Fairwinds Polaris Documentation](https://polaris.docs.fairwinds.com/)
- [React Context API](https://react.dev/reference/react/useContext)
- [Kubernetes Service Proxy](https://kubernetes.io/docs/tasks/administer-cluster/access-cluster-services/)
