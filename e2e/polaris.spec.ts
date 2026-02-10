import { test, expect } from '@playwright/test';

test.describe('Polaris plugin smoke tests', () => {
  test('sidebar contains Polaris entry', async ({ page }) => {
    await page.goto('/');
    // The sidebar is the "Navigation" nav element (not "Appbar Tools")
    const sidebar = page.getByRole('navigation', { name: 'Navigation' });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(sidebar.getByRole('button', { name: 'Polaris' })).toBeVisible();
  });

  test('overview page renders cluster score', async ({ page }) => {
    await page.goto('/c/main/polaris');

    // SectionHeader renders a heading
    await expect(page.getByRole('heading', { name: 'Polaris \u2014 Overview' })).toBeVisible();

    // "Cluster Score" section exists with a percentage
    await expect(page.getByText('Cluster Score')).toBeVisible();
    await expect(page.getByText(/%/)).toBeVisible();
  });

  test('namespaces page renders table with namespace buttons', async ({ page }) => {
    await page.goto('/c/main/polaris/namespaces');

    await expect(page.getByRole('heading', { name: 'Polaris \u2014 Namespaces' })).toBeVisible();

    // Table should have at least one row with a namespace button
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Each namespace row should contain a button (now buttons instead of links for drawer)
    const firstButton = rows.first().locator('button');
    await expect(firstButton).toBeVisible();
  });

  test('namespace detail drawer opens from table button', async ({ page }) => {
    await page.goto('/c/main/polaris/namespaces');

    // Click the first namespace button in the table
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const firstButton = table.locator('tbody tr').first().locator('button');
    const namespaceName = await firstButton.textContent();
    await firstButton.click();

    // Drawer should open and show the namespace name in the heading
    await expect(
      page.getByRole('heading', { name: `Polaris \u2014 ${namespaceName}` })
    ).toBeVisible();

    // "Namespace Score" section should be present in drawer
    await expect(page.getByText('Namespace Score')).toBeVisible();

    // Resources table should exist in drawer
    await expect(page.getByText('Resources')).toBeVisible();

    // URL hash should be updated with namespace name
    await expect(page).toHaveURL(/\/polaris\/namespaces#/);
  });

  test('namespace detail drawer closes with Escape key', async ({ page }) => {
    await page.goto('/c/main/polaris/namespaces');

    // Open the drawer by clicking a namespace button
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const firstButton = table.locator('tbody tr').first().locator('button');
    const namespaceName = await firstButton.textContent();
    await firstButton.click();

    // Verify drawer is open
    await expect(
      page.getByRole('heading', { name: `Polaris \u2014 ${namespaceName}` })
    ).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Drawer should close (heading should not be visible anymore)
    await expect(
      page.getByRole('heading', { name: `Polaris \u2014 ${namespaceName}` })
    ).not.toBeVisible();

    // URL hash should be cleared
    await expect(page).toHaveURL(/\/polaris\/namespaces$/);
  });

  test('namespace detail drawer opens from URL hash', async ({ page }) => {
    // Get a namespace name first
    await page.goto('/c/main/polaris/namespaces');
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const firstButton = table.locator('tbody tr').first().locator('button');
    const namespaceName = await firstButton.textContent();

    // Navigate directly to URL with hash
    await page.goto(`/c/main/polaris/namespaces#${namespaceName}`);

    // Drawer should automatically open with the namespace details
    await expect(
      page.getByRole('heading', { name: `Polaris \u2014 ${namespaceName}` })
    ).toBeVisible();

    // "Namespace Score" section should be present
    await expect(page.getByText('Namespace Score')).toBeVisible();
  });
});
