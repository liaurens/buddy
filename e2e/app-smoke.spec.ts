import { expect, test } from '@playwright/test';

test('app shell renders without a framework error overlay', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('body')).toContainText(
        /Welcome to Life Tracker|Buddy|Now|Loading|Configuration Error/i,
    );
    await expect(page.locator('body')).not.toContainText(
        'Failed to fetch dynamically imported module',
    );
    await expect(page.locator('body')).not.toContainText('Internal server error');
    await expect(page.locator('body')).not.toContainText('[plugin:vite');

    expect(consoleErrors).toEqual([]);
});
