import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

/** 開発サーバーだけが、固定の配置ファイルへの保存を受け付ける。 */
export function skillLayoutEditor(): Plugin {
    const file = fileURLToPath(new URL('../src/content/skillPositions.json', import.meta.url));
    return {
        name: 'skill-layout-editor',
        apply: 'serve',
        handleHotUpdate(context) {
            // 編集画面には移動後の位置があるため、保存で画面やカメラを初期化しない。
            if (context.file === normalizePath(file)) return [];
        },
        async configureServer(server) {
            const expectedIds = Object.keys(JSON.parse(await readFile(file, 'utf8')));
            server.middlewares.use('/__debug/skill-positions', async (request, response) => {
                if (request.method !== 'PUT') {
                    response.writeHead(405, { Allow: 'PUT' }).end();
                    return;
                }
                if (request.headers.origin !== `http://${request.headers.host}`) {
                    response.writeHead(403).end();
                    return;
                }
                try {
                    const chunks: Buffer[] = [];
                    let size = 0;
                    for await (const chunk of request) {
                        size += chunk.length;
                        if (size > 64 * 1024) {
                            response.writeHead(413).end();
                            return;
                        }
                        chunks.push(chunk);
                    }
                    const positions: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (!validPositions(positions, expectedIds)) {
                        response.writeHead(400).end('ノードIDと座標を確認してください');
                        return;
                    }
                    const ordered = Object.fromEntries(
                        expectedIds.map((id) => [id, positions[id]]),
                    );
                    await writeFile(
                        file,
                        `${JSON.stringify(ordered, null, 4)}\n`.replaceAll('\n', '\r\n'),
                        'utf8',
                    );
                    response.writeHead(204).end();
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        response.writeHead(400).end();
                        return;
                    }
                    server.config.logger.error(`スキル配置の保存に失敗しました：${String(error)}`);
                    response.writeHead(500).end('配置を保存できませんでした');
                }
            });
        },
    };
}

function validPositions(
    value: unknown,
    ids: string[],
): value is Record<string, { x: number; y: number }> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return (
        entries.length === ids.length &&
        entries.every(
            ([id, point]) =>
                ids.includes(id) &&
                point &&
                typeof point === 'object' &&
                !Array.isArray(point) &&
                Object.keys(point).length === 2 &&
                typeof point.x === 'number' &&
                Number.isFinite(point.x) &&
                typeof point.y === 'number' &&
                Number.isFinite(point.y),
        )
    );
}
