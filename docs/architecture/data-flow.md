# Data Flow

Detailed data flow sequences for the Headlamp Polaris Plugin.

## 1. Initial Load

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

## 2. Data Refresh

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

## 3. Navigation Flow

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

## 4. Error Handling Flow

```
ApiProxy.request() called
    ↓
Fetch fails with HTTP error
    ↓
Error caught in usePolarisData hook
    ↓
Error status code checked (403, 404, 503, etc.)
    ↓
Context-specific error message set:
  • 403: RBAC permission denied
  • 404/503: Polaris not installed
  • Other: Generic network error
    ↓
Error state propagated to consuming components
    ↓
Components render error UI with StatusLabel
    ↓
User sees error message with actionable guidance
```

## 5. Service Proxy Request Flow

```
Plugin code: ApiProxy.request(path)
    ↓
Headlamp backend proxies request
    ↓
HTTP GET to Kubernetes API server
    ↓
API server authenticates request (service account or user token)
    ↓
API server checks RBAC:
  • Verb: get
  • Resource: services/proxy
  • ResourceName: polaris-dashboard
  • Namespace: polaris
    ↓
If authorized:
  API server proxies to Polaris service
    ↓
Polaris dashboard returns results.json
    ↓
Response flows back to plugin
    ↓
If denied (403):
  RBAC error returned to plugin
    ↓
Plugin displays error with RBAC guidance
```

## 6. Settings Persistence Flow

```
User navigates to Settings → Plugins → Polaris
    ↓
PolarisSettings component mounts
    ↓
Component reads localStorage:
  • polaris-plugin-refresh-interval
  • polaris-plugin-dashboard-url
    ↓
Form populated with current values
    ↓
User modifies settings (refresh interval, dashboard URL)
    ↓
User clicks "Save"
    ↓
Settings written to localStorage:
  localStorage.setItem('polaris-plugin-refresh-interval', value)
  localStorage.setItem('polaris-plugin-dashboard-url', url)
    ↓
Success message displayed
    ↓
Context refreshes data with new interval
    ↓
All plugin views use new settings immediately
```

## 7. App Bar Badge Flow

```
Headlamp renders app bar
    ↓
Plugin's registerAppBarAction called
    ↓
AppBarScoreBadge component rendered in app bar
    ↓
Component uses usePolarisDataContext()
    ↓
Data fetched from Polaris (shared with views)
    ↓
Score computed: (pass / total) * 100
    ↓
Badge color determined:
  • Green: score ≥ 80
  • Yellow: score 50-79
  • Red: score < 50
    ↓
Badge rendered with score and shield icon
    ↓
User clicks badge
    ↓
Navigate to /polaris (overview page)
```

## 8. Inline Audit Section Flow

```
User views Deployment/StatefulSet detail page
    ↓
Headlamp calls registered details view sections
    ↓
Plugin's InlineAuditSection component rendered
    ↓
Component receives resource metadata from Headlamp
    ↓
Component uses usePolarisDataContext()
    ↓
Filters audit results by:
  • Namespace === resource.namespace
  • Kind === resource.kind
  • Name === resource.name
    ↓
If matching audit result found:
  Extract check counts (pass/warning/danger)
    ↓
Render compact audit section:
  • Score badge
  • Check counts
  • Link to full Polaris report
    ↓
If no match found:
  Render "No audit data available" message
```

## Data Structures

### AuditData Schema

```typescript
interface AuditData {
  PolarisOutputVersion: string;        // "1.0"
  AuditTime: string;                   // ISO 8601 timestamp
  SourceType: string;                  // "Cluster"
  SourceName: string;                  // Cluster identifier
  DisplayName: string;                 // Human-readable name
  ClusterInfo: {
    Version: string;                   // K8s version
    Nodes: number;
    Pods: number;
    Namespaces: number;
    Controllers: number;
  };
  Results: Result[];                   // Array of resource audit results
}

interface Result {
  Name: string;                        // Resource name
  Namespace: string;                   // Kubernetes namespace
  Kind: string;                        // "Deployment", "StatefulSet", etc.
  Results: ResultSet;                  // Resource-level checks
  PodResult?: {
    Name: string;
    Results: ResultSet;                // Pod-level checks
    ContainerResults: {
      Name: string;
      Results: ResultSet;              // Container-level checks
    }[];
  };
  CreatedTime: string;                 // ISO 8601 timestamp
}

type ResultSet = Record<string, ResultMessage>;

interface ResultMessage {
  ID: string;                          // Check ID (e.g., "cpuLimitsMissing")
  Message: string;                     // Human-readable message
  Details: string[];                   // Additional context
  Success: boolean;                    // true = passed, false = failed
  Severity: "ignore" | "warning" | "danger";
  Category: string;                    // "Security", "Efficiency", etc.
}
```

### Result Counts

```typescript
interface ResultCounts {
  total: number;       // Total checks performed
  pass: number;        // Checks that passed (Success: true)
  warning: number;     // Failed checks with Severity: "warning"
  danger: number;      // Failed checks with Severity: "danger"
  skipped: number;     // Failed checks with Severity: "ignore"
}
```

## Data Transformations

### 1. Aggregating Counts

```typescript
// Input: AuditData.Results[]
// Output: ResultCounts

function countResults(data: AuditData): ResultCounts {
  const counts = { total: 0, pass: 0, warning: 0, danger: 0, skipped: 0 };

  for (const result of data.Results) {
    // Count resource-level checks
    countResultSet(result.Results, counts);

    // Count pod-level checks
    if (result.PodResult) {
      countResultSet(result.PodResult.Results, counts);

      // Count container-level checks
      for (const container of result.PodResult.ContainerResults) {
        countResultSet(container.Results, counts);
      }
    }
  }

  return counts;
}

function countResultSet(rs: ResultSet, counts: ResultCounts): void {
  for (const key in rs) {
    const msg = rs[key];
    counts.total++;
    if (msg.Success) {
      counts.pass++;
    } else if (msg.Severity === 'ignore') {
      counts.skipped++;
    } else if (msg.Severity === 'warning') {
      counts.warning++;
    } else if (msg.Severity === 'danger') {
      counts.danger++;
    }
  }
}
```

### 2. Computing Score

```typescript
// Input: ResultCounts
// Output: Score (0-100)

function computeScore(counts: ResultCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.pass / counts.total) * 100);
}

// Examples:
// { total: 100, pass: 90, ... } → 90
// { total: 100, pass: 50, ... } → 50
// { total: 0, pass: 0, ... } → 0
```

### 3. Filtering by Namespace

```typescript
// Input: AuditData, namespace string
// Output: Result[] for that namespace

function filterResultsByNamespace(data: AuditData, namespace: string): Result[] {
  return data.Results.filter(r => r.Namespace === namespace);
}
```

### 4. Extracting Namespaces

```typescript
// Input: AuditData
// Output: Sorted array of unique namespace names

function getNamespaces(data: AuditData): string[] {
  const namespaces = new Set<string>();
  for (const result of data.Results) {
    if (result.Namespace) {
      namespaces.add(result.Namespace);
    }
  }
  return Array.from(namespaces).sort();
}
```

## Caching Strategy

**Current Implementation:**
- Data fetched once and stored in React Context
- Shared across all plugin views (no duplicate fetches)
- Cached until manual refresh or auto-refresh interval

**Cache Invalidation:**
- Manual refresh button click
- Auto-refresh interval elapses
- Settings change (dashboard URL)

**No Persistence:**
- Data NOT persisted to localStorage
- Each browser session fetches fresh data
- No offline mode

**Future Enhancement:**
- IndexedDB caching for offline access
- Incremental updates (fetch only changed namespaces)
- Service Worker for background refresh

## Next Steps

- **[Architecture Overview](overview.md)** - High-level component hierarchy
- **[Design Decisions](design-decisions.md)** - Key architectural choices
- **[ADRs](adr/README.md)** - Formal Architecture Decision Records

## References

- [Polaris API Documentation](https://polaris.docs.fairwinds.com/)
- [React Context API](https://react.dev/reference/react/useContext)
- [Headlamp ApiProxy](https://headlamp.dev/docs/latest/development/api/)
