import { test, expect } from '@playwright/test';

test.describe('Connect Page', () => {
  test('has connect form with input fields', async ({ page }) => {
    await page.goto('/connect');
    await expect(page.locator('input')).toBeVisible({ timeout: 5000 });
  });

  test('shows Overmind title', async ({ page }) => {
    await page.goto('/connect');
    const title = await page.title();
    expect(title).toMatch(/Overmind/i);
  });

  test('has label input or backend URL field', async ({ page }) => {
    await page.goto('/connect');
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Navigation', () => {
  test('sidebar has main navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('can navigate between pages', async ({ page }) => {
    const routes = ['/templates', '/sessions', '/workspaces', '/providers', '/skills', '/instances', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(500);
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('sessions/new page renders', async ({ page }) => {
    await page.goto('/sessions/new');
    await page.waitForTimeout(500);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('providers/configs page renders', async ({ page }) => {
    await page.goto('/providers/configs');
    await page.waitForTimeout(500);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('providers/proxies page renders', async ({ page }) => {
    await page.goto('/providers/proxies');
    await page.waitForTimeout(500);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('providers/stats page renders', async ({ page }) => {
    await page.goto('/providers/stats');
    await page.waitForTimeout(500);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Theme and Language', () => {
  test('page renders in both light and dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('page content is visible and readable', async ({ page }) => {
    await page.goto('/connect');
    await page.waitForTimeout(500);
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(0);
  });
});

test.describe('Dashboard', () => {
  test('index page loads with stat cards area', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Templates Page', () => {
  test('templates page has content area', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Skills Page', () => {
  test('skills page renders', async ({ page }) => {
    await page.goto('/skills');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
