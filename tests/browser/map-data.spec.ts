import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.route('http://map.test/**', async (route) => {
        const url = new URL(route.request().url());
        const file =
            url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const types: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.webp': 'image/webp',
        };
        await route.fulfill({
            body: await readFile(path.resolve('dist', file)),
            contentType: types[path.extname(file)] ?? 'application/octet-stream',
        });
    });
});

test('白地図で国別データを色分けし、説明と国の値を確認できる', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://map.test/');
    const selector = page.getByLabel('地図レイヤーの項目');
    const layers = page.getByRole('button', { name: '地図レイヤー', exact: true });
    await expect(selector).not.toBeVisible();
    await expect(layers).toHaveAttribute('aria-expanded', 'false');
    await layers.click();
    await expect(selector).toBeVisible();
    await selector.selectOption('governmentCapacity');
    await expect(page.getByText('政府の政策実行能力', { exact: true })).toBeVisible();
    await expect(page.locator('[data-map-background]')).toHaveCount(0);
    await expect(page.locator('[data-ocean-surface]')).toHaveCount(0);
    const japan = page.locator('[data-world-tile="0"] [data-country="JPN"]');
    await expect(japan).toHaveAttribute('data-parameter-value', /\d/);
    await japan.focus();
    const value = await japan.getAttribute('data-parameter-value');
    await expect(page.getByRole('region', { name: '国別データ', exact: true })).toContainText(
        Number(value).toFixed(1),
    );
    await selector.selectOption('aiDefenseEffectiveness');
    await expect(japan).toHaveAttribute('data-parameter-value', /\d/);
    await expect(japan.locator('title')).toContainText('対AI防御の実効性');
    await layers.click();
    await expect(selector).not.toBeVisible();
    await expect(japan).toHaveAttribute('data-parameter-value', /\d/);
    await layers.click();
    await expect(selector).toHaveValue('aiDefenseEffectiveness');
    const singapore = page.locator('[data-world-tile="0"] [data-country="SGP"]');
    await singapore.focus();
    await expect(page.getByRole('region', { name: '国別データ', exact: true })).toContainText(
        'シンガポール',
    );
    await japan.focus();
    await page.screenshot({ path: 'test-results/map-data-desktop.png' });
    await selector.selectOption('');
    await expect(page.locator('[data-map-background]')).toHaveCount(1);
    await expect(japan).not.toHaveAttribute('data-parameter-value');
    await page.screenshot({ path: 'test-results/map-data-normal.png' });
    await selector.press('Escape');
    await expect(selector).not.toBeVisible();
    await expect(layers).toBeFocused();
    expect(errors).toEqual([]);
});

test('狭い画面でも国別データの項目を切り替えられる', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://map.test/');
    await page.getByRole('button', { name: '地図レイヤー', exact: true }).click();
    await page.getByLabel('地図レイヤーの項目').selectOption('aiInfiltration');
    await expect(page.getByText('AIが国の内部へ入り込んでいる程度', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/map-data-mobile.png' });
});
