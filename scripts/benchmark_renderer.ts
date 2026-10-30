import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { project } from '../src/map/geometry.ts';
import type { Country, MapMarker } from '../src/map/types.ts';
import {
    countryAtPoint,
    cullMarkers,
    type MapView,
    parseCountries,
    renderSize,
} from '../src/map/view.ts';

const countries: Country[] = JSON.parse(
    readFileSync('public/maps/comparison/countries.json', 'utf8'),
);
const facilities = JSON.parse(readFileSync('src/game/data/simulation/facilities.json', 'utf8'));
const markers = facilities.map((f: MapMarker & { name: string }) => ({
    marker: { ...f, kind: 'facility', label: f.name } as MapMarker,
    ...project(f.longitude, f.latitude),
}));
const started = performance.now(),
    shapes = parseCountries(countries),
    geometryMs = performance.now() - started;
const frames = 600;
const scenarios = [
    { width: 1280, height: 720, dpr: 1 },
    { width: 1920, height: 1080, dpr: 1.5 },
].flatMap((screen) =>
    [1, 3].map((zoom) => {
        const view: MapView = {
            width: screen.width,
            height: screen.height,
            zoom,
            x: -1500,
            y: (screen.height * (1 - zoom)) / 2,
        };
        const oldHeight = screen.height * zoom,
            oldRatio = Math.min(screen.dpr, 1.5);
        const trafficPixels =
            Math.round(screen.width * oldRatio) * Math.round(oldHeight * oldRatio) * 3;
        const oceanRatio = Math.min(
            screen.dpr,
            1.5,
            Math.sqrt(1_036_800 / (screen.width * oldHeight)),
        );
        const oceanPixels =
            Math.floor(screen.width * oceanRatio) * Math.floor(oldHeight * oceanRatio);
        const main = renderSize(view, screen.dpr),
            wave = renderSize(view, screen.dpr, 1_036_800);
        const newPixels = main.width * main.height * 2 + wave.width * wave.height;
        let visible = 0;
        const cullStart = performance.now();
        for (let i = 0; i < frames; i++)
            visible = cullMarkers(markers, { ...view, x: view.x - i * 2 }).length;
        const cullMs = (performance.now() - cullStart) / frames;
        return {
            screen,
            zoom,
            oldDynamicTargetPixels: trafficPixels + oceanPixels,
            newTargetPixels: newPixels,
            reductionPercent:
                Math.round((1 - newPixels / (trafficPixels + oceanPixels)) * 1000) / 10,
            visibleFacilities: visible,
            totalFacilities: markers.length,
            cullCpuMs: cullMs,
            mainTarget: [main.width, main.height],
        };
    }),
);
const hitStart = performance.now();
for (let i = 0; i < 1000; i++) {
    const p = project(-179 + i * 0.358, -50 + (i % 100));
    countryAtPoint(shapes, p.x, p.y);
}
const hitMs = (performance.now() - hitStart) / 1000;
const report = {
    note: '画素数は描画ターゲットの容量比較。旧CSSフィルターの中間面・ブラウザ内部バッファは含まない。実GPUの速度倍率・メモリー使用量ではない。CPU計測はこの実行環境での値。',
    geometryCompileMs: geometryMs,
    geometryCompilesPerScene: 1,
    geometryCompilesPerAnimationFrame: 0,
    countryHitCpuMs: hitMs,
    oldSvgCountryPaths: countries.length * 2,
    newSvgCountryPaths: 0,
    scenarios,
};
writeFileSync('reports/renderer-benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
