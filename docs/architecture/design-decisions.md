# Design Decisions

Key architectural choices and their rationale for the Headlamp Polaris Plugin.

## 1. Service Proxy vs. Direct Access

**Decision:** Use Kubernetes service proxy, not direct ClusterIP access

**Context:**
- Plugin needs to access Polaris dashboard API
- Two options: Direct ClusterIP access or Kubernetes service proxy
-Headlamp already has K8s API credentials

**Decision:**
Use service proxy path: `/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`

**Rationale:**
- Headlamp already has K8s API credentials (service account or user token)
- Service proxy leverages existing RBAC (no new credentials needed)
- Works with Headlamp's token auth and OIDC
- Simpler deployment (no additional network policies for plugin)
- Consistent with Headlamp's architecture (all API calls go through K8s API)

**Trade-offs:**
- ✅ **Pros:** Simpler RBAC, works with user tokens, no new credentials
- ❌ **Cons:** Longer URL path, requires `services/proxy` permission

**Alternatives Considered:**
- Direct ClusterIP access → Rejected (requires new credentials, network policies)
- External Polaris URL → Supported as optional feature (custom URL setting)

## 2. React Context vs. Redux/Zustand

**Decision:** Use React Context for state management

**Context:**
- Plugin needs to share Polaris audit data across multiple views
- Options: React Context, Redux, Zustand, or component props

**Decision:**
Use React Context with `PolarisDataProvider`

**Rationale:**
1. **Simple state:** Single AuditData object, no complex mutations
2. **Read-only:** No transactions, undo/redo, or optimistic updates
3. **Headlamp constraints:** Cannot add external dependencies (Redux not bundled)
4. **Performance:** Data changes infrequently (5-30 minute refresh interval)

**Trade-offs:**
- ✅ **Pros:** No dependencies, simple API, built-in React feature
- ❌ **Cons:** All consumers re-render on data change (acceptable for infrequent updates)

**Alternatives Considered:**
- Redux → Rejected (not available in plugin environment)
- Zustand → Rejected (requires external dependency)
- Component props → Rejected (prop drilling, duplicate fetches)

## 3. Drawer Navigation vs. Dedicated Routes

**Decision:** Use drawer for namespace detail, not dedicated route

**Context:**
- Namespaces list needs drill-down to per-namespace detail
- Options: Dedicated route (`/polaris/ns/:namespace`) or drawer overlay

**Decision:**
Use drawer with URL hash (`/polaris/namespaces#kube-system`)

**Rationale:**
- **Better UX:** Drawer overlays table, preserves scroll position and context
- **URL hash:** Preserves navigation state, supports browser back/forward
- **Keyboard shortcuts:** Escape key to close drawer
- **Sidebar limitation:** Headlamp sidebar doesn't support 3-level nesting

**Trade-offs:**
- ✅ **Pros:** Better UX, preserves context, keyboard navigation
- ❌ **Cons:** Hash-based routing (not "true" route), drawer accessibility considerations

**Alternatives Considered:**
- Dedicated route → Rejected (loses table context, requires back navigation)
- Modal → Rejected (less natural for drill-down, no URL state)

## 4. No MUI Direct Imports

**Decision:** Never import from `@mui/material` or `@mui/icons-material`

**Context:**
- Plugin needs UI components (buttons, icons, etc.)
- Headlamp uses MUI but doesn't expose full library to plugins

**Decision:**
Use only Headlamp CommonComponents or HTML elements with inline styles

**Rationale:**
- Importing MUI causes `createSvgIcon undefined` runtime error
- Headlamp plugin environment provides limited MUI exports
- CommonComponents cover 90% of use cases

**Implementation:**
- Use `StatusLabel`, `SectionBox`, `SimpleTable` from CommonComponents
- Use standard HTML elements (`<button>`, `<div>`) with inline styles
- Use theme-aware CSS variables (`--mui-palette-background-paper`)

**Trade-offs:**
- ✅ **Pros:** No runtime errors, smaller bundle, consistent with Headlamp
- ❌ **Cons:** Limited component variety, inline styles verbose

**Alternatives Considered:**
- Bundle full MUI → Rejected (huge bundle size, version conflicts)
- Use Headlamp's MUI exports → Rejected (incomplete, undocumented)

## 5. Two-Level Sidebar Nesting

**Decision:** Sidebar has "Polaris" → "Overview" and "Namespaces" (2 levels max)

**Context:**
- Plugin needs hierarchical navigation
- Headlamp sidebar supports limited nesting depth

**Decision:**
Use 2-level sidebar: `Polaris` (parent) → `Overview`, `Namespaces` (children)

**Rationale:**
- Headlamp sidebar `Collapse` component only supports 2 levels
- Deeper nesting (Polaris → Namespaces → <each namespace>) doesn't work
- Sidebar collapse is route-based, not click-to-toggle

**Workaround:**
- Namespace navigation via table (NamespacesListView)
- Clickable namespace buttons open drawer (not new route)

**Trade-offs:**
- ✅ **Pros:** Works within Headlamp constraints
- ❌ **Cons:** Can't have dynamic per-namespace sidebar entries

**Alternatives Considered:**
- Dynamic sidebar with namespace entries → Rejected (Headlamp limitation)
- Flat sidebar (no nesting) → Rejected (poor UX for plugin with multiple views)

## 6. TypeScript Strict Mode

**Decision:** Enable all TypeScript strict checks

**Configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true
  }
}
```

**Rationale:**
- Catch errors at compile time (not runtime)
- Better IDE support and autocomplete
- Enforces type safety (no `any`, no implicit unknowns)
- Easier refactoring (type errors surface immediately)

**Trade-offs:**
- ✅ **Pros:** Fewer runtime errors, better maintainability, self-documenting code
- ❌ **Cons:** More verbose code, steeper learning curve

## 7. Auto-Refresh Default: 5 Minutes

**Decision:** Default refresh interval is 5 minutes (configurable 1-30 min)

**Context:**
- Plugin needs to refresh Polaris data periodically
- Polaris audits typically run every 10-30 minutes

**Decision:**
Default to 5 minutes, allow user to configure (1 / 5 / 10 / 30 minutes)

**Rationale:**
- Balance between data freshness and API load
- Polaris audits don't change frequently (10-30 min intervals)
- 5 minutes provides reasonably fresh data without excessive API calls

**Trade-offs:**
- ✅ **Pros:** Reasonable default, user-configurable, low API load
- ❌ **Cons:** Not real-time (acceptable for audit data)

**Alternatives Considered:**
- WebSocket/SSE for real-time → Rejected (Polaris dashboard doesn't support)
- 1 minute default → Rejected (unnecessary API calls, audit data changes slowly)
- 30 minute default → Rejected (too stale for interactive dashboard)

## 8. Read-Only Plugin

**Decision:** Plugin is read-only (no write operations)

**Context:**
- Plugin could potentially modify Polaris configuration or add exemptions
- Write operations require additional RBAC permissions (PATCH, CREATE)

**Decision:**
Plugin only performs GET requests (read-only)

**Rationale:**
- **Security:** Minimal RBAC footprint (`get` on `services/proxy` only)
- **Simplicity:** No mutation logic, error handling for writes, or rollback
- **Polaris design:** Exemptions managed via annotations (outside plugin scope)
- **Future:** Can add writes later if user demand exists

**Trade-offs:**
- ✅ **Pros:** Minimal permissions, simpler code, fewer failure modes
- ❌ **Cons:** Cannot add exemptions via UI (must edit annotations manually)

**Future Enhancement:**
- Add PATCH permission for workload annotations
- Implement `ExemptionManager` component (UI exists, not integrated)

## Known Limitations

### 1. Sidebar Nesting Depth

**Limitation:** Headlamp sidebar supports only 2 levels

**Impact:** Cannot have dynamic per-namespace sidebar entries

**Workaround:** Use table with drawer navigation

### 2. Skipped Checks Visibility

**Limitation:** Skipped checks (annotation-based exemptions) not fully counted

**Reason:** Polaris API omits exempted checks from `results.json`

**Impact:** "Skipped" count only reflects checks with `Severity: "ignore"`

**Documented:** README, tooltip on skipped count, KNOWN_LIMITATIONS section

### 3. No Real-Time Updates

**Limitation:** Data refreshes on interval (1-30 min), not real-time

**Reason:** Polaris dashboard doesn't support WebSocket/SSE

**Workaround:** Manual refresh button, configurable interval

### 4. Single Cluster Support

**Limitation:** Plugin shows data for current cluster only

**Reason:** Headlamp's multi-cluster support is route-based (`/c/<cluster>/...`)

**Impact:** Must switch clusters in Headlamp to see different cluster's data

## Next Steps

- **[Architecture Overview](overview.md)** - High-level component hierarchy
- **[Data Flow](data-flow.md)** - Detailed data flow sequences
- **[ADRs](adr/README.md)** - Formal Architecture Decision Records

## References

- [Headlamp Plugin Constraints](https://headlamp.dev/docs/latest/development/plugins/)
- [React Context Performance](https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
