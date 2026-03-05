# ADR-004: Browser localStorage for User Settings

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Plugin maintainers

## Context

The plugin has two user-configurable settings:

1. **Auto-refresh interval** (1-30 minutes, default 5 minutes) - how often to re-fetch Polaris audit data
2. **Polaris dashboard URL** - endpoint for the Polaris dashboard service (supports custom namespaces/service names and external instances)

These are per-user preferences, not cluster configuration. They should persist across browser sessions and page reloads.

Several storage mechanisms are available:

- Browser `localStorage` - simple key-value store, persistent, synchronous API
- Headlamp `ConfigStore` API - backed by Redux, reactive, integrated with Headlamp's state management
- React state only - in-memory, lost on page reload
- URL query parameters - visible in URL, lost on navigation

**Constraints:**

- Settings need to be reactive: the `PolarisDataProvider` must detect changes made on the settings page
- Headlamp provides `registerPluginSettings` which renders a settings component - the settings page and the data provider are separate component trees
- Only two scalar values need to be stored

**Requirements:**

- Persist settings across browser sessions and page reloads
- React to setting changes without requiring a full page reload
- Simple implementation for two scalar values
- Work with Headlamp's `registerPluginSettings` API

## Decision

Use **browser `localStorage`** directly for persisting plugin settings.

**Implementation:**

- Refresh interval stored at key `polaris-plugin-refresh-interval` (value in minutes as string)
- Dashboard URL stored at key `polaris-plugin-dashboard-url` (URL string or empty for default)
- `PolarisSettings` component (registered via `registerPluginSettings`) reads/writes these keys
- `PolarisDataProvider` polls `localStorage` via `setInterval` every 1 second to detect setting changes
- Helper functions in `polaris.ts` (`getRefreshInterval()`, `getPolarisApiPath()`) encapsulate localStorage access

## Consequences

### Positive

- ✅ **Simple and well-understood API** - `localStorage.getItem`/`setItem` is straightforward
- ✅ **Persists across browser sessions** - Data survives page reloads, tab closes, browser restarts
- ✅ **No dependency on Headlamp store internals** - Decoupled from Headlamp's Redux implementation
- ✅ **Works with `registerPluginSettings`** - Settings page and data provider communicate via shared localStorage keys
- ✅ **Minimal code** - No state management boilerplate for two simple values

### Negative

- ❌ **Not reactive by default** - localStorage has no built-in change notification within the same tab
  - **Mitigated by:** 1-second polling interval in `PolarisDataProvider` to detect changes
- ❌ **Settings are browser-local** - Not synced across devices or browsers
  - **Mitigated by:** These are user preferences, browser-local storage is appropriate
- ❌ **No type safety on stored values** - All values stored as strings
  - **Mitigated by:** Helper functions with `parseInt` and default values handle type conversion

### Neutral

- localStorage has a 5-10 MB limit per origin, more than sufficient for two string values
- The 1-second polling interval has negligible performance impact (reading two string keys)
- The `storage` event could detect cross-tab changes but does not fire for same-tab writes

## Alternatives Considered

### Option 1: Headlamp ConfigStore API

**Pros:**

- Integrated with Headlamp's Redux store
- Reactive (Redux state changes trigger re-renders)
- Type-safe with TypeScript

**Cons:**

- Couples plugin to Headlamp's internal Redux store implementation
- More complex API for two scalar values
- ConfigStore API may change across Headlamp versions

**Decision:** Not chosen (localStorage is simpler for two scalar values, avoids coupling to Headlamp's Redux internals)

### Option 2: React State Only (No Persistence)

**Pros:**

- Simplest implementation
- Fully reactive
- No side effects

**Cons:**

- Settings lost on page reload - users must reconfigure every session
- Poor user experience for frequently changed settings

**Decision:** Rejected (settings must persist across page reloads)

### Option 3: URL Query Parameters

**Pros:**

- Shareable via URL
- No storage API needed

**Cons:**

- Lost on navigation to different routes
- Clutters the URL
- Not suitable for persistent settings

**Decision:** Rejected (does not persist across navigation)

## References

- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Headlamp Plugin Settings](https://headlamp.dev/docs/latest/development/plugins/)
- [Settings Component](../../../src/components/PolarisSettings.tsx)
- [Data Context](../../../src/api/PolarisDataContext.tsx)

## Revision History

| Date       | Author      | Change           |
| ---------- | ----------- | ---------------- |
| 2026-03-05 | Plugin Team | Initial decision |
