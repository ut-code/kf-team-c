import { useEffect, useRef, useState } from 'react';
import type { CountryState } from '../game/types';
import { fitScale, type Size, visibleWidth, WORLD_WIDTH } from '../map/geometry';
import { TRAFFIC_ROUTES, trafficActivity, trafficPosition } from '../map/traffic';
import styles from './TrafficLayer.module.css';

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function loadImage(path: string) {
    const image = new Image();
    image.src = assetUrl(path);
    return image.decode().then(() => image);
}

export function TrafficLayer({
    size,
    cameraX,
    speed,
    tick,
    countries,
}: {
    size: Size;
    cameraX: number;
    speed: number;
    tick: number;
    countries: Record<string, CountryState>;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const elapsed = useRef(0);
    const previousTick = useRef(tick);
    const [images, setImages] = useState<HTMLImageElement[] | null>(null);
    useEffect(() => {
        let active = true;
        Promise.all([
            loadImage('ui/traffic/plane.svg'),
            loadImage('ui/traffic/ship.svg'),
            loadImage('maps/water-mask.png'),
        ]).then((result) => {
            if (active) setImages(result);
        });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        if (tick < previousTick.current) elapsed.current = 0;
        else if (speed === 0) elapsed.current += tick - previousTick.current;
        previousTick.current = tick;
    }, [tick, speed]);
    useEffect(() => {
        if (!images || size.width === 0 || size.height === 0) return;
        const target = canvas.current!;
        target.dataset.trafficTick = String(tick);
        const ratio = window.devicePixelRatio;
        target.width = Math.round(size.width * ratio);
        target.height = Math.round(size.height * ratio);
        const context = target.getContext('2d')!;
        const ships = document.createElement('canvas');
        ships.width = target.width;
        ships.height = target.height;
        const shipContext = ships.getContext('2d')!;
        const sea = document.createElement('canvas');
        sea.width = target.width;
        sea.height = target.height;
        const seaContext = sea.getContext('2d')!;
        const scale = fitScale(size);
        const period = WORLD_WIDTH * scale;
        const width = visibleWidth(size);
        const left = (size.width - width) / 2;
        seaContext.scale(ratio, ratio);
        for (const tile of [0, 1])
            seaContext.drawImage(images[2], left + cameraX + tile * period, 0, period, size.height);
        let previous = performance.now();
        let frame = 0;

        function draw(now: number) {
            if (document.visibilityState === 'visible')
                elapsed.current += ((now - previous) / 1000) * speed;
            previous = now;
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            shipContext.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, size.width, size.height);
            shipContext.clearRect(0, 0, size.width, size.height);
            context.save();
            context.beginPath();
            context.rect(left, 0, width, size.height);
            context.clip();
            for (const route of TRAFFIC_ROUTES) {
                const activity = trafficActivity(route, countries);
                if (route.phase > activity) continue;
                const position = trafficPosition(route, elapsed.current);
                if (!position) continue;
                const x = left + ((position.x * scale + cameraX + period) % period);
                const y = position.y * scale;
                const isShip = route.kind === 'ship';
                const drawing = isShip ? shipContext : context;
                drawing.save();
                drawing.translate(x, y);
                drawing.globalAlpha =
                    position.opacity * (isShip ? 0.67 : 0.76) * Math.min(1, activity + 0.3);
                // 軌跡を進行方向へ向ける。
                drawing.save();
                drawing.rotate(position.heading);
                drawing.strokeStyle = isShip
                    ? 'rgba(171, 194, 198, .32)'
                    : 'rgba(220, 220, 207, .24)';
                drawing.lineWidth = isShip ? 1.3 : 0.8;
                drawing.beginPath();
                drawing.moveTo(-6, 0);
                drawing.lineTo(isShip ? -13 : -22, 0);
                drawing.stroke();
                drawing.restore();
                if (isShip) {
                    // Kenneyモデルの俯瞰図。船首は上なので90度補正する。
                    drawing.rotate(position.heading + Math.PI / 2);
                    drawing.drawImage(images![1], -3.5, -10, 7, 20);
                } else {
                    // 元アセットの機首は右上45度。
                    drawing.rotate(position.heading + Math.PI / 4);
                    drawing.drawImage(images![0], -7, -7, 14, 14);
                }
                drawing.restore();
            }
            // 110m海岸に合わせた海マスクで、船影が陸に重ならないようにする。
            shipContext.globalCompositeOperation = 'destination-in';
            shipContext.drawImage(sea, 0, 0, size.width, size.height);
            shipContext.globalCompositeOperation = 'source-over';
            context.drawImage(ships, 0, 0, size.width, size.height);
            context.restore();
            target.dataset.trafficTime = elapsed.current.toFixed(4);
            if (speed > 0) frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [images, size, cameraX, speed, tick, countries]);
    return (
        <div className={styles.layer} aria-hidden="true">
            <canvas ref={canvas} tabIndex={-1} data-traffic-layer />
        </div>
    );
}
