# Testing Guide

Comprehensive guide to testing the Headlamp Polaris Plugin, covering unit tests, E2E tests, and CI/CD integration.

## Table of Contents

- [Overview](#overview)
- [Unit Testing](#unit-testing)
- [E2E Testing](#e2e-testing)
- [CI/CD Integration](#cicd-integration)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)
- [Debugging](#debugging)

---

## Overview

The Headlamp Polaris Plugin uses a multi-layered testing approach:

| Test Type         | Framework  | Purpose                                                 | Location                |
| ----------------- | ---------- | ------------------------------------------------------- | ----------------------- |
| **Unit Tests**    | Vitest     | Test individual functions and components in isolation   | `src/**/*.test.ts(x)`   |
| **E2E Tests**     | Playwright | Test complete user flows against live Headlamp instance | `e2e/*.spec.ts`         |
| **Type Checking** | TypeScript | Ensure type safety across codebase                      | `tsc --noEmit`          |
| **Linting**       | ESLint     | Enforce code style and catch common errors              | `eslint src/`           |
| **Formatting**    | Prettier   | Maintain consistent code formatting                     | `prettier --check src/` |

### Test Philosophy

1. **Unit tests** focus on business logic (data parsing, score calculation, filtering)
2. **E2E tests** validate user-facing functionality (navigation, rendering, interactions)
3. **Both** run automatically in CI on every commit
4. **Coverage** targets meaningful tests, not arbitrary percentages

---

## Unit Testing

### Framework: Vitest

Vitest is a fast, modern testing framework compatible with Jest APIs but optimized for Vite-based projects.

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run specific test file
npx vitest src/api/polaris.test.ts

# Run with coverage
npx vitest --coverage
```

### Test Structure

Unit tests are colocated with source files:

```
src/
├── api/
│   ├── polaris.ts
│   ├── polaris.test.ts          # Unit tests for polaris.ts
│   ├── PolarisDataContext.tsx
│   └── PolarisDataContext.test.tsx
└── components/
    ├── DashboardView.tsx
    └── DashboardView.test.tsx
```

### Example: Testing Utility Functions

**File:** `src/api/polaris.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { countResults, computeScore, getNamespaces, filterResultsByNamespace } from './polaris';

describe('countResults', () => {
  it('counts passing, warning, danger, and skipped results correctly', () => {
    const data = {
      Results: [
        {
          Name: 'test-deployment',
          Namespace: 'default',
          Kind: 'Deployment',
          Results: {
            'check-1': { Success: true, Severity: 'warning' },
            'check-2': { Success: false, Severity: 'danger' },
            'check-3': { Success: false, Severity: 'ignore' }, // skipped
          },
          CreatedTime: '2024-01-01T00:00:00Z',
        },
      ],
    };

    const counts = countResults(data);

    expect(counts).toEqual({
      total: 3,
      pass: 1,
      warning: 0,
      danger: 1,
      skipped: 1,
    });
  });

  it('handles empty results', () => {
    const data = { Results: [] };
    const counts = countResults(data);

    expect(counts).toEqual({
      total: 0,
      pass: 0,
      warning: 0,
      danger: 0,
      skipped: 0,
    });
  });
});

describe('computeScore', () => {
  it('returns 0 for zero total checks', () => {
    expect(computeScore({ total: 0, pass: 0, warning: 0, danger: 0, skipped: 0 })).toBe(0);
  });

  it('calculates percentage correctly', () => {
    expect(computeScore({ total: 100, pass: 75, warning: 20, danger: 5, skipped: 0 })).toBe(75);
  });

  it('rounds to nearest integer', () => {
    expect(computeScore({ total: 3, pass: 2, warning: 1, danger: 0, skipped: 0 })).toBe(67);
  });
});
```

### Example: Testing React Components

**File:** `src/components/DashboardView.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardView } from './DashboardView';
import * as PolarisDataContext from '../api/PolarisDataContext';

describe('DashboardView', () => {
  it('renders loading state', () => {
    vi.spyOn(PolarisDataContext, 'usePolarisDataContext').mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<DashboardView />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.spyOn(PolarisDataContext, 'usePolarisDataContext').mockReturnValue({
      data: null,
      loading: false,
      error: '403 Forbidden',
      refresh: vi.fn(),
    });

    render(<DashboardView />);
    expect(screen.getByText(/403 Forbidden/i)).toBeInTheDocument();
  });

  it('displays cluster score when data is loaded', () => {
    const mockData = {
      DisplayName: 'test-cluster',
      ClusterInfo: { Version: '1.27', Nodes: 3, Pods: 100, Namespaces: 10, Controllers: 50 },
      Results: [
        /* ... */
      ],
    };

    vi.spyOn(PolarisDataContext, 'usePolarisDataContext').mockReturnValue({
      data: mockData,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<DashboardView />);
    expect(screen.getByText(/Cluster Score/i)).toBeInTheDocument();
  });
});
```

### What to Unit Test

✅ **Do test:**

- Pure functions (score calculation, filtering, data transformation)
- Data parsing and validation
- Utility functions
- Error handling logic
- Edge cases (empty arrays, null values, invalid input)

❌ **Don't test:**

- Third-party libraries (Headlamp, React)
- Simple prop passing
- Trivial getters/setters
- Implementation details (internal state)

---

## E2E Testing

### Framework: Playwright

Playwright provides cross-browser testing with auto-wait, network interception, and screenshot/video capture.

### Running E2E Tests

```bash
# Run all E2E tests (headless)
npm run e2e

# Run with browser visible (headed mode)
npm run e2e:headed

# Run specific test file
npx playwright test e2e/polaris.spec.ts

# Debug mode (step through tests)
npx playwright test --debug

# Generate trace for debugging
npx playwright test --trace on
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Prerequisites

**1. Headlamp Instance**

E2E tests require a running Headlamp instance with:

- Polaris plugin installed (version being tested)
- Polaris dashboard deployed and accessible
- RBAC configured (service proxy permissions)

**2. Authentication**

Choose one of two authentication methods:

**Option A: OIDC via Authentik**

```bash
export AUTHENTIK_USERNAME="user@example.com"
export AUTHENTIK_PASSWORD="password"
export HEADLAMP_URL="https://headlamp.example.com"
npm run e2e
```

**Option B: Kubernetes Token**

```bash
# Create token
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system --duration=24h)

# Port-forward for local testing
kubectl port-forward -n kube-system svc/headlamp 4466:80

# Run tests
HEADLAMP_URL=http://localhost:4466 npm run e2e
```

**3. Environment Variables**

Create `.env` file (optional, for persistent config):

```bash
cp .env.example .env
```

Edit `.env`:

```bash
HEADLAMP_URL=https://headlamp.example.com
HEADLAMP_TOKEN=eyJhbGciOi...
# OR
AUTHENTIK_USERNAME=user@example.com
AUTHENTIK_PASSWORD=secret
```

### Test Coverage

#### Current E2E Tests

**File:** `e2e/polaris.spec.ts`

| Test                                          | Description                     | Validates                     |
| --------------------------------------------- | ------------------------------- | ----------------------------- |
| `sidebar contains Polaris entry`              | Polaris appears in sidebar      | Plugin registration           |
| `overview page renders cluster score`         | Score displayed on overview     | Data fetching, rendering      |
| `namespaces page renders table`               | Namespace table loads           | Data parsing, table rendering |
| `namespace detail drawer opens`               | Clicking namespace shows drawer | Navigation, drawer UI         |
| `namespace detail drawer closes with Escape`  | Keyboard shortcut works         | Keyboard navigation           |
| `namespace detail drawer opens from URL hash` | Direct URL navigation           | URL routing, deep linking     |

**File:** `e2e/settings.spec.ts`

| Test                                 | Description         | Validates                   |
| ------------------------------------ | ------------------- | --------------------------- |
| `plugin settings page is accessible` | Settings page loads | Settings registration       |
| `refresh interval can be changed`    | Dropdown works      | User preference persistence |
| `dashboard URL can be customized`    | Input field works   | URL configuration           |
| `connection test button works`       | Test functionality  | API connectivity validation |

**File:** `e2e/appbar.spec.ts`

| Test                                   | Description                     | Validates           |
| -------------------------------------- | ------------------------------- | ------------------- |
| `app bar displays Polaris badge`       | Badge visible in header         | App bar integration |
| `badge shows cluster score`            | Score matches dashboard         | Data consistency    |
| `clicking badge navigates to overview` | Navigation works                | App bar action      |
| `badge color reflects score`           | Red/yellow/green based on score | Visual feedback     |

### Writing E2E Tests

**Example: Testing User Flow**

```typescript
import { test, expect } from '@playwright/test';

test('user can view namespace details and navigate back', async ({ page }) => {
  // Navigate to namespaces page
  await page.goto('/c/main/polaris/namespaces');
  await expect(page.getByText('Polaris — Namespaces')).toBeVisible();

  // Click first namespace
  const firstNamespace = page.locator('table tbody tr').first();
  const namespaceName = await firstNamespace.locator('td').first().textContent();
  await firstNamespace.getByRole('button').click();

  // Drawer should open
  await expect(page.getByText(`Polaris — ${namespaceName}`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#${namespaceName}`));

  // Close drawer with Escape
  await page.keyboard.press('Escape');
  await expect(page.getByText(`Polaris — ${namespaceName}`)).not.toBeVisible();
  await expect(page).toHaveURL(/namespaces$/);
});
```

**Example: Testing Dark Mode Adaptation**

```typescript
test('plugin adapts to dark mode', async ({ page }) => {
  await page.goto('/c/main/polaris/namespaces');

  // Toggle dark mode
  await page.getByLabel(/theme/i).click();

  // Open namespace drawer
  const firstNamespace = page.locator('table tbody tr button').first();
  await firstNamespace.click();

  // Drawer background should be dark
  const drawer = page.locator('[style*="position: fixed"][style*="right: 0"]');
  await expect(drawer).toHaveCSS('background-color', /rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
});
```

### Debugging E2E Tests

**1. Headed Mode (See Browser)**

```bash
npm run e2e:headed
```

**2. Debug Mode (Step Through Tests)**

```bash
npx playwright test --debug
```

This opens Playwright Inspector where you can:

- Step through each test action
- Inspect page state
- Edit test selectors live

**3. Screenshots on Failure**

Screenshots are automatically saved to `test-results/` on failure:

```bash
test-results/
└── polaris-overview-page-renders-cluster-score/
    ├── test-failed-1.png
    └── trace.zip
```

**4. Trace Viewer**

Record full trace (DOM snapshots, network, console):

```bash
npx playwright test --trace on
npx playwright show-trace test-results/<test-name>/trace.zip
```

**5. Verbose Logging**

```bash
DEBUG=pw:api npx playwright test
```

---

## CI/CD Integration

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yaml`)

Runs on every push to `main` and all pull requests:

```yaml
jobs:
  lint-and-test:
    steps:
      - Build plugin
      - Lint (eslint)
      - Type-check (tsc)
      - Format check (prettier)
      - Run unit tests
```

#### E2E Workflow (`.github/workflows/e2e.yaml`)

Runs E2E tests against live Headlamp instance:

```yaml
jobs:
  e2e:
    steps:
      - Install dependencies
      - Install Playwright browsers
      - Run auth setup
      - Run E2E tests
      - Upload artifacts on failure
```

### Required GitHub Secrets

Configure in GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret               | Required | Description                                             |
| -------------------- | -------- | ------------------------------------------------------- |
| `HEADLAMP_URL`       | Optional | Headlamp instance URL (defaults to configured instance) |
| `AUTHENTIK_USERNAME` | OIDC     | Authentik username/email for CI user                    |
| `AUTHENTIK_PASSWORD` | OIDC     | Authentik password                                      |
| `HEADLAMP_TOKEN`     | Token    | Kubernetes service account token (alternative to OIDC)  |

Set either `AUTHENTIK_USERNAME` + `AUTHENTIK_PASSWORD` **or** `HEADLAMP_TOKEN`. OIDC takes priority if both are set.

### Manual Trigger

Trigger workflows manually from GitHub Actions UI:

1. Go to Actions → [Workflow Name]
2. Click "Run workflow"
3. Select branch and run

---

## Test Coverage

### Current Coverage

| Category             | Coverage | Notes                          |
| -------------------- | -------- | ------------------------------ |
| **API Functions**    | 95%      | Core utilities fully tested    |
| **React Components** | 60%      | Focus on critical render paths |
| **E2E User Flows**   | 80%      | Main features covered          |

### Coverage Goals

- **Unit Tests**: 80%+ for `src/api/` (business logic)
- **Component Tests**: 50%+ for `src/components/` (critical rendering)
- **E2E Tests**: Cover all major user journeys

### Generating Coverage Reports

```bash
# Unit test coverage
npx vitest --coverage

# View HTML report
open coverage/index.html
```

---

## Best Practices

### Unit Testing

1. **Test behavior, not implementation**

   - ✅ `expect(computeScore({ total: 100, pass: 75 })).toBe(75)`
   - ❌ `expect(mockInternalFunction).toHaveBeenCalled()`

2. **Use descriptive test names**

   - ✅ `it('returns 0 when total checks is zero')`
   - ❌ `it('works')`

3. **One assertion per test (when possible)**

   - Makes failures easier to debug
   - Exceptions: testing multiple properties of same object

4. **Mock external dependencies**

   - Mock API calls, context providers, external libraries
   - Don't mock the code you're testing

5. **Test edge cases**
   - Empty arrays, null values, zero counts
   - Invalid input, malformed data

### E2E Testing

1. **Use semantic selectors**

   - ✅ `page.getByRole('button', { name: 'Close' })`
   - ✅ `page.getByText('Polaris — Overview')`
   - ❌ `page.locator('.MuiButton-root')`

2. **Wait for visibility, not arbitrary timeouts**

   - ✅ `await expect(element).toBeVisible()`
   - ❌ `await page.waitForTimeout(5000)`

3. **Keep tests independent**

   - Each test should work in isolation
   - Don't rely on previous tests' state

4. **Test complete user flows**

   - Navigate → Interact → Verify outcome
   - Don't just test page loads

5. **Clean up after tests**

   - Close drawers/modals
   - Reset state if needed

6. **Use storage state for auth**

   - Reuse authenticated session across tests
   - Faster than logging in for every test

7. **Parallelize carefully**
   - Tests must not interfere with each other
   - Currently disabled due to shared cluster state

### General

1. **Run tests before committing**

   ```bash
   npm run build && npm run lint && npm test
   ```

2. **Fix failing tests immediately**

   - Don't commit failing tests
   - Don't skip tests to "fix later"

3. **Update tests when changing code**

   - Tests are documentation
   - Keep them in sync with implementation

4. **Review test failures in CI**
   - Check artifacts (screenshots, traces)
   - Reproduce locally before fixing

---

## Debugging

### Common Issues

#### Unit Tests

**Issue: Mock not working**

```typescript
// ❌ Wrong: Mock after import
import { usePolarisData } from './polaris';
vi.mock('./polaris');

// ✅ Correct: Mock before import
vi.mock('./polaris', () => ({
  usePolarisData: vi.fn(),
}));
import { usePolarisData } from './polaris';
```

**Issue: "Cannot read property of undefined"**

Check mocks are returning expected structure:

```typescript
vi.spyOn(PolarisDataContext, 'usePolarisDataContext').mockReturnValue({
  data: mockData, // Ensure mockData has all required fields
  loading: false,
  error: null,
  refresh: vi.fn(),
});
```

#### E2E Tests

**Issue: "Element not found"**

```bash
# Enable verbose logging
DEBUG=pw:api npx playwright test

# Use headed mode to see what's happening
npm run e2e:headed
```

Common causes:

- Element hasn't rendered yet (use `toBeVisible()` instead of `toBeDefined()`)
- Wrong selector (use Playwright Inspector to verify)
- Authentication failed (check token/credentials)

**Issue: "Test timeout"**

Increase timeout for slow operations:

```typescript
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds

  await page.goto('/c/main/polaris');
  // ...
});
```

**Issue: Network errors in E2E tests**

```bash
# Check Headlamp accessibility
curl -I $HEADLAMP_URL

# Check Polaris service
kubectl -n polaris get svc polaris-dashboard
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json
```

### Useful Commands

```bash
# Run specific test file
npx vitest src/api/polaris.test.ts

# Run specific test case
npx vitest -t "computes score correctly"

# Run E2E test by name
npx playwright test -g "sidebar contains Polaris"

# Update snapshots
npx vitest -u

# Clear test cache
npx vitest --clearCache
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library (React)](https://testing-library.com/docs/react-testing-library/intro/)
- [Headlamp Plugin Development](https://headlamp.dev/docs/latest/development/plugins/)
- [Project Architecture](./ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)
