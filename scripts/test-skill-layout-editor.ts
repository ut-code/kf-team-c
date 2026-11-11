import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createServer } from 'vite';
import { skillLayoutEditor } from './skill-layout-editor.ts';

test('配置保存は再起動せずにノード削減へ追従し、再読込とHTTPS経由の編集にも対応する', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'skill-layout-'));
    const file = join(folder, 'positions.json');
    const old = { reason: { x: -160, y: -75 }, removed: { x: 400, y: -200 } };
    await writeFile(file, JSON.stringify(old));
    const server = await createServer({
        configFile: false,
        plugins: [skillLayoutEditor(file)],
        server: { host: '127.0.0.1', port: 0 },
        logLevel: 'silent',
    });
    try {
        await server.listen();
        const address = server.httpServer!.address();
        assert.ok(address && typeof address !== 'string');
        const base = `http://127.0.0.1:${address.port}`;
        const endpoint = `${base}/__debug/skill-positions`;
        assert.deepEqual(await (await fetch(endpoint)).json(), old);
        // ゲームを編集してノードを削減したが、開発サーバーは動かし続けている。
        await writeFile(file, JSON.stringify({ reason: old.reason }));
        const save = (body: unknown, origin = base) =>
            fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Origin: origin },
                body: JSON.stringify(body),
            });
        const staleClient = { reason: { x: -180, y: -90 }, removed: old.removed };
        const saved = await save(staleClient);
        assert.equal(saved.status, 200);
        const expected = { reason: staleClient.reason };
        assert.deepEqual(await saved.json(), expected);
        assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), expected);
        assert.deepEqual(await (await fetch(endpoint)).json(), expected);
        assert.equal((await save(expected, base.replace('http:', 'https:'))).status, 200);
        assert.equal((await save(expected, 'https://other.example')).status, 403);
        assert.equal((await save({})).status, 400);
        assert.equal((await save({ reason: { x: null, y: 0 } })).status, 400);
        assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), expected);
        assert.equal((await fetch(endpoint, { method: 'POST' })).status, 405);
        const results = await Promise.all([
            save({ reason: { x: -200, y: 0 } }),
            save({ reason: { x: -220, y: 0 } }),
        ]);
        assert.ok(results.every((result) => result.status === 200));
        assert.ok([-200, -220].includes(JSON.parse(await readFile(file, 'utf8')).reason.x));
    } finally {
        await server.close();
        await rm(folder, { recursive: true, force: true });
    }
});
