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
    test(`地図のホイールズーム・移動・施設の横並び ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('http://map.test/');
        const world = page.locator('[data-world-tile="0"]');
        await expect(world).toBeAttached();
        const before = await world.getAttribute('transform');
        const map = page.getByRole('region', { name: /世界地図/ });
        const box = (await map.boundingBox())!;
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.wheel(0, -700);
        await expect.poll(async () => world.getAttribute('transform')).not.toBe(before);
        await expect(page.getByRole('button', { name: /地図を拡大|地図を縮小/ })).toHaveCount(0);
        await map.focus();
        const container = page.locator('[data-map-background]').locator('..');
        const top = await container.evaluate((el) => (el as HTMLElement).style.top);
        await page.keyboard.press('ArrowDown');
        expect(await container.evaluate((el) => (el as HTMLElement).style.top)).not.toBe(top);
        const dragTop = await container.evaluate((el) => (el as HTMLElement).style.top);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 40, startY - 45, { steps: 5 });
        await page.mouse.up();
        expect(await container.evaluate((el) => (el as HTMLElement).style.top)).not.toBe(dragTop);
        const oldTransform = await world.getAttribute('transform');
        await page.keyboard.press('ArrowRight');
        expect(await world.getAttribute('transform')).not.toBe(oldTransform);
        await page.mouse.move(startX, startY);
        await page.mouse.wheel(0, 2000);
        await expect(container).toHaveCSS('top', '0px');
        const cluster = world.locator('[data-kind="cluster"]').first();
        await expect(cluster).toBeAttached();
        const members = cluster.locator('[data-marker]');
        expect(await members.count()).toBeGreaterThan(1);
        await expect(members.first().locator('rect').first()).toHaveAttribute('width', '28');
        const positions = await members.evaluateAll((icons) =>
            icons.slice(0, 2).map((icon) => {
                const rect = icon.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width };
            }),
        );
        expect(positions[1].x - positions[0].x).toBeCloseTo(28, 0);
        expect(positions[1].y).toBeCloseTo(positions[0].y, 0);
        expect(positions[1].width).toBeCloseTo(positions[0].width, 0);
        await members.nth(1).press('Enter');
        await expect(page.getByLabel('施設パネル', { exact: true })).toBeVisible();
        expect(errors).toEqual([]);
        await page.screenshot({ path: `test-results/zoom-${viewport.width}.png` });
    });
}

test('北端で大きくドラッグした後も、逆方向の移動にすぐ反応する', async ({ page }) => {
    await page.goto('http://map.test/');
    const map = page.getByRole('region', { name: /世界地図/ });
    const box = (await map.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -900);
    const container = page.locator('[data-map-background]').locator('..');
    await page.mouse.down();
    await page.mouse.move(x, y + 1000);
    const edge = await container.evaluate((element) =>
        Number.parseFloat((element as HTMLElement).style.top),
    );
    await page.mouse.move(x, y + 960);
    const returned = await container.evaluate((element) =>
        Number.parseFloat((element as HTMLElement).style.top),
    );
    await page.mouse.up();
    expect(returned).toBeLessThan(edge);
});
