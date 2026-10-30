import { WORLD_HEIGHT, WORLD_WIDTH } from './geometry.ts';
import type { VisibleMarker } from './view.ts';

/** 地図座標上の最小間隔。人口点の重なりを許容する。 */
export const POPULATION_MIN_GAP = 3;

/** 統計上の位置を保ち、投影後の地図座標だけを近くの空き位置へ分散する。 */
export function declutterMarkers(markers: VisibleMarker[]): VisibleMarker[] {
    const count = markers.filter(({ marker }) => marker.kind === 'population').length;
    if (!count) return markers;
    const gap = POPULATION_MIN_GAP;
    const left = gap,
        right = WORLD_WIDTH - gap;
    const top = gap,
        bottom = WORLD_HEIGHT - gap;
    const columns = Math.ceil((right - left) / gap) + 1;
    const rows = Math.ceil((bottom - top) / gap) + 1;
    // 数値配列の空間索引で、密集地域でも候補ごとの文字列生成を避ける。
    const heads = new Int32Array(columns * rows).fill(-1);
    const next = new Int32Array(count);
    const xs = new Float64Array(count),
        ys = new Float64Array(count);
    const angle = Math.PI * (3 - Math.sqrt(5));
    const offsetsX = [0],
        offsetsY = [0];
    let placed = 0;
    return markers.map((item) => {
        if (item.marker.kind !== 'population') return item;
        const originX = Math.max(left, Math.min(right, item.x));
        const originY = Math.max(top, Math.min(bottom, item.y));
        const phase = Number(item.marker.id) * angle;
        const cosine = Math.cos(phase),
            sine = Math.sin(phase);
        for (let attempt = 0; ; attempt++) {
            if (attempt === offsetsX.length) {
                const radius = gap * 0.72 * Math.sqrt(attempt);
                offsetsX.push(Math.cos(attempt * angle) * radius);
                offsetsY.push(Math.sin(attempt * angle) * radius);
            }
            const x = originX + offsetsX[attempt] * cosine - offsetsY[attempt] * sine;
            const y = originY + offsetsX[attempt] * sine + offsetsY[attempt] * cosine;
            if (x < left || x > right || y < top || y > bottom) continue;
            const column = Math.floor((x - left) / gap),
                row = Math.floor((y - top) / gap);
            let occupied = false;
            for (
                let c = Math.max(0, column - 1);
                c <= Math.min(columns - 1, column + 1) && !occupied;
                c++
            ) {
                for (
                    let r = Math.max(0, row - 1);
                    r <= Math.min(rows - 1, row + 1) && !occupied;
                    r++
                ) {
                    for (let index = heads[c + r * columns]; index !== -1; index = next[index]) {
                        if ((xs[index] - x) ** 2 + (ys[index] - y) ** 2 < gap ** 2) {
                            occupied = true;
                            break;
                        }
                    }
                }
            }
            if (occupied) continue;
            const cell = column + row * columns;
            xs[placed] = x;
            ys[placed] = y;
            next[placed] = heads[cell];
            heads[cell] = placed++;
            return { ...item, x, y };
        }
    });
}
