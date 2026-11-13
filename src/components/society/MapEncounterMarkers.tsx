import { Pause, Search } from 'lucide-react';
import type { Investigation } from '../../game/secrecy/types';
import { project } from '../../map/geometry';
import { type MapView, screenPoint } from '../../map/view';
import { ResearchProgress } from './ResearchProgress';
import { researchPresentation } from './researchPresentation';

export interface MapEncounter {
    id: string;
    project: Investigation;
    title: string;
    kind: 'investigation' | 'regulation';
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
                const presentation =
                    encounter.project.kind === 'research'
                        ? researchPresentation(encounter.project)
                        : { Icon: Search, label: '能力の調査', color: 'var(--warning)' };
                const Icon = presentation.Icon;
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
                        <span
                            className="map-research-icon"
                            role="img"
                            style={{
                                color: presentation.color,
                                opacity: 0.35 + Math.min(1, encounter.researchSpeed ?? 1) * 0.65,
                            }}
                            aria-label={presentation.label}
                        >
                            <Icon size={20} />
                        </span>
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
                        <ResearchProgress
                            project={encounter.project}
                            className="map-research-progress"
                            label={`${encounter.title}の全体進捗`}
                        />
                    </button>
                );
            })}
        </section>
    );
}
