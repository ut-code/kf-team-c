import { Pause } from 'lucide-react';
import { project } from '../../map/geometry';
import { type MapView, screenPoint } from '../../map/view';

export interface MapEncounter {
    id: string;
    title: string;
    kind: 'event' | 'chat' | 'investigation';
    progress?: number;
    researchSpeed?: number;
    paused?: boolean;
    location: { longitude: number; latitude: number };
}
export function MapEncounterMarkers({
    encounters,
    view,
    onSelect,
}: {
    encounters: MapEncounter[];
    view: MapView;
    onSelect?: (id: string, anchorX?: number, anchorY?: number) => void;
}) {
    if (!view.width || !view.height) return null;
    const placed: { x: number; y: number }[] = [];
    // 当たり判定と進捗バーを含めた間隔を確保する。ズーム・移動後も画面座標で判定。
    const spacing = 52;
    const markers = encounters.flatMap((encounter) => {
        const world = project(encounter.location.longitude, encounter.location.latitude);
        const anchor = screenPoint(view, world.x, world.y);
        if (
            anchor.x < -24 ||
            anchor.x > view.width + 24 ||
            anchor.y < -24 ||
            anchor.y > view.height + 24
        )
            return [];
        const origin = {
            x: Math.max(24, Math.min(view.width - 24, anchor.x)),
            y: Math.max(48, Math.min(view.height - 8, anchor.y)),
        };
        const candidates = [origin];
        for (let x = 24; x <= view.width - 24; x += spacing) {
            for (let y = 48; y <= view.height - 8; y += spacing) {
                candidates.push({ x, y });
            }
        }
        candidates.sort(
            (a, b) =>
                Math.hypot(a.x - origin.x, a.y - origin.y) -
                Math.hypot(b.x - origin.x, b.y - origin.y),
        );
        const point = candidates.find((candidate) =>
            placed.every(
                (other) =>
                    Math.abs(candidate.x - other.x) >= spacing ||
                    Math.abs(candidate.y - other.y) >= spacing,
            ),
        )!;
        placed.push(point);
        return [{ encounter, point, anchor }];
    });
    return (
        <section className="map-encounters" aria-label="地図上の出来事">
            <svg
                className="map-encounter-links"
                width={view.width}
                height={view.height}
                aria-hidden="true"
            >
                {markers.map(({ encounter, point, anchor }) =>
                    Math.hypot(point.x - anchor.x, point.y - anchor.y) > 8 ? (
                        <line
                            key={encounter.id}
                            x1={anchor.x}
                            y1={anchor.y}
                            x2={point.x}
                            y2={point.y - 16}
                        />
                    ) : null,
                )}
            </svg>
            {markers.map(({ encounter, point }) => {
                return (
                    <button
                        type="button"
                        key={encounter.id}
                        className={`map-encounter-marker ${encounter.kind}`}
                        data-encounter-id={encounter.id}
                        style={{ left: point.x, top: point.y }}
                        aria-label={`${encounter.kind === 'investigation' ? '内部調査' : encounter.kind === 'event' ? 'イベント' : '人物からの連絡'}：${encounter.title}`}
                        title={encounter.title}
                        onClick={(event) => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            onSelect?.(
                                encounter.id,
                                bounds.left + bounds.width / 2,
                                bounds.top + bounds.height / 2,
                            );
                        }}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}images/${encounter.kind === 'chat' ? 'chat' : encounter.kind === 'investigation' ? 'investigation' : 'event'}-marker.svg`}
                            style={
                                encounter.kind === 'investigation'
                                    ? {
                                          opacity:
                                              0.35 +
                                              Math.min(1, encounter.researchSpeed ?? 1) * 0.65,
                                      }
                                    : undefined
                            }
                            alt=""
                            draggable={false}
                        />
                        {encounter.paused && (
                            <Pause
                                className="research-paused"
                                size={13}
                                aria-label="研究停止・待機中"
                            />
                        )}
                        {encounter.kind === 'investigation' && (
                            <progress
                                className="map-research-progress"
                                aria-label={`${encounter.title}の研究進捗`}
                                value={encounter.progress ?? 0}
                                max={100}
                            />
                        )}
                    </button>
                );
            })}
        </section>
    );
}
