import { Heart, HeartCrack } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MONTH_MS } from '../game/data';
import type { AreaState } from '../game/types';
import type { Point } from '../map/geometry';
import {
    accumulateMetricChanges,
    METRIC_CHANGE_DURATION,
    type MetricChange,
} from '../map/metricChanges';
import { randomRegionPoint } from '../map/randomRegionPoint';
import type { MapRegion } from '../map/types';
import { type MapView, parseRegions, screenPoint } from '../map/view';
import styles from './WorldMap.module.css';

interface Popup extends MetricChange {
    id: number;
    delay: number;
    duration: number;
    expires: number;
    world: Point;
}

export function MapMetricChanges({
    areaStates,
    regions,
    tick,
    serverArea,
    view,
    speed,
}: {
    areaStates: AreaState[];
    regions: MapRegion[];
    tick: number;
    serverArea: number;
    view: MapView;
    speed: number;
}) {
    const previous = useRef({ areaStates, tick, serverArea });
    const baseline = useRef(areaStates.map((state) => ({ ...state })));
    const sequence = useRef(0);
    const appearances = useRef<number[]>([]);
    const elapsed = useRef(0);
    const [popups, setPopups] = useState<Popup[]>([]);
    const shapes = useMemo(
        () => new Map(parseRegions(regions).map((shape) => [Number(shape.region.id), shape])),
        [regions],
    );

    useEffect(() => {
        const before = previous.current;
        previous.current = { areaStates, tick, serverArea };
        // 新規ゲーム・巻き戻しは指標の変化として通知しない。
        if (tick < before.tick || serverArea !== before.serverArea) {
            baseline.current = areaStates.map((state) => ({ ...state }));
            setPopups([]);
            appearances.current = [];
            return;
        }
        if (areaStates === before.areaStates) return;
        const now = elapsed.current;
        const accumulated = accumulateMetricChanges(baseline.current, areaStates);
        baseline.current = accumulated.baseline;
        const changes = accumulated.changes;
        if (!changes.length) return;
        // 地域順をシャッフルし、4か月分の時間枠へ均等に分散する。
        // 各枠にも揺らぎを入れ、ランダム抽選だけで生じる表示の密集や空白を抑える。
        const shuffled = [...changes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const interval = (MONTH_MS * 4) / shuffled.length;
        const scheduled = shuffled.map((change, index) => ({
            change,
            at: now + 100 + (index + 0.1 + Math.random() * 0.8) * interval,
        }));
        appearances.current = appearances.current.filter((start) => start > now - 90);
        const incoming = scheduled.flatMap(({ change, at }) => {
            const shape = shapes.get(change.area);
            const world = shape ? randomRegionPoint(shape) : null;
            if (!world) return [];
            // 前月から予約済みの通知の間にも差し込み、末尾へ一括で積まない。
            let start = at;
            for (const reserved of [...appearances.current].sort((a, b) => a - b)) {
                if (reserved > start + 90) break;
                if (Math.abs(reserved - start) < 90) start = reserved + 90;
            }
            const delay = start - now;
            const duration = METRIC_CHANGE_DURATION * (0.8 + Math.random() * 0.5);
            appearances.current.push(start);
            return [
                {
                    ...change,
                    id: sequence.current++,
                    delay,
                    duration,
                    expires: start + duration,
                    world,
                },
            ];
        });
        setPopups((current) => {
            return [...current.filter((popup) => popup.expires > now), ...incoming];
        });
    }, [areaStates, tick, serverArea, shapes]);

    useEffect(() => {
        if (!popups.length || speed === 0) return;
        let previous = performance.now();
        const nextExpiry = Math.min(...popups.map((popup) => popup.expires));
        let frame: number;
        const advance = (now: number) => {
            elapsed.current += (now - previous) * speed;
            previous = now;
            if (elapsed.current >= nextExpiry) {
                setPopups((current) => current.filter((popup) => popup.expires > elapsed.current));
            } else {
                frame = requestAnimationFrame(advance);
            }
        };
        frame = requestAnimationFrame(advance);
        return () => cancelAnimationFrame(frame);
    }, [popups, speed]);

    if (!view.width || !view.height) return null;
    return (
        <div className={styles.metricChanges} aria-hidden="true">
            {popups.map((popup) => {
                const point = screenPoint(view, popup.world.x, popup.world.y);
                return (
                    <div
                        key={popup.id}
                        className={styles.metricAnchor}
                        data-metric-change={popup.metric}
                        data-area={popup.area}
                        style={{ left: point.x, top: point.y }}
                    >
                        <span
                            className={styles.metricPopup}
                            data-change={popup.delta > 0 ? 'up' : 'down'}
                            style={{
                                animationDuration: `${popup.duration}ms`,
                                animationDelay: `${popup.delay}ms`,
                            }}
                        >
                            {popup.delta > 0 ? (
                                <Heart size={11} fill="currentColor" />
                            ) : (
                                <HeartCrack size={11} />
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
