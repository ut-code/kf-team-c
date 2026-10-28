import { expect, test } from '@playwright/test';
import { project } from '../../src/map/geometry';

test('水面の反射は海だけに描画し、時間進行で変化して停止時に静止する', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const ocean = page.locator('[data-ocean-surface]');
    await expect(ocean).toHaveAttribute('data-ocean-time', '0.00000');
    const initial = await ocean.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    const point = project(104, 35);
    const landAlpha = await page.evaluate((point) => {
        const group = document.querySelector('[data-world-tile="0"]') as SVGGraphicsElement;
        const position = new DOMPoint(point.x, point.y).matrixTransform(group.getCTM()!);
        const canvas = document.querySelector('[data-ocean-surface]') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl')!;
        const rect = canvas.getBoundingClientRect();
        const pixel = new Uint8Array(4);
        gl.readPixels(
            Math.floor((position.x / rect.width) * canvas.width),
            canvas.height - 1 - Math.floor((position.y / rect.height) * canvas.height),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
        );
        return pixel[3];
    }, point);
    expect(landAlpha).toBe(0);
    await page.getByRole('button', { name: '1倍速', exact: true }).click();
    await expect
        .poll(async () => Number(await ocean.getAttribute('data-ocean-time')))
        .toBeGreaterThan(0.15);
    expect(await ocean.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(
        initial,
    );
    await page.screenshot({ path: 'test-results/ui-ocean.png' });
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await page.waitForTimeout(100);
    const stopped = await ocean.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.waitForTimeout(200);
    expect(await ocean.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(stopped);
    expect(errors).toEqual([]);
});
