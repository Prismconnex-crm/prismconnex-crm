import { test, expect } from '@playwright/test';

test.describe('Auth E2E Flow', () => {
    test('sign-up -> verify -> sign-in -> onboarding -> /app/dashboard renders', async ({ page }) => {
        // 1. Sign Up
        await page.goto('/auth/sign-up');
        await page.fill('input[name="name"]', 'Test User');
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'Password123!');
        await page.click('button[type="submit"]');

        // 2. Verify
        await page.waitForURL(/\/auth\/verify/);
        await page.fill('input[name="code"]', '123456'); // Wait, Mock Code
        await page.click('button[type="submit"]');

        // 3. Sign In
        await page.waitForURL(/\/auth\/sign-in/);
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'Password123!');
        await page.click('button[type="submit"]');

        // 4. Onboarding
        await page.waitForURL(/\/onboarding/);
        await page.fill('input[name="workspaceName"]', 'Test Workspace');
        await page.click('button[type="submit"]');

        // 5. Dashboard
        await page.waitForURL(/\/app\/dashboard/);
        expect(page.url()).toContain('/app/dashboard');
    });
});
