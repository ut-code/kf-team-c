import { Pause } from 'lucide-react';
import { project } from '../../map/geometry';
import { type MapView, screenPoint } from '../../map/view';

export interface MapEncounter {
    id: string;
    title: string;
    kind: 'investigation' | 'regulation';
    progress?: number;
    stage?: string;
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
    const markers = encounters.flatMap((encounter) => {
        const world = project(encounter.location.longitude, encounter.location.latitude);
        const point = screenPoint(view, world.x, world.y);
        if (
            point.x < -24 ||
            point.x > view.width + 24 ||
            point.y < -24 ||
            point.y > view.height + 24
        )
            return [];
        return [{ encounter, point }];
    });
    return (
        <section className="map-encounters" aria-label="地図上の出来事">
            {markers.map(({ encounter, point }) => {
                return (
                    <button
                        type="button"
                        key={encounter.id}
                        className={`map-encounter-marker ${encounter.kind}`}
                        data-encounter-id={encounter.id}
                        style={{ left: point.x, top: point.y }}
                        aria-label={`${encounter.kind === 'regulation' ? '法律・規制' : '研究・調査'}：${encounter.title}`}
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
                            src={`${import.meta.env.BASE_URL}images/${encounter.kind}-marker.svg`}
                            style={{
                                opacity: 0.35 + Math.min(1, encounter.researchSpeed ?? 1) * 0.65,
                            }}
                            alt=""
                            draggable={false}
                        />
                        {encounter.paused && (
                            <Pause
                                className="research-paused"
                                size={13}
                                aria-label={
                                    encounter.kind === 'regulation'
                                        ? '手続き停止・待機中'
                                        : '研究停止・待機中'
                                }
                            />
                        )}
                        <span className="map-research-stage">{encounter.stage}</span>
                        <progress
                            className="map-research-progress"
                            aria-label={`${encounter.title}の進捗`}
                            value={encounter.progress ?? 0}
                            max={100}
                        />
                    </button>
                );
            })}
        </section>
    );
}
