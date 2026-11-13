import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';
import { parseSkillPositions } from '../src/game/skillLayoutPositions.ts';

/** 開発サーバーだけが、固定の配置ファイルへの保存を受け付ける。 */
export function skillLayoutEditor(
    file = fileURLToPath(new URL('../src/content/skillPositions.json', import.meta.url)),
): Plugin {
    return {
        name: 'skill-layout-editor',
        apply: 'serve',
        handleHotUpdate(context) {
            // 保存後もゲームと編集中のカメラを保持する。再表示時にはGETで最新配置を読む。
            if (context.file === normalizePath(file)) return [];
        },
        configureServer(server) {
            server.middlewares.use('/__debug/skill-positions', async (request, response) => {
                response.setHeader('Cache-Control', 'no-store');
                if (request.method !== 'GET' && request.method !== 'PUT') {
                    response.writeHead(405, { Allow: 'GET, PUT' }).end();
                    return;
                }
                if (
                    request.method === 'PUT' &&
                    !sameOrigin(request.headers.origin, request.headers.host)
                ) {
                    response.writeHead(403).end('同じ開発サーバーの画面から保存してください');
                    return;
                }
                try {
                    // 起動時に固定しない。開発中にノード数が変わっても、現在のファイルを基準にする。
                    const current = JSON.parse(await readFile(file, 'utf8'));
                    const expectedIds = Object.keys(current);
                    if (request.method === 'GET') {
                        response
                            .writeHead(200, { 'Content-Type': 'application/json' })
                            .end(JSON.stringify(current));
                        return;
                    }
                    const chunks: Uint8Array[] = [];
                    let size = 0;
                    for await (const chunk of request) {
                        size += chunk.length;
                        if (size > 64 * 1024) {
                            response.writeHead(413).end('配置データが大きすぎます');
                            return;
                        }
                        chunks.push(chunk);
                    }
                    const positions = parseSkillPositions(
                        JSON.parse(Buffer.concat(chunks).toString('utf8')),
                        expectedIds,
                    );
                    if (!positions) {
                        response
                            .writeHead(400)
                            .end(
                                '現在のスキルの座標が不足しているか、数値が不正です。画面を開き直してください',
                            );
                        return;
                    }
                    const temporary = `${file}.${randomUUID()}.tmp`;
                    await writeFile(
                        temporary,
                        `${JSON.stringify(positions, null, 4)}\n`.replaceAll('\n', '\r\n'),
                        'utf8',
                    );
                    await rename(temporary, file);
                    response
                        .writeHead(200, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify(positions));
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        response.writeHead(400).end('配置データのJSONが不正です');
                        return;
                    }
                    server.config.logger.error(`スキル配置の保存に失敗しました：${String(error)}`);
                    response.writeHead(500).end('配置ファイルへ保存できませんでした');
                }
            });
        },
    };
}

function sameOrigin(origin: string | undefined, host: string | undefined) {
    try {
        const url = new URL(origin ?? '');
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.host === host;
    } catch {
        return false;
    }
}
