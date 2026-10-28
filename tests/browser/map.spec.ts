import { expect, type Page, test } from '@playwright/test';
import { project, WORLD_HEIGHT } from '../../src/map/geometry';

const tile = (page: Page) => page.locator('[data-world-tile="0"]');
const matrix = (page: Page) =>
    tile(page).evaluate((element) => {
        const m = (element as SVGGraphicsElement).getCTM()!;
        return { x: m.e, y: m.f, scale: m.a };
    });

test('日本を中央へ移動でき、日付変更線を越えても地点は重複しない', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(tile(page).locator('[data-country]')).toHaveCount(176);
    const viewport = page.getByRole('region', { name: /^世界地図/ });
    await expect(page.locator('[data-country="ATA"]')).toHaveCount(0);
    const before = await matrix(page);
    await page.mouse.move(720, 450);
    const japan = project(139.7, 35.7);
    const delta = before.x + japan.x * before.scale - 720;
    await page.mouse.down();
    await page.mouse.move(720 - delta, 450);
    await expect
        .poll(async () => (await matrix(page)).x + japan.x * before.scale)
        .toBeCloseTo(720, 3);
    await page.mouse.up();
    await expect
        .poll(async () => (await matrix(page)).x + japan.x * before.scale)
        .toBeCloseTo(720, 3);
    const centered = await matrix(page);
    await page.mouse.click(720, japan.y * before.scale);
    await expect(tile(page).locator('[data-country="JPN"]')).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(page.locator('[data-world-tile]')).toHaveCount(2);
    await viewport.press('+');
    await viewport.press('-');
    await viewport.press('ArrowDown');
    expect((await matrix(page)).scale).toBe(before.scale);
    expect((await matrix(page)).y).toBe(0);
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(840, 450);
    await page.mouse.up();
    await expect.poll(async () => (await matrix(page)).x).not.toBe(centered.x);
    await page.mouse.down();
    await page.mouse.move(720, 450);
    await page.mouse.up();
    await expect.poll(async () => (await matrix(page)).x).toBeCloseTo(centered.x, 3);
    await page.screenshot({ path: 'test-results/map-japan-centered.png' });
    for (const dimensions of [
        { width: 1440, height: 900 },
        { width: 2400, height: 600 },
    ]) {
        await page.setViewportSize(dimensions);
        await expect
            .poll(async () => (await matrix(page)).scale)
            .toBeCloseTo(dimensions.height / WORLD_HEIGHT, 6);
        // 各地点が表示されるタイルは最大1つ。超横長画面でも一周分を超えない。
        const counts = await page.locator('svg[aria-label="国境と地形"]').evaluate(
            (svg, samples) => {
                const rect = svg.querySelector('clipPath rect')!;
                const left = Number(rect.getAttribute('x'));
                const right = left + Number(rect.getAttribute('width'));
                const groups = [
                    ...svg.querySelectorAll('[data-world-tile]'),
                ] as SVGGraphicsElement[];
                return samples.map(
                    (point) =>
                        groups.filter((group) => {
                            const p = new DOMPoint(point.x, point.y).matrixTransform(
                                group.getCTM()!,
                            );
                            return p.x >= left && p.x < right;
                        }).length,
                );
            },
            [
                project(139.7, 35.7),
                project(-74, 41),
                project(0, 0),
                project(179, 0),
                project(-179, 0),
            ],
        );
        expect(counts.every((count) => count <= 1)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await viewport.press('Home');
    await viewport.press('Escape');
    await expect(page.locator('[data-selected-outline]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/map-world.png' });
    expect(errors).toEqual([]);
});

test('選択輪郭は隣国より上に描画され、白系のまま維持される', async ({ page }) => {
    await page.goto('/');
    const china = tile(page).locator('[data-country="CHN"]');
    await expect(china).toBeAttached();
    await china.focus();
    await china.press('Enter');
    const outline = tile(page).locator('[data-selected-outline="CHN"]');
    await expect(outline).toHaveAttribute('d', (await china.getAttribute('d'))!);
    await expect(outline).toHaveCSS('stroke', 'rgb(238, 247, 250)');
    await expect(outline).toHaveCSS('pointer-events', 'none');
    expect(
        await outline.evaluate((element) => {
            const countries =
                element.parentElement!.querySelector('[data-country]')!.parentElement!;
            return Boolean(
                countries.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
            );
        }),
    ).toBe(true);
});

test('本採用の地図だけを読み込み、比較ボタンを表示しない', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/');
    await expect(tile(page).locator('[data-country]')).toHaveCount(176);
    await expect(page.getByRole('button', { name: /比較/ })).toHaveCount(0);
    await expect(page.locator('[data-map-background]')).toHaveAttribute(
        'data-map-background',
        /world-map.webp$/,
    );
    await page.locator('[data-map-background]').evaluate(async (element) => {
        const image = new Image();
        image.src = element.getAttribute('data-map-background')!;
        await image.decode();
        if (image.naturalWidth !== 8192 || image.naturalHeight !== 4361)
            throw new Error('本採用背景の寸法不一致');
    });
    expect(
        requests.some((url) => /countries-(10m|110m)|world-ocean-|world-verdant/.test(url)),
    ).toBe(false);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.mouse.move(1400, 880);
    await page.screenshot({ path: 'test-results/map-adopted.png' });
});
