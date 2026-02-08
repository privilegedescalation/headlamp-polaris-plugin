# E2E Smoke Tests

Playwright-based smoke tests that validate the Polaris plugin against a live Headlamp deployment.

## CI

E2E tests run automatically in Gitea Actions on pushes to `main` and pull requests. The workflow (`.gitea/workflows/e2e.yaml`) uses Authentik OIDC for authentication via repo secrets.

### Required Gitea secrets

| Secret               | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `AUTHENTIK_USERNAME` | Authentik email or username for a CI user with Headlamp access |
| `AUTHENTIK_PASSWORD` | Password for that user                                         |

## Running Locally

### Option 1: OIDC via Authentik (same as CI)

```bash
AUTHENTIK_USERNAME=you@example.com AUTHENTIK_PASSWORD=... npm run e2e
```

The default base URL is `https://headlamp.animaniacs.farh.net`. Override with `HEADLAMP_URL` if needed.

### Option 2: K8s bearer token (port-forward)

```bash
kubectl port-forward -n kube-system svc/headlamp 4466:80
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system)
HEADLAMP_URL=http://localhost:4466 npm run e2e
```

Or in headed mode (opens a browser window):

```bash
HEADLAMP_URL=http://localhost:4466 npm run e2e:headed
```

## Environment Variables

| Variable             | Required | Default                                | Description                             |
| -------------------- | -------- | -------------------------------------- | --------------------------------------- |
| `HEADLAMP_URL`       | No       | `https://headlamp.animaniacs.farh.net` | Base URL of the Headlamp instance       |
| `AUTHENTIK_USERNAME` | OIDC     | —                                      | Authentik email/username                |
| `AUTHENTIK_PASSWORD` | OIDC     | —                                      | Authentik password                      |
| `HEADLAMP_TOKEN`     | Token    | —                                      | Kubernetes bearer token (fallback auth) |

Set either `AUTHENTIK_USERNAME` + `AUTHENTIK_PASSWORD` or `HEADLAMP_TOKEN`. OIDC takes priority if both are set.

## What the Tests Validate

- **Sidebar entry** — The Polaris sidebar item appears after login
- **Overview page** — Cluster score and check distribution render correctly
- **Namespaces page** — Table of namespaces loads with clickable links
- **Namespace detail** — Clicking a namespace shows its score and resource table

These are smoke tests against real cluster data. They verify the plugin loads and renders without errors, not specific data values.
