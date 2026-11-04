import { type RegionShape, regionAtPoint } from './view.ts';

/** 分離した島や穴も考慮し、地域の陸地内から表示地点を選ぶ。 */
export function randomRegionPoint(shape: RegionShape) {
    const rings = shape.rings.map(({ bounds }) => ({
        bounds,
        weight: (bounds.right - bounds.left) * (bounds.bottom - bounds.top),
    }));
    const total = rings.reduce((sum, ring) => sum + ring.weight, 0);
    if (!total) return null;
    for (let attempt = 0; attempt < 256; attempt++) {
        let remaining = Math.random() * total;
        const ring = rings.find(({ weight }) => {
            remaining -= weight;
            return remaining < 0;
        });
        if (!ring) continue;
        const { left, top, right, bottom } = ring.bounds;
        const x = left + Math.random() * (right - left);
        const y = top + Math.random() * (bottom - top);
        if (regionAtPoint([shape], x, y) !== null) return { x, y };
    }
    return null;
}
