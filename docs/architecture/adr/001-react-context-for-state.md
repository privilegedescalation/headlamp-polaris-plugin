# ADR-001: Use React Context for State Management

**Status:** Accepted
**Date:** 2026-02-12
**Deciders:** Plugin maintainers

## Context

The Headlamp Polaris Plugin needs to fetch Polaris audit data once and share it across multiple components:
- Dashboard view (cluster overview)
- Namespaces list view
- Namespace detail view (drawer)
- Inline audit sections on resource detail pages
- App bar score badge

Multiple state management approaches are available: Redux, Zustand, Jotai, Recoil, React Context (built-in), or component props with prop drilling.

**Constraints:**
- Headlamp plugin environment does not allow adding external dependencies (peer dependencies only)
- Redux, Zustand, Jotai, Recoil are not available in the plugin runtime
- Plugin must work with Headlamp's existing React context (React 17+)
- Bundle size should remain small (<50 KB)

**Requirements:**
- Share `AuditData` object across all views without duplicate API calls
- Support auto-refresh on user-configurable interval (1-30 minutes)
- Handle loading and error states consistently
- Minimal re-renders (data updates infrequently)

## Decision

Use **React Context API** (built-in, no dependencies) for shared state management.

**Implementation:**
- `PolarisDataProvider` wraps all plugin routes
- `usePolarisDataContext()` hook provides `{ data, loading, error, refresh }` to consumers
- Single fetch shared across all views
- Auto-refresh via `useEffect` + interval timer

## Consequences

### Positive

- ✅ **No additional dependencies** - Plugins cannot add external libraries (Headlamp constraint)
- ✅ **Simple implementation** - Single AuditData object, read-only, no complex mutations
- ✅ **Built into React** - No learning curve, well-documented, stable API
- ✅ **Small bundle impact** - 0 KB additional (built-in feature)
- ✅ **Works with Headlamp** - Compatible with Headlamp's React version and plugin system
- ✅ **TypeScript support** - Full type safety with `React.createContext<T>()`

### Negative

- ❌ **Less powerful for complex state** - No built-in middleware, time-travel debugging, or DevTools
- ❌ **Potential for unnecessary re-renders** - All consumers re-render on context update
  - **Mitigated by:** Data updates every 5-30 minutes (low frequency), memoization not needed
- ❌ **No built-in async handling** - Must implement loading/error states manually
  - **Mitigated by:** Simple `useState` + `useEffect` pattern sufficient

### Neutral

- Performance is excellent for this use case (infrequent updates, small consumer count)
- Context providers work well for read-only or mostly-read state
- Standard React pattern, familiar to contributors

## Alternatives Considered

### Option 1: Redux

**Pros:**
- Powerful state management with middleware
- Excellent DevTools for debugging
- Time-travel debugging
- Well-established patterns

**Cons:**
- Redux is not available as a peer dependency in Headlamp plugins
- Massive overkill for single AuditData object
- Adds significant bundle size (~10-15 KB)
- Requires additional boilerplate (actions, reducers, store)

**Decision:** Rejected (dependency not available, too heavy)

### Option 2: Zustand

**Pros:**
- Lightweight (~1 KB)
- Simple API similar to `useState`
- No provider boilerplate

**Cons:**
- External peer dependency (not available in plugin runtime)
- Still adds bundle size
- Unnecessary for read-only state

**Decision:** Rejected (dependency not available)

### Option 3: Component Props (Prop Drilling)

**Pros:**
- No dependencies
- Explicit data flow
- TypeScript tracks prop types

**Cons:**
- Prop drilling through 5+ component layers (index.tsx → route → view → subcomponent)
- Duplicate fetches if not carefully managed
- Refactoring nightmare if component tree changes
- Each route would need its own fetch logic

**Decision:** Rejected (poor code organization, maintenance burden)

### Option 4: Global Variable / Module State

**Pros:**
- Simple to implement
- No React dependencies

**Cons:**
- No reactivity (components don't re-render on data change)
- No built-in loading/error handling
- Breaks React's declarative model
- Testing difficulties (global mutable state)

**Decision:** Rejected (not idiomatic React, no reactivity)

## Implementation Details

**Context Definition:**
```typescript
interface PolarisDataContextValue {
  data: AuditData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const PolarisDataContext = React.createContext<PolarisDataContextValue | undefined>(undefined);
```

**Provider Implementation:**
```typescript
export function PolarisDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    // Fetch logic here
    // Auto-refresh on interval
  }, [refreshKey]);

  return (
    <PolarisDataContext.Provider value={{ data, loading, error, refresh }}>
      {children}
    </PolarisDataContext.Provider>
  );
}
```

**Consumer Hook:**
```typescript
export function usePolarisDataContext() {
  const context = useContext(PolarisDataContext);
  if (!context) {
    throw new Error('usePolarisDataContext must be used within PolarisDataProvider');
  }
  return context;
}
```

## Validation Criteria

**Success Metrics:**
- ✅ All views share single fetch (verified via network tab - one request per refresh)
- ✅ No duplicate API calls (verified via Kubernetes audit logs)
- ✅ Auto-refresh works correctly (5-30 minute intervals)
- ✅ Loading states consistent across views
- ✅ Error handling consistent across views
- ✅ Bundle size remains <50 KB (currently ~27 KB)

**Tested Scenarios:**
- ✅ Initial load with loading spinner
- ✅ Error handling (403, 404, network errors)
- ✅ Manual refresh via button
- ✅ Auto-refresh interval (configurable via settings)
- ✅ Multiple views consuming same data (no duplicate fetches)
- ✅ Navigation between routes (data persists)

## References

- [React Context API](https://react.dev/reference/react/useContext)
- [React Context Performance](https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions)
- [Headlamp Plugin Constraints](https://headlamp.dev/docs/latest/development/plugins/)
- [Plugin Implementation](../../api/PolarisDataContext.tsx)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-12 | Plugin Team | Initial decision |
