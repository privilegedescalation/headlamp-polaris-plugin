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

  test('namespaces page renders table with links', async ({ page }) => {
    await page.goto('/c/main/polaris/namespaces');

    await expect(page.getByRole('heading', { name: 'Polaris \u2014 Namespaces' })).toBeVisible();

    // Table should have at least one row with a namespace link
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Each namespace row should contain a link
    const firstLink = rows.first().locator('a');
    await expect(firstLink).toBeVisible();
  });

  test('namespace detail page renders from table link', async ({ page }) => {
    await page.goto('/c/main/polaris/namespaces');

    // Click the first namespace link in the table
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const firstLink = table.locator('tbody tr').first().locator('a');
    const namespaceName = await firstLink.textContent();
    await firstLink.click();

    // Detail page should show the namespace name in the heading
    await expect(
      page.getByRole('heading', { name: `Polaris \u2014 ${namespaceName}` })
    ).toBeVisible();

    // "Namespace Score" section should be present
    await expect(page.getByText('Namespace Score')).toBeVisible();

    // Resources table should exist
    await expect(page.getByText('Resources')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});
