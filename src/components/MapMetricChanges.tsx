import { useEffect, useMemo, useRef, useState } from 'react';
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
    expires: number;
    world: Point;
}

export function MapMetricChanges({
    areaStates,
    regions,
    tick,
    serverArea,
    view,
}: {
    areaStates: AreaState[];
    regions: MapRegion[];
    tick: number;
    serverArea: number;
    view: MapView;
}) {
    const previous = useRef({ areaStates, tick, serverArea });
    const baseline = useRef(areaStates.map((state) => ({ ...state })));
    const sequence = useRef(0);
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
            return;
        }
        if (areaStates === before.areaStates) return;
        const now = performance.now();
        const accumulated = accumulateMetricChanges(baseline.current, areaStates);
        baseline.current = accumulated.baseline;
        const changes = accumulated.changes;
        if (!changes.length) return;
        const incoming = changes.flatMap((change) => {
            const shape = shapes.get(change.area);
            const world = shape ? randomRegionPoint(shape) : null;
            return world
                ? [
                      {
                          ...change,
                          id: sequence.current++,
                          expires: now + METRIC_CHANGE_DURATION,
                          world,
                      },
                  ]
                : [];
        });
        setPopups((current) => {
            const replaced = new Set(changes.map((change) => `${change.area}:${change.metric}`));
            return [
                ...current.filter(
                    (popup) =>
                        popup.expires > now && !replaced.has(`${popup.area}:${popup.metric}`),
                ),
                ...incoming,
            ];
        });
    }, [areaStates, tick, serverArea, shapes]);

    useEffect(() => {
        if (!popups.length) return;
        const timer = window.setTimeout(
            () => {
                setPopups((current) =>
                    current.filter((popup) => popup.expires > performance.now()),
                );
            },
            Math.max(0, Math.min(...popups.map((popup) => popup.expires)) - performance.now()) + 16,
        );
        return () => window.clearTimeout(timer);
    }, [popups]);

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
                            className={`${styles.metricPopup} ${popup.delta > 0 ? styles.metricUp : styles.metricDown}`}
                            style={{ animationDuration: `${METRIC_CHANGE_DURATION}ms` }}
                        >
                            <span className={styles.metricArrow}>
                                {popup.delta > 0 ? '↑' : '↓'}
                            </span>
                            {popup.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
