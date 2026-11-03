import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function browser() {
    await mkdir(resolve('tmp/browser-check'), { recursive: true });
    const executable =
        process.env.CHROME_PATH ||
        [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
        ].find((path) => existsSync(path));
    if (!executable) throw new Error('Set CHROME_PATH to a Chrome/Chromium executable.');
    const profile = resolve(`tmp/browser-check/profile-${Date.now()}`);
    const chrome = spawn(
        executable,
        [
            '--headless=new',
            '--remote-debugging-port=0',
            '--no-first-run',
            '--no-default-browser-check',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-background-timer-throttling',
            `--user-data-dir=${profile}`,
            'about:blank',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const endpoint = await new Promise((ok, fail) => {
        let out = '';
        chrome.stderr.on('data', (data) => {
            out += data;
            const match = out.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) ok(match[1]);
        });
        chrome.on('error', fail);
        setTimeout(
            () => fail(new Error(`Chrome startup timeout: ${out.slice(-1500)}`)),
            20000,
        ).unref();
    });
    const socket = new WebSocket(endpoint);
    await new Promise((ok, fail) => {
        socket.onopen = ok;
        socket.onerror = fail;
    });
    let seq = 0;
    const pending = new Map();
    const events = [];
    socket.onclose = () => {
        for (const p of pending.values()) p.fail(new Error('Browser closed'));
        pending.clear();
    };
    socket.onmessage = ({ data }) => {
        const msg = JSON.parse(data);
        if (msg.id) {
            const p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) p.fail(new Error(JSON.stringify(msg.error)));
            else p.ok(msg.result);
        } else events.push(msg);
    };
    const call = (method, params = {}, sessionId) =>
        new Promise((ok, fail) => {
            const id = ++seq;
            const timeout = setTimeout(() => {
                pending.delete(id);
                fail(new Error(`CDP timeout: ${method}`));
            }, 15000);
            pending.set(id, {
                ok: (value) => {
                    clearTimeout(timeout);
                    ok(value);
                },
                fail: (error) => {
                    clearTimeout(timeout);
                    fail(error);
                },
            });
            socket.send(JSON.stringify({ id, method, params, sessionId }));
        });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => call(method, params, sessionId);
    await page('Runtime.enable');
    await page('Page.enable');
    const evaluate = async (expression) => {
        const r = await page('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
        });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
    };
    const waitFor = async (expression) => {
        for (let i = 0; i < 200; i++) {
            if (await evaluate(expression)) return;
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Timed out: ${expression}`);
    };
    const screenshot = async (name) => {
        const { data } = await page('Page.captureScreenshot', { format: 'png' });
        await writeFile(resolve(`tmp/browser-check/${name}.png`), Buffer.from(data, 'base64'));
    };
    return {
        page,
        evaluate,
        waitFor,
        screenshot,
        events,
        close: async () => {
            await call('Browser.close').catch(() => {});
            socket.close();
            chrome.kill();
        },
    };
}
