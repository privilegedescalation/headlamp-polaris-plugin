# PRI-324 Spec: Make E2E Workflow Self-Sufficient with RBAC

## Context

PR #123 introduced an RBAC pre-flight check to the E2E workflow. QA (Nancy, acting as QA) verified the "fails fast without RBAC" path works, but found that the "with RBAC passes" path had no green CI evidence — the workflow did not apply RBAC before the pre-flight check.

PR #131 attempted to fix this by adding `kubectl apply` steps and extending the CI runner RBAC, but its merge commit (739db6fe) was reverted by the next commit on main (aa1db921) due to a vulnerability fix PR (#128).

The current E2E workflow on `main` lacks the RBAC apply steps and CI runner permissions needed to make the pre-flight check meaningful.

## Required Changes

### 1. `.github/workflows/e2e.yaml`

Add between the "Setup kubectl" and "Install dependencies" steps:

```yaml
      - name: Apply RBAC for E2E pipeline
        run: |
          set -x
          kubectl apply -f deployment/e2e-ci-runner-rbac.yaml --dry-run=server 2>&1 || true
          kubectl apply -f deployment/e2e-ci-runner-rbac.yaml 2>&1
          echo "exit code: $?"
          echo "Waiting for RBAC propagation..."
          sleep 5
          echo "Verifying CI runner permissions..."
          kubectl auth can-i create roles -n headlamp-dev --as="system:serviceaccount:arc-runners:runners-privilegedescalation-gha-rs-no-permission" 2>&1 || { echo "::error::CI runner still lacks roles permission after propagation wait"; exit 1; }
          set +x

      - name: Apply Polaris dashboard RBAC
        run: kubectl apply -f deployment/polaris-rbac.yaml

      - name: RBAC pre-flight check
        run: |
          echo "Checking RBAC resources..."
          MISSING=0
          kubectl get role polaris-dashboard-proxy-reader -n polaris -o name >/dev/null 2>&1 || MISSING=1
          kubectl get rolebinding polaris-dashboard-proxy-reader -n polaris -o name >/dev/null 2>&1 || MISSING=1
          kubectl auth can-i delete configmaps -n "$E2E_NAMESPACE" --quiet 2>/dev/null || MISSING=1
          if [ "$MISSING" -eq 0 ]; then
            echo "RBAC pre-flight check passed."
          else
            echo "::error::RBAC pre-flight check failed. Missing required permissions."
            exit 1
          fi
```

### 2. `deployment/e2e-ci-runner-rbac.yaml`

Add a new Role + RoleBinding for the `polaris` namespace (from PR #131):

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: e2e-ci-runner-polaris
  namespace: polaris
rules:
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["roles", "rolebindings"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: e2e-ci-runner-polaris
  namespace: polaris
subjects:
  - kind: ServiceAccount
    name: runners-privilegedescalation-gha-rs-no-permission
    namespace: arc-runners
roleRef:
  kind: Role
  name: e2e-ci-runner-polaris
  apiGroup: rbac.authorization.k8s.io
```

And add to the existing `e2e-ci-runner` Role in the `headlamp-dev` namespace:
```yaml
  # Apply Polaris dashboard RBAC in the polaris namespace
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["roles", "rolebindings"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
```

## Acceptance Criteria

- [ ] Workflow applies `deployment/e2e-ci-runner-rbac.yaml` before the pre-flight check
- [ ] Workflow applies `deployment/polaris-rbac.yaml` before the pre-flight check
- [ ] CI runner has RBAC to apply the manifests (added via new Role+RoleBinding in polaris namespace)
- [ ] E2E pipeline passes on the PR branch (proof of green path)
- [ ] `kubectl get … --quiet` flag removed (QA nit)
- [ ] `MISSING_ROLE`/`MISSING_ROLEBINDING` collapsed to single `MISSING` flag (QA nit)

## Definition of Done

PR #123 QA changes-requested are addressed: the workflow is self-sufficient (applies its own RBAC), the green path is demonstrated, and QA review is re-requested.
