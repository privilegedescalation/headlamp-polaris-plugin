# E2E Smoke Tests

Playwright-based smoke tests that validate the Polaris plugin against a live Headlamp deployment.

## CI

E2E tests run automatically in GitHub Actions on pushes to `main` and pull requests. The workflow (`.github/workflows/e2e.yaml`) uses either Authentik OIDC or token-based authentication via repository secrets.

### Required GitHub Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret               | Required | Description                                                    |
| -------------------- | -------- | -------------------------------------------------------------- |
| `HEADLAMP_URL`       | Optional | Headlamp instance URL (defaults to `https://headlamp.animaniacs.farh.net`) |
| `AUTHENTIK_USERNAME` | OIDC     | Authentik email or username for a CI user with Headlamp access |
| `AUTHENTIK_PASSWORD` | OIDC     | Password for that user                                         |
| `HEADLAMP_TOKEN`     | Token    | Kubernetes service account token (alternative to OIDC)         |

Set either `AUTHENTIK_USERNAME` + `AUTHENTIK_PASSWORD` **or** `HEADLAMP_TOKEN`. OIDC takes priority if both are set.

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

## Test Coverage

### Current Tests (`polaris.spec.ts`)

1. **`sidebar contains Polaris entry`**
   - Verifies Polaris appears in the navigation sidebar
   - Ensures plugin successfully registered sidebar entry

2. **`overview page renders cluster score`**
   - Navigates to `/c/main/polaris`
   - Checks for "Polaris — Overview" heading
   - Verifies cluster score percentage is displayed
   - Validates data fetching and rendering

3. **`namespaces page renders table with namespace buttons`**
   - Navigates to `/c/main/polaris/namespaces`
   - Checks for "Polaris — Namespaces" heading
   - Verifies table is visible with at least one row
   - Ensures namespace buttons are clickable

4. **`namespace detail drawer opens from table button`**
   - Clicks first namespace button in table
   - Verifies drawer opens with namespace name in heading
   - Checks "Namespace Score" section is visible
   - Confirms "Resources" table is displayed
   - Validates URL hash is updated with namespace name

5. **`namespace detail drawer closes with Escape key`**
   - Opens namespace drawer
   - Presses Escape key
   - Verifies drawer closes
   - Checks URL hash is cleared

6. **`namespace detail drawer opens from URL hash`**
   - Navigates directly to `/c/main/polaris/namespaces#<namespace>`
   - Verifies drawer automatically opens
   - Checks namespace details are displayed

## Prerequisites

### Cluster Requirements

1. **Polaris Deployment**
   ```bash
   # Verify Polaris is running
   kubectl -n polaris get pods
   kubectl -n polaris get svc polaris-dashboard
   ```

2. **Polaris Audit Data**
   ```bash
   # Check if Polaris has generated audit results
   kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json | jq '.AuditTime'
   ```

3. **RBAC Permissions**
   - Headlamp service account (or test user) needs `get` on `services/proxy` for `polaris-dashboard`
   - See main README for RBAC setup

### Local Setup

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Create .env file (optional, for persistent config)
cp .env.example .env

# 3. Set environment variables
export HEADLAMP_URL=https://your-headlamp-instance.com
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system)

# 4. Run tests
npm run e2e
```

## Debugging

### Run in Headed Mode

See the browser UI while tests run:

```bash
npm run e2e:headed
```

### Enable Debug Mode

Step through tests with Playwright Inspector:

```bash
npx playwright test --debug
```

### Generate Trace

Record full trace for failed tests:

```bash
npx playwright test --trace on
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Screenshot on Failure

Tests automatically capture screenshots on failure in `test-results/`

### Common Issues

**Auth fails with "Sign In button not found":**
- Check HEADLAMP_URL is correct
- Verify Headlamp is accessible
- Ensure OIDC is configured if using Authentik

**Polaris sidebar entry not found:**
- Plugin may not be installed: Check Settings → Plugins in Headlamp
- Plugin may have failed to load: Check browser console
- Clear browser cache and hard refresh

**Cluster score not displayed:**
- Polaris may not have audit data yet
- Check Polaris is running: `kubectl -n polaris get pods`
- Verify service proxy: `kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`

**Namespace table empty:**
- Polaris hasn't run audit yet (wait a few minutes)
- Check Polaris logs: `kubectl -n polaris logs -l app.kubernetes.io/name=polaris`

## Writing New Tests

### Example: Testing Plugin Settings

```typescript
test('plugin settings page shows Polaris configuration', async ({ page }) => {
  await page.goto('/c/main/settings/plugins');

  // Find and click Polaris plugin
  await page.getByText('headlamp-polaris').click();

  // Check settings are visible
  await expect(page.getByText('Polaris Settings')).toBeVisible();
  await expect(page.getByText('Refresh Interval')).toBeVisible();
  await expect(page.getByText('Dashboard URL')).toBeVisible();
});
```

### Example: Testing App Bar Badge

```typescript
test('app bar displays Polaris score badge', async ({ page }) => {
  await page.goto('/c/main');

  // Badge should be visible in app bar
  const badge = page.getByRole('button', { name: /Polaris: \d+%/ });
  await expect(badge).toBeVisible();

  // Clicking should navigate to overview
  await badge.click();
  await expect(page).toHaveURL(/\/c\/main\/polaris$/);
});
```

### Example: Testing Dark Mode

```typescript
test('plugin UI adapts to dark mode', async ({ page }) => {
  await page.goto('/c/main/polaris');

  // Toggle dark mode
  await page.getByRole('button', { name: /theme/i }).click();

  // Check background color changes
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(18, 18, 18)');

  // Plugin components should adapt
  const sectionBox = page.locator('[class*="MuiPaper"]').first();
  await expect(sectionBox).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
```

## CI/CD Integration

Tests run automatically in GitHub Actions on pushes to `main` and pull requests. See `.github/workflows/e2e.yaml` for workflow configuration.

### Required Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables → Actions):

- `HEADLAMP_URL` (optional): Headlamp instance URL
- `AUTHENTIK_USERNAME` + `AUTHENTIK_PASSWORD` (for OIDC auth)
- OR `HEADLAMP_TOKEN` (for token-based auth)

### Workflow Overview

1. Checkout code
2. Setup Node.js 20 with npm cache
3. Install dependencies (`npm ci`)
4. Install Playwright browsers (`chromium` only)
5. Run auth setup (creates session in `e2e/.auth/state.json`)
6. Run all E2E tests
7. Upload artifacts on failure:
   - `playwright-report/` - HTML test report
   - `test-results/` - Screenshots, traces, videos

### Manual Trigger

You can manually trigger E2E tests from GitHub Actions:
1. Go to Actions → E2E Tests
2. Click "Run workflow"
3. Select branch and run

## Best Practices

1. **Use semantic selectors**: `getByRole`, `getByText` over CSS selectors
2. **Wait for visibility**: Use `await expect(...).toBeVisible()` instead of `waitForTimeout`
3. **Keep tests independent**: Each test should work in isolation
4. **Test user flows**: Complete journeys, not just page loads
5. **Clean up state**: Close drawers/modals after tests
6. **Use storage state**: Reuse auth across tests (already configured)
7. **Parallelize carefully**: Currently disabled due to shared state

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Headlamp Plugin Development](https://headlamp.dev/docs/latest/development/plugins/)
- [Project Main README](../README.md)
