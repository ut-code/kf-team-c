import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

const [baseUrl, browserPath] = process.argv.slice(2);
if (!baseUrl || !browserPath)
    throw new Error('検証サーバーURLとEdge実行ファイルを指定してください。');
const profile = await mkdtemp(join(tmpdir(), 'humanity-renderer-'));
if (
    !resolve(profile).startsWith(resolve(tmpdir()) + sep) ||
    !basename(profile).startsWith('humanity-renderer-')
)
    throw new Error('一時ディレクトリの範囲が不正です。');
const browser = spawn(
    browserPath,
    [
        '--headless=new',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let send;
try {
    let info;
    for (let n = 0; n < 60; n++) {
        try {
            const port = Number(
                (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0],
            );
            info = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
            if (info.length) break;
        } catch {}
        await delay(200);
    }
    ws = new WebSocket(info.find((p) => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map(),
        errors = [];
    ws.addEventListener('message', (event) => {
        const m = JSON.parse(event.data);
        if (m.id) {
            const p = pending.get(m.id);
            pending.delete(m.id);
            m.error ? p.reject(m.error) : p.resolve(m.result);
        } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    });
    send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const current = ++id;
            pending.set(current, { resolve, reject });
            ws.send(JSON.stringify({ id: current, method, params }));
        });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await send('Page.navigate', { url: `${baseUrl}/tests/renderer-smoke.html` });
    let result;
    for (let n = 0; n < 180; n++) {
        result = await evaluate('window.result');
        if (result?.ready || result?.failures?.length) break;
        await delay(200);
    }
    console.log(JSON.stringify({ stage: 'initial', result, errors }));
    if (!result?.ready || result.failures.length || errors.length)
        throw new Error('初回描画に失敗');
    const initial = await evaluate(
        `({stats:window.test.renderer.stats,gl:window.test.canvas.getContext('webgl').getError(),hit:window.test.renderer.hitTest(...Object.values(window.test.screenPoint(window.test.view,...Object.values(window.test.project(139.75,35.68)))) )})`,
    );
    console.log(JSON.stringify({ stage: 'render', initial }));
    if (initial.gl) throw new Error('WebGL描画エラー');
    const shots = await send('Page.captureScreenshot', { format: 'png' });
    await mkdir('reports', { recursive: true });
    await writeFile('reports/world-renderer.png', Buffer.from(shots.data, 'base64'));
    const readPixels = async (points) => {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        return JSON.parse(
            execFileSync(
                'python',
                [
                    '-c',
                    "import sys,json,base64,io; from PIL import Image; d=json.load(sys.stdin); im=Image.open(io.BytesIO(base64.b64decode(d['png']))).convert('RGB'); print(json.dumps([im.getpixel(tuple(p)) for p in d['points']]))",
                ],
                { input: JSON.stringify({ png: shot.data, points }), encoding: 'utf8' },
            ),
        );
    };
    const points = await evaluate(
        `[[135,-25],[-30,0]].map(([lon,lat])=>{const p=window.test.project(lon,lat);const s=window.test.screenPoint(window.test.view,p.x,p.y);return [Math.round(s.x),Math.round(s.y)]})`,
    );
    const original = await readPixels(points);
    await evaluate(`document.documentElement.style.setProperty('--map-land-brightness','0.5')`);
    await delay(100);
    const landTone = await readPixels(points);
    await evaluate(
        `document.documentElement.style.removeProperty('--map-land-brightness');document.documentElement.style.setProperty('--map-ocean-brightness','0.5')`,
    );
    await delay(100);
    const oceanTone = await readPixels(points);
    console.log(
        JSON.stringify({
            stage: 'tone',
            points,
            original,
            landTone,
            oceanTone,
            stats: await evaluate('window.test.renderer.stats'),
        }),
    );
    const close = (a, b, tolerance = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
    if (
        !close(
            landTone[0],
            original[0].map((v) => v * 0.5),
        ) ||
        !close(landTone[1], original[1], 1) ||
        !close(
            oceanTone[1],
            original[1].map((v) => v * 0.5),
        ) ||
        !close(oceanTone[0], original[0], 1)
    )
        throw new Error('陸と水域の色調独立設定に失敗');
    await evaluate(`document.documentElement.style.removeProperty('--map-ocean-brightness')`);
    await delay(100);
    const tone = { points, original, landTone, oceanTone };
    await evaluate(`window.test.renderer.setView({...window.test.view,zoom:3,y:-720});`);
    await delay(200);
    const zoomed = await evaluate(
        '({width:window.test.canvas.width,height:window.test.canvas.height,gl:window.test.canvas.getContext("webgl").getError(),stats:window.test.renderer.stats})',
    );
    await evaluate(
        `window.test.renderer.setData({...window.test.data,parameterValues:Object.fromEntries(window.test.data.countries.map(c=>[c.id,55]))});`,
    );
    await delay(200);
    const mapData = await evaluate(
        '({gl:window.test.canvas.getContext("webgl").getError(),stats:window.test.renderer.stats})',
    );
    await evaluate(`window.test.renderer.setData(window.test.data);`);
    await delay(200);
    const restored = await evaluate(
        '({gl:window.test.canvas.getContext("webgl").getError(),stats:window.test.renderer.stats})',
    );
    const beforePause = restored.stats.frames;
    await delay(400);
    const afterPause = await evaluate('window.test.renderer.stats.frames');
    if (
        zoomed.gl ||
        mapData.gl ||
        restored.gl ||
        zoomed.width !== 1280 ||
        zoomed.height !== 720 ||
        afterPause !== beforePause
    )
        throw new Error('描画サイズ・表示切替・停止時の検証に失敗');
    await evaluate(`window.test.renderer.setData({...window.test.data,speed:1});`);
    await delay(1000);
    const moving = await evaluate(
        '({stats:window.test.renderer.stats,gl:window.test.canvas.getContext("webgl").getError()})',
    );
    if (
        moving.gl ||
        moving.stats.frames <= afterPause ||
        moving.stats.staticPasses !== restored.stats.staticPasses
    )
        throw new Error('静的地図の再利用に失敗');
    const report = {
        initial,
        tone,
        zoomed,
        mapData,
        restored,
        moving,
        pausedFrames: [beforePause, afterPause],
        errors,
        failures: await evaluate('window.result.failures'),
    };
    await evaluate(
        `window.test.renderer.setData(window.test.data);window.result.ready=false;window.test.renderer.setScene({...{countries:window.test.data.countries,backgroundUrl:'/maps/comparison/satellite-plain.webp',waterMaskUrl:'/maps/comparison/water-mask.png',surfaceMaskUrl:'/maps/comparison/surface-mask.png',countryIndexUrl:'/maps/comparison/country-index.png'}})`,
    );
    for (let n = 0; n < 100; n++) {
        if (await evaluate('window.result.ready')) break;
        await delay(100);
    }
    const switched = await evaluate(
        '({ready:window.result.ready,gl:window.test.canvas.getContext("webgl").getError(),stats:window.test.renderer.stats})',
    );
    if (
        !switched.ready ||
        switched.gl ||
        switched.stats.geometryCompiles !== 1 ||
        switched.stats.textureUploads !== 6
    )
        throw new Error('素材切り替え時の国境・マスク再利用に失敗');
    report.switched = switched;
    await send('Page.navigate', { url: baseUrl });
    for (let n = 0; n < 120; n++) {
        if (
            await evaluate(
                'document.querySelector("[data-world-renderer]") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy")==="false" || document.querySelector("[role=alert]")',
            )
        )
            break;
        await delay(100);
    }
    const game = await evaluate(
        `({ready:document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false',alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),canvases:document.querySelectorAll('canvas').length,svgPaths:document.querySelectorAll('[data-country]').length})`,
    );
    if (!game.ready || game.alerts.length || game.canvases !== 1 || game.svgPaths !== 0)
        throw new Error('ゲーム画面での単一描画に失敗');
    const gameShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile('reports/world-renderer.png', Buffer.from(gameShot.data, 'base64'));
    await evaluate(`document.querySelector('[aria-label="画面内の国と施設"] button').click()`);
    await delay(100);
    game.countrySelected = await evaluate(
        `Boolean([...document.querySelectorAll('h2')].some(e=>e.textContent))`,
    );
    await evaluate(
        `const buttons=[...document.querySelectorAll('[aria-label="画面内の国と施設"] button')];buttons.find(e=>e.textContent.includes('データセンター'))?.click()`,
    );
    await delay(100);
    game.facilitySelected = await evaluate(`Boolean(document.querySelector('figure img'))`);
    if (!game.countrySelected || !game.facilitySelected)
        throw new Error('ゲームの国・施設選択に失敗');
    report.game = game;
    report.errors = errors;
    await writeFile('reports/world-renderer-smoke.json', JSON.stringify(report, null, 2));
    console.log(
        JSON.stringify({
            status: 'passed',
            zoomed: [zoomed.width, zoomed.height],
            pausedFrames: [beforePause, afterPause],
        }),
    );
} finally {
    if (send)
        try {
            await Promise.race([send('Browser.close'), delay(500)]);
        } catch {}
    ws?.close();
    browser.kill();
    try {
        await rm(profile, { recursive: true, force: true, maxRetries: 0 });
    } catch (error) {
        console.error('検証用の一時プロファイルが使用中のため削除を保留:', error.code);
    }
}
