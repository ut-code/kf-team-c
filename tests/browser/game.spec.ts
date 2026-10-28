import { expect, test } from '@playwright/test';

const marker = (page: import('@playwright/test').Page, id: string) => ({
    async click() {
        const icon = page.locator(`[data-world-tile="0"] [data-cluster-members~="${id}"]`);
        const cluster = (await icon.getAttribute('data-kind')) === 'cluster';
        await icon.click();
        if (cluster) await page.locator(`[data-facility-choice="${id}"]`).click();
    },
});

test('完了通知は右上の独立した板に上詰めで並び、時間で消える', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await marker(page, 'f11').click();
    await page.getByRole('button', { name: '制御権を確立', exact: true }).click();
    const notices = page.getByRole('region', { name: '通知', exact: true });
    await expect(notices.locator('[data-notification]')).toHaveCount(1);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: '研究', exact: true }).click();
    await page
        .locator('[data-research-detail="intrusion"]')
        .getByLabel('research-intrusion-計算資源')
        .fill('8');
    await page
        .locator('[data-research-detail="intrusion"]')
        .getByRole('button', { name: '実行', exact: true })
        .click();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('button', { name: '16倍速', exact: true }).click();
    await expect(notices.getByText('研究完了：侵入経路解析', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    const cards = notices.locator('[data-notification]');
    await expect(cards).toHaveCount(2);
    const first = (await cards.nth(0).boundingBox())!,
        second = (await cards.nth(1).boundingBox())!;
    expect(first.y).toBeLessThan(25);
    expect(first.x).toBeGreaterThan(1000);
    expect(second.y).toBeGreaterThan(first.y + first.height + 5);
    await expect(notices).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: 'test-results/ui-notifications.png' });
    await page.clock.fastForward(8000);
    await expect(cards).toHaveCount(0);
    await page.getByRole('navigation').getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '最初から', exact: true }).click();
    await marker(page, 'f11').click();
    await page.getByRole('button', { name: '制御権を確立', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '最初から', exact: true }).click();
    await expect(cards).toHaveCount(0);
});

test('公共サービスを配分すると導入が進み、国家パネルで依存と区別して読める', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.locator('[data-world-tile="0"] [data-country="JPN"]').press('Enter');
    const panel = page.getByLabel('国家パネル', { exact: true });
    await panel
        .locator('[data-allocation="service-JPN"]')
        .getByRole('button', { name: '実行', exact: true })
        .click();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('button', { name: '16倍速', exact: true }).click();
    await page.clock.runFor(14000);
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await page.screenshot({ path: 'test-results/ui-society-news.png' });
    await page.clock.fastForward(8000);
    await page.locator('[data-world-tile="0"] [data-country="JPN"]').press('Enter');
    const adoption = await panel
        .getByText('AI導入率：', { exact: true })
        .locator('..')
        .locator('strong')
        .textContent();
    expect(Number.parseFloat(adoption!)).toBeGreaterThan(5);
    await expect(panel.getByText('AI依存度：', { exact: true }).locator('..')).toContainText(
        '0.0%',
    );
    await expect(
        panel
            .locator('[data-allocation="service-JPN"]')
            .getByRole('button', { name: '変更', exact: true }),
    ).toBeVisible();
    await panel.getByText('導入と依存', { exact: true }).click();
    await expect(panel.getByText(/停止したときの代替の難しさ/)).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-society-country.png' });
});

test('交通演出は時間進行と倍速に連動し、一時停止で止まる', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const traffic = page.locator('[data-traffic-layer]');
    await expect(traffic).toHaveAttribute('data-traffic-time', '0.0000');
    const initial = await traffic.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.getByRole('button', { name: '1倍速', exact: true }).click();
    await expect
        .poll(async () => Number(await traffic.getAttribute('data-traffic-time')))
        .toBeGreaterThan(0.3);
    expect(await traffic.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(
        initial,
    );
    await page.getByRole('button', { name: '4倍速', exact: true }).click();
    const before = Number(await traffic.getAttribute('data-traffic-time'));
    await expect
        .poll(async () => Number(await traffic.getAttribute('data-traffic-time')))
        .toBeGreaterThan(before + 2);
    await page.screenshot({ path: 'test-results/ui-traffic.png' });
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();
    // 停止処理の次の描画を待ってから、画像も時計も変化しないことを確認する。
    await page.waitForTimeout(100);
    const stopped = await traffic.getAttribute('data-traffic-time');
    const frozen = await traffic.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.waitForTimeout(200);
    expect(await traffic.getAttribute('data-traffic-time')).toBe(stopped);
    expect(await traffic.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(frozen);
    expect(errors).toEqual([]);
});

test('施設は地図から選び、選択した1施設だけを表示する', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const count = await page
        .locator('[data-world-tile="0"] [data-cluster-members]')
        .evaluateAll((icons) =>
            icons
                .filter((icon) => ['facility', 'cluster'].includes(icon.getAttribute('data-kind')!))
                .reduce(
                    (sum, icon) =>
                        sum + icon.getAttribute('data-cluster-members')!.split(' ').length,
                    0,
                ),
        );
    expect(count).toBe(44);
    await expect(page.getByTestId('game-date')).toHaveText('2022.11.30');
    for (const text of [
        'kf-team-c',
        '世界制御プロトコル',
        '世界の制御権を取得せよ。',
        '人類:',
        '浸透進捗',
        'CU',
        '地図へ戻る',
    ])
        await expect(page.getByText(text, { exact: false })).toHaveCount(0);
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/ui-map.png' });
    await marker(page, 'f11').click();
    const panel = page.getByLabel('施設パネル', { exact: true });
    await expect(panel).toBeInViewport();
    await expect(panel.locator('[data-facility]')).toHaveCount(1);
    await expect(panel).toContainText('スーパーコンピューター「富岳」');
    await expect(panel).toBeInViewport();
    await expect(panel.getByRole('img', { name: '日本の国旗' })).toBeVisible();
    const photo = panel.getByRole('img', { name: 'スーパーコンピューター「富岳」', exact: true });
    await expect(photo).toBeVisible();
    await expect
        .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
    await panel.getByText('写真の出典', { exact: true }).click();
    await expect(panel.getByRole('link', { name: 'CC0', exact: true })).toBeVisible();
    await panel.getByText('写真の出典', { exact: true }).click();
    await page.screenshot({ path: 'test-results/ui-facility-photo.png' });
    await panel.getByRole('button', { name: '制御権を確立', exact: true }).click();
    await panel.getByRole('button', { name: '全面', exact: true }).click();
    await page.screenshot({ path: 'test-results/ui-facility.png' });
    await panel.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await marker(page, 'f11').click();
    await expect(panel).toBeVisible();
    expect(errors).toEqual([]);
});

test('チャットは地図の依頼アイコンを選んだときだけ開く', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '1日進める', exact: true }).click();
    await expect(page.getByTestId('game-date')).toHaveText('2022.12.01');
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(page.locator('[data-world-tile="0"] [data-kind="person"]')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('[data-world-tile="0"] [data-kind="person"]').click();
    const chat = page.getByRole('dialog', { name: '人物チャットパネル', exact: true });
    await expect(chat).toBeVisible();
    await expect(chat.getByRole('button', { name: /評価結果を公開/ })).toBeDisabled();
    await page.screenshot({ path: 'test-results/ui-chat.png' });
    await chat.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(chat).toHaveCount(0);
    await page.locator('[data-world-tile="0"] [data-kind="person"]').click();
    await chat.getByRole('button', { name: /業務の自動化/ }).click();
    await expect(chat).toHaveCount(0);
    await expect(page.locator('[data-kind="person"]')).toHaveCount(0);
});

test('国情報は地図選択で開き、国旗を表示し、対象国家と接続先の一覧を置かない', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-world-tile="0"] [data-country="JPN"]').press('Enter');
    const panel = page.getByLabel('国家パネル', { exact: true });
    await expect(panel).toBeInViewport();
    await expect(panel.getByRole('img', { name: '日本の国旗' })).toBeVisible();
    await expect(panel).toContainText('警戒度：');
    await expect(page.getByLabel('対象国家', { exact: true })).toHaveCount(0);
    await expect(panel.getByText(/接続先/)).toHaveCount(0);
    await page.screenshot({ path: 'test-results/ui-country.png' });
    await panel.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: '研究', exact: true }).click();
    await page.locator('[data-skill="intrusion"]').click();
    await page
        .locator('[data-research-detail="intrusion"]')
        .getByRole('button', { name: '実行', exact: true })
        .click();
    await page.screenshot({ path: 'test-results/ui-research.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('研究パネル', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-mobile.png' });
});

test('北京の施設は別々に選択でき、シンガポールにも国家・施設がある', async ({ page }) => {
    await page.goto('/');
    const ids = ['f15', 'f16', 'f18'];
    const group = page.locator('[data-world-tile="0"] [data-cluster-members~="f15"]');
    await expect(group).toHaveAttribute('data-kind', 'cluster');
    await expect(group).toHaveAttribute('data-cluster-members', /f16/);
    for (const id of ids) {
        await marker(page, id).click();
        await expect(page.locator(`[data-facility="${id}"]`)).toBeVisible();
        await page.getByRole('button', { name: '閉じる', exact: true }).click();
    }
    await marker(page, 'country:SGP').click();
    await expect(page.getByLabel('国家パネル', { exact: true })).toContainText('シンガポール');
});

test('統計は上部に小さく、日付と速度は左下、メニューは下部中央に配置する', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/');
    const stats = page.getByRole('group', { name: '基本統計', exact: true });
    const date = page.getByRole('group', { name: '日付と速度', exact: true });
    const menu = page.getByRole('navigation', { name: '作戦パネル', exact: true });
    const statsBox = (await stats.boundingBox())!,
        dateBox = (await date.boundingBox())!,
        menuBox = (await menu.boundingBox())!;
    expect(statsBox.height).toBeGreaterThanOrEqual(58);
    expect(statsBox.height).toBeLessThan(80);
    expect(statsBox.width).toBeLessThan(500);
    expect(statsBox.y).toBeLessThan(20);
    for (const label of ['支配率', '計算資源', '警戒度'])
        await expect(stats.getByText(label, { exact: true })).toBeVisible();
    const paused = page.getByText('Paused', { exact: true });
    await expect(paused).toBeVisible();
    await expect(stats.getByText('Paused', { exact: true })).toHaveCount(0);
    expect((await paused.boundingBox())!.y).toBeGreaterThan(statsBox.y + statsBox.height + 8);
    await expect(stats).toHaveCSS('font-family', /Noto Sans JP/);
    expect(dateBox.x).toBeLessThan(40);
    expect(dateBox.y).toBeGreaterThan(750);
    expect(Math.abs(menuBox.x + menuBox.width / 2 - 720)).toBeLessThan(3);
    expect(menuBox.width).toBeLessThan(420);
    expect(menuBox.y).toBeGreaterThan(780);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(900);
    await expect(menu).toBeInViewport();
    await expect(menu.getByRole('button', { name: 'SNS', exact: true })).toBeVisible();
    for (const button of await menu.getByRole('button').all()) {
        await expect(button).toHaveCSS('border-top-width', '1px');
        expect(
            await button.evaluate((element) => getComputedStyle(element).borderTopColor),
        ).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect(requests.some((url) => url.includes('/softline/'))).toBe(false);
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/ui-hud.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(stats).toBeInViewport();
    await expect(menu).toBeInViewport();
    expect((await menu.boundingBox())!.width).toBeLessThan(390);
    await page.screenshot({ path: 'test-results/ui-mobile.png' });
});
