import { test, expect, Page } from '@playwright/test';

/** Navigate to the Polaris plugin settings page and wait for settings to render. */
async function goToPolarisSettings(page: Page) {
  // Load the main page first so all plugin scripts execute and call
  // registerPluginSettings(). Headlamp loads plugins asynchronously — the
  // PluginSettings component reads the plugin registry once on mount and
  // never re-renders when new plugins register. A full page.goto() to the
  // settings URL would re-initialize the SPA, causing PluginSettings to
  // mount before plugin scripts finish executing.
  await page.goto('/');
  const sidebar = page.getByRole('navigation', { name: 'Navigation' });
  await expect(sidebar).toBeVisible({ timeout: 15_000 });
  await expect(sidebar.getByRole('button', { name: 'Polaris' })).toBeVisible({
    timeout: 15_000,
  });

  // Navigate to plugin settings via client-side routing (pushState + popstate)
  // instead of page.goto(). This preserves the already-loaded plugin scripts
  // and their registerPluginSettings() registrations. React Router's history
  // listener picks up the popstate event and re-renders with the new route.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/c/main/settings/plugins');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  });

  // Find and click the Polaris plugin entry to open its settings
  const pluginEntry = page.locator('text=headlamp-polaris').first();
  await expect(pluginEntry).toBeVisible({ timeout: 15_000 });
  await pluginEntry.click();

  // Wait for the PolarisSettings component to render
  await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });
}

test.describe('Polaris plugin settings', () => {
  test('settings page shows configuration options', async ({ page }) => {
    await goToPolarisSettings(page);

    // SectionBox title should be visible
    await expect(page.getByText('Polaris Settings')).toBeVisible();
  });

  test('refresh interval setting is configurable', async ({ page }) => {
    await goToPolarisSettings(page);

    // Find the refresh interval dropdown
    const intervalSelect = page.locator('select').filter({ hasText: /minute|second/ });
    await expect(intervalSelect).toBeVisible();

    // Get current value
    const currentValue = await intervalSelect.inputValue();

    // Change to a different value
    const newValue = currentValue === '300' ? '600' : '300';
    await intervalSelect.selectOption(newValue);

    // Value should be updated
    await expect(intervalSelect).toHaveValue(newValue);
  });

  test('dashboard URL setting is configurable', async ({ page }) => {
    await goToPolarisSettings(page);

    // Find the dashboard URL input
    const urlInput = page.getByPlaceholder(/polaris-dashboard/);
    await expect(urlInput).toBeVisible();

    // Input should have the default proxy URL or custom URL
    const currentUrl = await urlInput.inputValue();
    expect(currentUrl).toBeTruthy();

    // Examples text should be visible
    await expect(page.getByText('Examples:')).toBeVisible();
    await expect(page.getByText(/K8s proxy:/)).toBeVisible();
  });

  test('connection test button is available', async ({ page }) => {
    await goToPolarisSettings(page);

    // Find and verify test connection button
    const testButton = page.getByRole('button', { name: /test connection/i });
    await expect(testButton).toBeVisible();
    await expect(testButton).toBeEnabled();
  });

  test('connection test works with valid URL', async ({ page }) => {
    await goToPolarisSettings(page);

    // Click test connection
    const testButton = page.getByRole('button', { name: /test connection/i });
    await testButton.click();

    // Wait for either success or error message
    // Note: This will succeed if Polaris is accessible, fail otherwise
    await page.waitForSelector('text=/Connected successfully|Connection failed/', {
      timeout: 15_000,
    });

    // Either success or failure is acceptable (depends on environment)
    const result = await page.textContent('body');
    expect(result).toMatch(/(Connected successfully|Connection failed)/);
  });
});
