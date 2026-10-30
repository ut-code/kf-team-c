/** 波の格子の四隅を事前計算する。毎画素24回のsinを、6回の小さなテクスチャ参照へ置き換える。 */
export function createWaveNoise() {
    const bytes = new Uint8Array(128 * 64 * 4);
    const hash = (x: number, y: number) => {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return Math.round((n - Math.floor(n)) * 255);
    };
    for (const [repeat, offset] of [
        [64, 0],
        [16, 64],
        [8, 80],
    ]) {
        for (let y = 0; y < repeat; y++)
            for (let x = 0; x < repeat; x++) {
                bytes.set(
                    [
                        hash(x, y),
                        hash((x + 1) % repeat, y),
                        hash(x, (y + 1) % repeat),
                        hash((x + 1) % repeat, (y + 1) % repeat),
                    ],
                    (y * 128 + x + offset) * 4,
                );
            }
    }
    return bytes;
}
