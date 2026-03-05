# ADR-005: Annotation-Based Exemption Management

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Plugin maintainers

## Context

Polaris allows exempting specific workloads from audit checks. When a workload is exempt, Polaris skips all audit checks for that resource. The exemption mechanism uses the annotation `polaris.fairwinds.com/exempt=true` on the workload resource.

The plugin needs to let users manage these exemptions directly from the Headlamp UI. Several approaches were considered:

1. Use Polaris's native annotation-based exemption mechanism
2. Create a separate exemption ConfigMap
3. Define a custom ExemptionPolicy CRD
4. Read-only display with kubectl instructions

**Constraints:**

- Polaris only recognizes `polaris.fairwinds.com/exempt` annotations on workload resources
- The plugin is otherwise read-only (this would be the only write operation)
- Users need appropriate RBAC permissions to patch workload resources
- Supported workload types: Deployments, StatefulSets, DaemonSets, Jobs, CronJobs

**Requirements:**

- Allow users to toggle exemptions for workloads from the Headlamp UI
- Use a mechanism that Polaris actually respects (exemptions must take effect on next scan)
- Support all workload types that Polaris audits
- Respect Kubernetes RBAC (only authorized users can manage exemptions)

## Decision

Use **Polaris's native annotation-based exemption mechanism**. The `ExemptionManager` component patches `polaris.fairwinds.com/exempt` annotations onto workload resources via `ApiProxy.request`.

**Implementation:**

- `ExemptionManager` component in `ExemptionManager.tsx` provides a toggle UI for each workload
- Exemptions are applied via `ApiProxy.request` with `method: 'PATCH'` and `Content-Type: application/strategic-merge-patch+json`
- Patch payload sets `metadata.annotations["polaris.fairwinds.com/exempt"]` to `"true"` or removes the annotation
- This is the only write operation in the entire plugin
- RBAC is enforced by Kubernetes - users without `patch` permission on the workload resource will receive a 403 error

## Consequences

### Positive

- ✅ **Uses Polaris's own exemption mechanism** - No custom storage or translation layer needed
- ✅ **Exemptions visible in standard kubectl output** - `kubectl get deployment -o yaml` shows the annotation
- ✅ **No additional CRDs or ConfigMaps** - No custom resources to manage or clean up
- ✅ **Polaris automatically respects annotations** - Exemptions take effect on the next audit scan
- ✅ **Standard Kubernetes pattern** - Annotations are the idiomatic way to attach metadata to resources

### Negative

- ❌ **Requires write RBAC on workload resources** - Users need `patch` permission on deployments, statefulsets, etc.
  - **Mitigated by:** RBAC scoping - only users with patch permission can manage exemptions; UI shows clear error for 403
- ❌ **Annotation changes not versioned or auditable** - Beyond standard Kubernetes resource history
  - **Mitigated by:** Kubernetes audit logging captures annotation patches; resource `metadata.managedFields` tracks changes
- ❌ **Only supports full-resource exemption** - Cannot exempt individual checks (Polaris limitation)
  - **Mitigated by:** This matches Polaris's own annotation-level granularity

### Neutral

- Strategic merge patch is the standard Kubernetes patching strategy for adding/removing annotations
- The annotation key (`polaris.fairwinds.com/exempt`) is defined by Polaris and unlikely to change
- Exemption state is stored on the workload resource itself, so it moves with the resource if migrated

## Alternatives Considered

### Option 1: Separate Exemption ConfigMap

**Pros:**

- Centralizes all exemptions in one place
- Does not require write access to workload resources
- Easy to audit all exemptions at once

**Cons:**

- Polaris does not read exemptions from ConfigMaps - it only checks annotations
- Would require a custom reconciliation controller to sync ConfigMap entries to annotations
- Adds operational complexity

**Decision:** Rejected (Polaris does not support ConfigMap-based exemptions)

### Option 2: Custom ExemptionPolicy CRD

**Pros:**

- Dedicated resource type for exemption management
- Could support per-check exemptions, time-based exemptions, etc.
- Clean separation of concerns

**Cons:**

- Over-engineering for what is essentially an annotation toggle
- Would require a custom controller to reconcile CRDs to annotations
- Adds CRD installation as a prerequisite
- Polaris still needs the annotation, so the CRD would be an indirection layer

**Decision:** Rejected (over-engineering for annotation toggle, would require a controller)

### Option 3: Read-Only Display with kubectl Instructions

**Pros:**

- No write operations in the plugin
- No RBAC requirements beyond read access
- Simpler implementation

**Cons:**

- Poor user experience - users must switch to terminal to manage exemptions
- Defeats the purpose of a UI plugin
- Error-prone (users may mistype annotation keys)

**Decision:** Rejected (poor UX compared to in-UI toggle)

## References

- [Polaris Exemptions Documentation](https://polaris.docs.fairwinds.com/customization/exemptions/)
- [Kubernetes Annotations](https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/)
- [Strategic Merge Patch](https://kubernetes.io/docs/tasks/manage-kubernetes-resources/update-api-object-kubectl-patch/#use-a-strategic-merge-patch-to-update-a-deployment)
- [Plugin Implementation](../../../src/components/ExemptionManager.tsx)

## Revision History

| Date       | Author      | Change           |
| ---------- | ----------- | ---------------- |
| 2026-03-05 | Plugin Team | Initial decision |
