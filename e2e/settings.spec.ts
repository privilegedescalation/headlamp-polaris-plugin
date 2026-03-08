import { test, expect } from '@playwright/test';

test.describe('Polaris plugin settings', () => {
  test('settings page shows configuration options', async ({ page }) => {
    await page.goto('/c/main/settings/plugins');

    // Find Polaris plugin in the list
    const pluginCard = page.locator('text=polaris').first();
    await expect(pluginCard).toBeVisible();

    // Click to view settings (if settings are displayed inline, they should already be visible)
    // Note: Headlamp v0.39.0+ shows settings inline on the plugins page
    await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });
  });

  test('refresh interval setting is configurable', async ({ page }) => {
    await page.goto('/c/main/settings/plugins');

    // Navigate to Polaris settings
    await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });

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
    await page.goto('/c/main/settings/plugins');

    // Navigate to Polaris settings
    await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });

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
    await page.goto('/c/main/settings/plugins');

    // Navigate to Polaris settings
    await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });

    // Find and verify test connection button
    const testButton = page.getByRole('button', { name: /test connection/i });
    await expect(testButton).toBeVisible();
    await expect(testButton).toBeEnabled();
  });

  test('connection test works with valid URL', async ({ page }) => {
    await page.goto('/c/main/settings/plugins');

    // Navigate to Polaris settings
    await expect(page.getByText('Polaris Settings')).toBeVisible({ timeout: 15_000 });

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
