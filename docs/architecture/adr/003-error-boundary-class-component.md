# ADR-003: Error Boundary as Class Component Exception

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Plugin maintainers

## Context

The plugin follows a strict "functional components only" convention (see CLAUDE.md). However, React error boundaries require the `getDerivedStateFromError` and `componentDidCatch` lifecycle methods, which are only available on class components. As of React 18, there is no hooks-based error boundary API, and the React team has not announced a timeline for one.

The plugin registers components at multiple Headlamp integration points:

- Routes (dashboard, namespaces list)
- Detail view sections (Deployment, StatefulSet, DaemonSet, Job, CronJob)
- App bar action (score badge)
- Plugin settings page

An unhandled error in any one of these registered components would crash the entire Headlamp UI, not just the plugin. This is because Headlamp renders plugin components inline within its own React tree.

**Constraints:**

- React does not support error boundaries via hooks or functional components
- The `react-error-boundary` library is not available as a peer dependency in Headlamp plugins
- Plugin errors must not crash the host Headlamp application

**Requirements:**

- Catch and contain errors in all plugin-registered components
- Provide user-friendly error display with recovery option
- Isolate failures per registration point (an error in the app bar badge should not affect the dashboard view)

## Decision

Define **`PolarisErrorBoundary`** as a class component directly in `index.tsx`. This is the sole exception to the functional-component-only convention.

**Implementation:**

- `PolarisErrorBoundary` is a React class component with `getDerivedStateFromError` and `componentDidCatch`
- Every registered component (routes, detail sections, app bar action) is wrapped in this boundary
- On error, displays a user-friendly fallback with an option to retry
- Error details are logged to the console for debugging
- The boundary is minimal (~30 lines) and co-located in `index.tsx` to minimize the convention violation

## Consequences

### Positive

- ✅ **Prevents plugin errors from crashing Headlamp** - Errors are caught and contained within the boundary
- ✅ **User-friendly error display** - Shows a clear message with recovery option instead of a blank screen
- ✅ **Isolated per registration point** - Each registered component has its own boundary instance
- ✅ **No external dependencies** - Uses built-in React class component API
- ✅ **Minimal implementation** - Small class component, easy to understand and maintain

### Negative

- ❌ **Breaks functional-only convention** - One class component in an otherwise functional codebase
  - **Mitigated by:** Kept minimal and co-located in `index.tsx` with clear documentation of why
- ❌ **Class component syntax less familiar to contributors** - Modern React developers may not be fluent in class components
  - **Mitigated by:** The boundary is simple (no complex state, no lifecycle methods beyond error handling)

### Neutral

- This is a well-known React limitation acknowledged by the React team
- Many React projects that otherwise use functional components make this same exception for error boundaries
- The pattern is explicitly documented in the React documentation

## Alternatives Considered

### Option 1: No Error Boundary

**Pros:**

- No class component needed
- Simpler code

**Cons:**

- Plugin errors would crash the entire Headlamp UI
- Users would see a blank screen with no recovery option
- Poor user experience and potential data loss in other Headlamp features

**Decision:** Rejected (unacceptable risk of crashing host application)

### Option 2: react-error-boundary Library

**Pros:**

- Provides a functional component API for error boundaries
- Well-maintained, widely used library
- Supports error recovery and reset

**Cons:**

- External dependency not available in Headlamp plugin runtime
- Cannot add peer dependencies that Headlamp does not provide

**Decision:** Rejected (dependency not available in plugin environment)

### Option 3: Wait for React Hooks-Based Error Boundary API

**Pros:**

- Would maintain functional-only convention
- Official React solution

**Cons:**

- No timeline from the React team for this feature
- Plugin needs error boundaries now, not at some future date
- May never be implemented (React team has not committed to this)

**Decision:** Rejected (no timeline, cannot ship without error boundaries)

## References

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React getDerivedStateFromError](https://react.dev/reference/react/Component#static-getderivedstatefromerror)
- [Plugin Implementation](../../../src/index.tsx)

## Revision History

| Date       | Author      | Change           |
| ---------- | ----------- | ---------------- |
| 2026-03-05 | Plugin Team | Initial decision |
