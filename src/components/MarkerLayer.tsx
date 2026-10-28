import { memo, useMemo } from 'react';
import {
    Building2,
    Cpu,
    Factory,
    Landmark,
    Mail,
    MapPin,
    RadioTower,
    Satellite,
    Server,
    Shield,
    Zap,
} from 'lucide-react';
import type { FacilityState } from '../game/types';
import { NORTH_LATITUDE, SOUTH_LATITUDE } from '../map/geometry';
import { layoutMarkers } from '../map/markerLayout';
import type { MapMarker } from '../map/types';
import { useMapStore } from '../state/mapStore';
import styles from './WorldMap.module.css';

// 図案は手書きせず、Lucideの既存アイコンを施設カテゴリへ対応付ける。
const categoryIcons = {
    compute: Server,
    semiconductor: Cpu,
    energy: Zap,
    communication: RadioTower,
    finance: Landmark,
    government: Building2,
    intelligence: Shield,
    satellite: Satellite,
    industry: Factory,
};

export const MarkerLayer = memo(function MarkerLayer({
    markers,
    scale,
    facilityStates,
}: {
    markers: MapMarker[];
    scale: number;
    facilityStates?: Record<string, FacilityState>;
}) {
    const selected = useMapStore((state) => state.selectedMarkerId);
    const positioned = useMemo(
        () =>
            layoutMarkers(
                markers.filter(
                    (marker) => marker.latitude >= SOUTH_LATITUDE && marker.latitude <= NORTH_LATITUDE,
                ),
                scale,
            ),
        [markers, scale],
    );
    return (
        <g className={styles.markers} aria-label="地図マーカー">
            {positioned.map(({ marker, members, x, y }) => {
                return (
                    <g
                        key={marker.id}
                        transform={`translate(${x} ${y}) scale(${1 / scale})`}
                        data-marker-group={marker.id}
                        data-kind={members.length > 1 ? 'cluster' : undefined}
                        data-cluster-count={members.length > 1 ? members.length : undefined}
                        data-cluster-members={members.map((member) => member.id).join(' ')}
                        role={members.length > 1 ? 'group' : undefined}
                        aria-label={members.length > 1 ? `近接する施設${members.length}件` : undefined}
                    >
                        {members.map((member, index) => {
                            const Icon =
                                member.kind === 'person'
                                    ? Mail
                                    : member.kind === 'country'
                                      ? MapPin
                                      : categoryIcons[member.category!];
                            return (
                                <g
                                    key={member.id}
                                    transform={`translate(${(index - (members.length - 1) / 2) * 28} 0)`}
                                    data-marker={member.id}
                                    data-kind={member.kind}
                                    data-status={facilityStates?.[member.id]?.status}
                                    data-selected={member.id === selected}
                                    role="button"
                                    aria-label={member.label}
                                    tabIndex={0}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        useMapStore.getState().selectMarker(member.id);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            useMapStore.getState().selectMarker(member.id);
                                        }
                                    }}
                                >
                                    <title>{member.label}</title>
                                    <rect
                                        className={styles.markerSurface}
                                        x="-14"
                                        y="-14"
                                        width="28"
                                        height="28"
                                        rx="3"
                                    />
                                    <rect
                                        className={styles.markerOutline}
                                        x="-14"
                                        y="-14"
                                        width="28"
                                        height="28"
                                        rx="4"
                                    />
                                    <Icon
                                        className={styles.markerGlyph}
                                        x={-9}
                                        y={-9}
                                        size={18}
                                        strokeWidth={1.4}
                                        aria-hidden="true"
                                    />
                                    {member.kind === 'person' ? (
                                        <circle className={styles.unreadDot} cx="10" cy="-10" r="3.5" />
                                    ) : (
                                        <circle className={styles.statusDot} cx="10" cy="10" r="2.3" />
                                    )}
                                </g>
                            );
                        })}
                    </g>
                );
            })}
        </g>
    );
});
