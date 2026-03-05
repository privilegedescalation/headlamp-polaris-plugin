# ADR-002: Service Proxy as Single Data Source

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Plugin maintainers

## Context

The Polaris plugin needs audit data from the Polaris dashboard. Polaris dashboard exposes a `/results.json` endpoint containing pre-computed audit results for all workloads in the cluster.

Several approaches were considered for obtaining this data:

1. Query Kubernetes resources directly and re-implement Polaris audit logic
2. Use the Polaris CLI as a sidecar container
3. Use the Polaris dashboard's REST API via Kubernetes service proxy
4. Embed Polaris as a Go/JS library

The service proxy approach uses the Kubernetes API server's built-in service proxy capability to reach the Polaris dashboard at `/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`. This means the plugin receives pre-computed audit results without needing to understand Polaris internals.

**Constraints:**

- Headlamp plugins can make API calls via `ApiProxy.request()` (proxied through the Headlamp backend) or direct `fetch()` for external URLs
- The Polaris dashboard service name, namespace, and port may vary across cluster setups
- Some users may run Polaris externally (not in-cluster)

**Requirements:**

- Retrieve all audit data in a single API call
- Support configurable endpoint URL for different cluster configurations
- Support external Polaris instances via full HTTP/HTTPS URLs
- Work through existing Kubernetes RBAC without additional configuration

## Decision

Use **`ApiProxy.request()`** to fetch from the Polaris dashboard service proxy as the single data source for all audit data.

**Implementation:**

- Default endpoint: `/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`
- URL is configurable via plugin settings stored in `localStorage` (key: `polaris-plugin-dashboard-url`)
- For full URLs starting with `http://` or `https://`, use browser `fetch()` directly to support external Polaris instances
- `getPolarisApiPath()` in `polaris.ts` resolves the configured URL, with `isFullUrl()` determining the fetch strategy
- Single fetch shared across all views via `PolarisDataProvider` (see ADR-001)

## Consequences

### Positive

- ✅ **Single API call gets all audit data** - One request to `/results.json` returns scores for every workload
- ✅ **No need to understand Polaris internals** - Plugin receives pre-computed results, no audit logic duplication
- ✅ **Works through existing K8s RBAC** - Service proxy uses standard Kubernetes RBAC (`get` on `services/proxy`)
- ✅ **Configurable endpoint** - Users can customize namespace, service name, or point to an external instance
- ✅ **Minimal plugin complexity** - No CRD watches, no custom controllers, no library dependencies

### Negative

- ❌ **Requires Polaris dashboard to be deployed and accessible** - Plugin has no data without the dashboard
  - **Mitigated by:** Clear error messages guiding users to install Polaris (404/503 → install guidance)
- ❌ **Single point of failure** - If the dashboard service is down, the plugin shows no data
  - **Mitigated by:** Status-code-specific error messages (403 → RBAC guidance, 404/503 → deployment guidance)
- ❌ **Dashboard must be running continuously** - Unlike CRD-based approaches where data persists
  - **Mitigated by:** Polaris dashboard is typically deployed as a long-running service

### Neutral

- The Polaris dashboard is a lightweight Go service with minimal resource requirements
- Service proxy is a standard Kubernetes pattern used by many tools (kubectl port-forward, dashboard proxying)
- The configurable URL approach supports both in-cluster and external Polaris deployments

## Alternatives Considered

### Option 1: Query Polaris CRDs Directly

**Pros:**

- No dependency on Polaris dashboard being running
- Data persists in CRDs even if dashboard restarts

**Cons:**

- Polaris audit logic is complex and would need to be duplicated in the plugin
- Would require watching multiple CRD types
- Plugin would need to be updated whenever Polaris changes its audit rules

**Decision:** Rejected (would duplicate Polaris internals, maintenance burden)

### Option 2: Use Polaris CLI as a Sidecar

**Pros:**

- CLI has full audit capability
- Could run audits on-demand

**Cons:**

- Adds operational complexity (sidecar container management)
- Not suitable for a browser-based plugin (CLI runs server-side)
- Would require a separate backend service to bridge CLI output to the plugin

**Decision:** Rejected (operational complexity, not suitable for plugin architecture)

### Option 3: Embed Polaris as a Library

**Pros:**

- Full control over audit execution
- No external service dependency

**Cons:**

- Polaris is a Go library, not available in JavaScript/TypeScript plugin runtime
- Would massively increase bundle size
- Would duplicate the entire Polaris engine

**Decision:** Rejected (not available in plugin runtime, massive dependency)

## References

- [Kubernetes Service Proxy](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster-services/)
- [Polaris Dashboard](https://polaris.docs.fairwinds.com/dashboard/)
- [Plugin Implementation](../../api/polaris.ts)
- [Data Context](../../api/PolarisDataContext.tsx)

## Revision History

| Date       | Author      | Change           |
| ---------- | ----------- | ---------------- |
| 2026-03-05 | Plugin Team | Initial decision |
