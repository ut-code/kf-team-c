import { project } from '../../map/geometry';
import { type MapView, screenPoint } from '../../map/view';

export interface MapEncounter {
    id: string;
    title: string;
    kind: 'event' | 'chat';
    location: { longitude: number; latitude: number };
}
export function MapEncounterMarkers({
    encounters,
    view,
    onSelect,
}: {
    encounters: MapEncounter[];
    view: MapView;
    onSelect?: (id: string) => void;
}) {
    if (!view.width || !view.height) return null;
    return (
        <section className="map-encounters" aria-label="地図上の出来事">
            {encounters.map((encounter) => {
                const world = project(encounter.location.longitude, encounter.location.latitude);
                const point = screenPoint(view, world.x, world.y);
                if (
                    point.x < -24 ||
                    point.x > view.width + 24 ||
                    point.y < -24 ||
                    point.y > view.height + 24
                )
                    return null;
                return (
                    <button
                        type="button"
                        key={encounter.id}
                        className={`map-encounter-marker ${encounter.kind}`}
                        data-encounter-id={encounter.id}
                        style={{ left: point.x, top: point.y }}
                        aria-label={`${encounter.kind === 'event' ? 'イベント' : '人物からの連絡'}：${encounter.title}`}
                        title={encounter.title}
                        onClick={() => onSelect?.(encounter.id)}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}images/${encounter.kind === 'chat' ? 'chat' : 'event'}-marker.svg`}
                            alt=""
                            draggable={false}
                        />
                    </button>
                );
            })}
        </section>
    );
}
