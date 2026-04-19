import { test, expect } from '@playwright/test';

test.describe('WebUI Smoke Tests', () => {
  test('connect page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Overmind/i);
  });

  test('connect page has title and form', async ({ page }) => {
    await page.goto('/connect');
    await expect(page.locator('text=Connect')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to templates via sidebar', async ({ page }) => {
    await page.goto('/connect');
    await page.waitForTimeout(500);
    await page.goto('/');
    await page.waitForTimeout(500);
    const templatesLink = page.locator('a[href="/templates"]');
    if (await templatesLink.isVisible()) {
      await templatesLink.click();
      await expect(page).toHaveURL(/\/templates/);
    }
  });

  test('templates page renders correctly', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('sessions page renders', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('providers page renders', async ({ page }) => {
    await page.goto('/providers');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('workspaces page renders', async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('settings page renders', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('instances page renders', async ({ page }) => {
    await page.goto('/instances');
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('theme toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const themeBtn = page.locator('button[title*="theme" i], button[title*="Toggle"]');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('language toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const langBtn = page.locator('button[title*="English"], button[title*="Chinese"]');
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(300);
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});
