# Features Guide

Learn about all features in the Headlamp Polaris Plugin.

## Overview Dashboard

The main dashboard provides cluster-wide visibility. Navigate to **Polaris → Overview**.

### Cluster Score Gauge

Overall cluster health score (0-100%) with color-coded status:

- **Green (≥80%):** Excellent - cluster follows best practices
- **Yellow (50-79%):** Needs attention - some issues present
- **Red (<50%):** Critical - significant security/reliability concerns

The score is calculated as: `(passing checks / total checks) × 100`

### Check Distribution

Visual breakdown of all Polaris checks across the cluster:

- **Pass** - Checks that passed (green)
- **Warning** - Failed checks with warning severity (yellow)
- **Danger** - Failed checks with danger severity (red)
- **Skipped** - Checks with severity "ignore" (gray)

**Note:** Skipped count only reflects checks with `Severity: "ignore"` from Polaris config. Annotation-based exemptions (e.g., `polaris.fairwinds.com/cpuLimitsMissing-exempt: "true"`) are not included. See "View in Polaris Dashboard" link for full exemption count.

### Top 10 Failing Checks

Most common issues across the entire cluster:

- Grouped by check type (e.g., "CPU Limits Missing", "Host IPC Set")
- Shows count and severity
- Helps identify cluster-wide patterns
- Click check name for details

### Cluster Statistics

Quick cluster metadata:

- **Polaris Version** - e.g., "4.2.0"
- **Last Audit** - ISO 8601 timestamp of most recent audit
- **Nodes** - Total node count
- **Pods** - Total pod count
- **Namespaces** - Total namespace count
- **Controllers** - Total workload controller count

### Manual Refresh

Click the refresh button to fetch the latest audit data immediately (bypasses auto-refresh interval).

## Namespace Views

### Namespaces List

Navigate to **Polaris → Namespaces** to see all namespaces with audit results.

**Table Columns:**
- **Namespace** - Clickable namespace name (opens detail panel)
- **Score** - Per-namespace score with color coding
- **Pass** - Passing checks count
- **Warning** - Warning severity failures
- **Danger** - Danger severity failures
- **Skipped** - Skipped checks count

**Sorting:** Table is sortable by any column. Default sort is by score (lowest first) to surface problematic namespaces.

### Namespace Detail Panel

Click any namespace to open a 1000px-wide side panel with detailed information.

**Features:**
- **Namespace Score** - Color-coded score gauge
- **Check Counts** - Pass/Warning/Danger/Skipped breakdown
- **Resource Table** - Per-resource audit results:
  - Resource name
  - Resource kind (Deployment, StatefulSet, DaemonSet, Job, CronJob)
  - Pass/Warning/Danger counts per resource
- **External Link** - "View in Polaris Dashboard" button for full Polaris UI
- **URL Hash Navigation** - Browser back/forward works with drawer state
- **Keyboard Shortcut** - Press **Escape** to close panel
- **Click-to-Close** - Click backdrop to close panel

The drawer respects Headlamp's theme (light/dark mode).

## Inline Resource Audits

Polaris audit results automatically appear on resource detail pages.

### Supported Resources

Inline audit sections appear on:
- Deployments
- StatefulSets
- DaemonSets
- Jobs
- CronJobs

### What's Shown

**Compact Audit Section:**
- **Score Badge** - Color-coded score
- **Check Counts** - Pass/Warning/Danger summary
- **Failing Checks Table** - Only failed checks listed:
  - Check name (human-readable)
  - Severity badge (Warning/Danger)
  - Message describing the issue
- **Link to Full Report** - Navigate to namespace detail for complete audit

**If no audit data:** Shows "No audit data available for this resource" message.

## App Bar Score Badge

Top-right corner of Headlamp shows a persistent cluster score badge.

**Features:**
- **Color-Coded Chip** - Green/Yellow/Red based on score
- **Shield Icon** - Visual indicator
- **Score Percentage** - e.g., "85%"
- **Clickable** - Click to navigate to Polaris overview
- **Real-Time Updates** - Updates on auto-refresh interval
- **Always Visible** - Appears on all Headlamp pages

**Example:** Shield icon with "85%" (green chip)

## Settings & Configuration

Access plugin settings via **Settings → Plugins → Polaris**.

### Refresh Interval

Controls how often the plugin fetches new audit data.

**Options:**
- 1 minute - Most frequent (highest API load)
- 5 minutes - **Default** (recommended)
- 10 minutes - Moderate refresh rate
- 30 minutes - Light load (large clusters)

**Impact:**
- Affects all views (dashboard, namespaces, inline audits, app bar badge)
- Longer intervals reduce Kubernetes API audit logging
- Changes take effect immediately (no restart required)

See [Configuration Guide](configuration.md) for details.

### Dashboard URL

Specifies which Polaris instance to connect to.

**Default:** Kubernetes service proxy path
```
/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/
```

**Custom Options:**
- External Polaris: `https://polaris.example.com/`
- Different namespace: `/api/v1/namespaces/custom-ns/services/polaris-dashboard:80/proxy/`

**Test Connection Button:** Verifies connectivity before saving.

See [Configuration Guide](configuration.md) for advanced setup.

## Dark Mode Support

Full theme adaptation for Headlamp's light and dark modes.

**Features:**
- **Auto Dark Mode** - Respects system preference when Headlamp uses it
- **Theme Toggle** - Adapts when you change Headlamp theme
- **All UI Elements** - Drawer backgrounds, tables, buttons, badges, score gauge
- **CSS Variables** - Uses MUI theme variables (`--mui-palette-*`)

**No configuration required** - works automatically with Headlamp's theme.

## Exemption Management

**Status:** Planned feature (UI components exist but not fully integrated)

**Future Capability:**
- View current exemptions on resources
- Add exemptions for specific failing checks
- Remove exemptions
- Apply via annotation patches (`polaris.fairwinds.com/*-exempt`)

This feature requires additional RBAC permissions (PATCH on workload resources) and is not yet enabled by default.

## Data Refresh Behavior

**Initial Load:**
- Data fetched when you first navigate to any Polaris view
- Shared across all views via React Context (no duplicate fetches)
- Loading spinner displayed during initial fetch

**Auto-Refresh:**
- Configured via Settings → Plugins → Polaris
- Default: 5 minutes
- Triggers background fetch without disrupting UI

**Manual Refresh:**
- Click refresh button on overview dashboard
- Forces immediate data fetch
- Updates all views simultaneously

**Error Handling:**
- 403 errors show RBAC permission guidance
- 404/503 errors indicate Polaris not installed
- Network errors show generic failure with retry suggestion

## Browser Requirements

**Supported Browsers:**
- Chrome/Chromium 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

**Required:**
- JavaScript enabled
- localStorage enabled (for settings persistence)
- Cookies enabled (for Headlamp session)

## Performance Characteristics

**Bundle Size:** ~27 KB minified (gzip: ~7.6 KB)

**Data Volume:** Depends on cluster size. Example:
- Small cluster (50 resources): ~100 KB JSON
- Medium cluster (500 resources): ~1 MB JSON
- Large cluster (5000 resources): ~10 MB JSON

**Rendering Performance:**
- Handles up to 100 namespaces without virtual scrolling
- Namespace detail drawer renders instantly for up to 500 resources
- React Context prevents unnecessary re-fetches

## Known Limitations

### Skipped Count Incomplete

The "Skipped" count only reflects checks with `Severity: "ignore"` in Polaris configuration. Annotation-based exemptions are not counted because:

- Polaris API omits exempted checks from `results.json`
- Native Polaris dashboard computes skipped count by querying raw Kubernetes resources
- Plugin only has access to processed audit results (not raw resources)

**Workaround:** Use "View in Polaris Dashboard" link for accurate exemption count.

### Single Cluster Support

Plugin shows data for the current Headlamp cluster only. Multi-cluster aggregation is not supported.

### No Real-Time Updates

Data refreshes on interval (1-30 minutes), not real-time. Polaris dashboard doesn't support WebSocket/SSE.

## Next Steps

- **[Configuration Guide](configuration.md)** - Customize refresh intervals, dashboard URLs, test connections
- **[RBAC Permissions](rbac-permissions.md)** - Advanced RBAC setup for token-auth, OIDC, multi-user
- **[Troubleshooting](../troubleshooting/README.md)** - Quick diagnosis for common issues

## References

- [Fairwinds Polaris Documentation](https://polaris.docs.fairwinds.com/)
- [Headlamp Documentation](https://headlamp.dev/docs/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
