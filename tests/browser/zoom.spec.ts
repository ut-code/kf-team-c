import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// ビルド済みアプリを配信し、ローカルサーバーの起動権限に依存せず操作を検証する。
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

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
]) {
    test(`地図の2段階ズーム・移動・施設の集約 ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('http://map.test/');
        const world = page.locator('[data-world-tile="0"]');
        await expect(world).toBeAttached();
        const before = await world.getAttribute('transform');
        await page.getByRole('button', { name: '地図を拡大', exact: true }).click();
        await expect(page.getByRole('button', { name: '地図を縮小', exact: true })).toBeVisible();
        expect(await world.getAttribute('transform')).not.toBe(before);
        const map = page.getByRole('region', { name: /世界地図/ });
        await map.focus();
        const container = page.locator('[data-map-background]').locator('..');
        const top = await container.evaluate((el) => (el as HTMLElement).style.top);
        await page.keyboard.press('ArrowDown');
        expect(await container.evaluate((el) => (el as HTMLElement).style.top)).not.toBe(top);
        const box = (await map.boundingBox())!;
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        const dragTop = await container.evaluate((el) => (el as HTMLElement).style.top);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 40, startY - 45, { steps: 5 });
        await page.mouse.up();
        expect(await container.evaluate((el) => (el as HTMLElement).style.top)).not.toBe(dragTop);
        const oldTransform = await world.getAttribute('transform');
        await page.keyboard.press('ArrowRight');
        expect(await world.getAttribute('transform')).not.toBe(oldTransform);
        await page.getByRole('button', { name: '地図を縮小', exact: true }).click();
        await expect(container).toHaveCSS('top', '0px');
        const cluster = world.locator('[data-kind="cluster"]').first();
        await expect(cluster).toBeAttached();
        // SVGのタイルには画面外の施設もあるため、キーボードから一覧を開く。
        await cluster.press('Enter');
        const list = page.getByRole('region', { name: 'まとまった施設' });
        await expect(list).toBeVisible();
        const members = await list.getByRole('button').count();
        expect(members).toBeGreaterThan(2);
        await list.getByRole('button').nth(1).click();
        await expect(page.getByLabel('施設パネル', { exact: true })).toBeVisible();
        await expect(list).toHaveCount(0);
        expect(errors).toEqual([]);
        await page.screenshot({ path: `test-results/zoom-${viewport.width}.png` });
    });
}
