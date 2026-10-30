import { create } from 'zustand';
import type { Camera } from '../map/geometry';
import type { MapMarker } from '../map/types';

interface MapState {
    camera: Camera;
    selectedAreaId: number | null;
    selectedMarkerId: string | null;
    selectMarker: (id: string | null) => void;
    markers: MapMarker[];
    setCamera: (camera: Camera) => void;
    selectArea: (id: number | null) => void;
    setMarkers: (markers: MapMarker[]) => void;
}

/** 地図表示の状態のみを管理する。将来のゲームルールはこのストアへ混在させない。 */
export const useMapStore = create<MapState>((set) => ({
    camera: { x: 0 },
    selectedAreaId: null,
    selectedMarkerId: null,
    selectMarker: (selectedMarkerId) => set({ selectedMarkerId }),
    markers: [],
    setCamera: (camera) => set({ camera }),
    selectArea: (selectedAreaId) => set({ selectedAreaId }),
    setMarkers: (markers) => set({ markers }),
}));
