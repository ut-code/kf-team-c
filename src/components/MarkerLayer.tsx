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

export function MarkerLayer({
    markers,
    scale,
    facilityStates,
    onClusterSelect,
}: {
    markers: MapMarker[];
    onClusterSelect: (markers: MapMarker[]) => void;
    scale: number;
    facilityStates?: Record<string, FacilityState>;
}) {
    const selected = useMapStore((state) => state.selectedMarkerId);
    const visible = markers.filter(
        (marker) => marker.latitude >= SOUTH_LATITUDE && marker.latitude <= NORTH_LATITUDE,
    );
    return (
        <g className={styles.markers} aria-label="地図マーカー">
            {layoutMarkers(visible, scale).map(({ marker, members, x, y, offsetX, offsetY }) => {
                const Icon =
                    marker.kind === 'person'
                        ? Mail
                        : marker.kind === 'country'
                          ? MapPin
                          : categoryIcons[marker.category!];
                return (
                    <g key={marker.id} transform={`translate(${x} ${y}) scale(${1 / scale})`}>
                        {(offsetX !== 0 || offsetY !== 0) && (
                            <path
                                className={styles.markerLeader}
                                d={`M0 0L${offsetX} ${offsetY}`}
                            />
                        )}
                        <g
                            transform={`translate(${offsetX} ${offsetY})`}
                            data-marker={marker.id}
                            data-cluster-members={members.map((member) => member.id).join(' ')}
                            data-kind={members.length > 1 ? 'cluster' : marker.kind}
                            data-cluster-count={members.length > 1 ? members.length : undefined}
                            data-status={facilityStates?.[marker.id]?.status}
                            data-selected={marker.id === selected}
                            role="button"
                            aria-label={
                                members.length > 1 ? `施設${members.length}件を表示` : marker.label
                            }
                            tabIndex={0}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (members.length > 1) onClusterSelect(members);
                                else useMapStore.getState().selectMarker(marker.id);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (members.length > 1) onClusterSelect(members);
                                    else useMapStore.getState().selectMarker(marker.id);
                                }
                            }}
                        >
                            <title>{members.map((member) => member.label).join('、')}</title>
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
                            {members.length > 1 ? (
                                <text
                                    className={styles.clusterCount}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                >
                                    {members.length}
                                </text>
                            ) : (
                                <Icon
                                    className={styles.markerGlyph}
                                    x={-9}
                                    y={-9}
                                    size={18}
                                    strokeWidth={1.4}
                                    aria-hidden="true"
                                />
                            )}
                            {marker.kind === 'person' ? (
                                <circle className={styles.unreadDot} cx="10" cy="-10" r="3.5" />
                            ) : (
                                <circle className={styles.statusDot} cx="10" cy="10" r="2.3" />
                            )}
                        </g>
                    </g>
                );
            })}
        </g>
    );
}
