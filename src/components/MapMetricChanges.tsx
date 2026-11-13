import { Heart, HeartCrack } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MONTH_MS } from '../game/data';
import type { AreaState } from '../game/types';
import type { Point } from '../map/geometry';
import {
    accumulateMetricChanges,
    METRIC_CHANGE_DURATION,
    type MetricChange,
    spreadMetricChanges,
} from '../map/metricChanges';
import { randomRegionPoint } from '../map/randomRegionPoint';
import type { MapRegion } from '../map/types';
import { type MapView, parseRegions, screenPoint } from '../map/view';
import styles from './WorldMap.module.css';

interface Popup extends MetricChange {
    id: number;
    createdAt: number;
    delay: number;
    duration: number;
    expires: number;
    world: Point;
}

// 表示演出の予約量を固定し、大きな指標変化でもDOMと待ち行列を増やし続けない。
const MAX_POPUPS = 128;
const POPUP_SPACING = 90;
const SCHEDULE_WINDOW = MONTH_MS;

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
    const container = useRef<HTMLDivElement>(null);
    const popupAnimations = useRef<{ animation: Animation; createdAt: number }[]>([]);
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
        // 地域順をシャッフルし、1か月分の時間枠へ均等に分散する。
        // 各枠にも揺らぎを入れ、ランダム抽選だけで生じる表示の密集や空白を抑える。
        const shuffled = [...changes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const activeReservations = appearances.current.filter(
            (start) => start > now - POPUP_SPACING,
        );
        const available = MAX_POPUPS - popups.filter((popup) => popup.expires > now).length;
        const selected = spreadMetricChanges(shuffled, Math.max(0, available));
        const interval = SCHEDULE_WINDOW / Math.max(1, selected.length);
        const scheduled = selected.map((change, index) => ({
            change,
            at: now + 100 + (index + 0.1 + Math.random() * 0.8) * interval,
        }));
        appearances.current = activeReservations;
        const incoming = scheduled.flatMap(({ change, at }) => {
            // 前月から予約済みの通知の間にも差し込み、末尾へ一括で積まない。
            let start = at;
            for (const reserved of [...appearances.current].sort((a, b) => a - b)) {
                if (reserved > start + POPUP_SPACING) break;
                if (Math.abs(reserved - start) < POPUP_SPACING) start = reserved + POPUP_SPACING;
            }
            // 過密な演出は先送りし続けず、この時間枠で表示できる分だけ残す。
            if (start > now + SCHEDULE_WINDOW) return [];
            const shape = shapes.get(change.area);
            const world = shape ? randomRegionPoint(shape) : null;
            if (!world) return [];
            const delay = start - now;
            const duration = METRIC_CHANGE_DURATION * (0.8 + Math.random() * 0.5);
            appearances.current.push(start);
            return [
                {
                    ...change,
                    id: sequence.current++,
                    createdAt: now,
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
    }, [areaStates, tick, serverArea, shapes, popups]);

    useLayoutEffect(() => {
        // CSSの実時間と通知のゲーム内時間を揃える。速度変更・停止でも途中位置を保つ。
        const elements = container.current?.children;
        if (!elements) return;
        const synchronized: { animation: Animation; createdAt: number }[] = [];
        for (let index = 0; index < elements.length; index++) {
            const animation = elements[index].firstElementChild?.getAnimations()[0];
            if (!animation) continue;
            animation.currentTime = elapsed.current - popups[index].createdAt;
            animation.pause();
            synchronized.push({ animation, createdAt: popups[index].createdAt });
        }
        popupAnimations.current = synchronized;
    }, [popups]);

    useEffect(() => {
        if (!popups.length || speed === 0) return;
        let previous = performance.now();
        const nextExpiry = Math.min(...popups.map((popup) => popup.expires));
        let frame: number;
        const visibilityChanged = () => {
            previous = performance.now();
        };
        const advance = (now: number) => {
            if (!document.hidden) elapsed.current += Math.min(now - previous, 250) * speed;
            previous = now;
            // 自動再生とゲーム内時間を二重に進めず、単一の時計から全アイコンを描く。
            for (const { animation, createdAt } of popupAnimations.current) {
                animation.currentTime = elapsed.current - createdAt;
            }
            if (elapsed.current >= nextExpiry) {
                setPopups((current) => current.filter((popup) => popup.expires > elapsed.current));
            } else {
                frame = requestAnimationFrame(advance);
            }
        };
        document.addEventListener('visibilitychange', visibilityChanged);
        visibilityChanged();
        frame = requestAnimationFrame(advance);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('visibilitychange', visibilityChanged);
        };
    }, [popups, speed]);

    if (!view.width || !view.height) return null;
    return (
        <div
            ref={container}
            className={styles.metricChanges}
            data-animation-clock="manual"
            aria-hidden="true"
        >
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
                                <Heart size={14} fill="currentColor" />
                            ) : (
                                <HeartCrack size={14} />
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
