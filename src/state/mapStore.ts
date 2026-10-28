import { create } from 'zustand';
import type { Camera } from '../map/geometry';
import type { MapMarker } from '../map/types';

interface MapState {
    camera: Camera;
    selectedCountryId: string | null;
    selectedMarkerId: string | null;
    markerSelection: number;
    selectMarker: (id: string | null) => void;
    markers: MapMarker[];
    setCamera: (camera: Camera) => void;
    selectCountry: (id: string | null) => void;
    setMarkers: (markers: MapMarker[]) => void;
}

/** 地図表示の状態のみを管理する。将来のゲームルールはこのストアへ混在させない。 */
export const useMapStore = create<MapState>((set) => ({
    camera: { x: 0 },
    selectedCountryId: null,
    selectedMarkerId: null,
    markerSelection: 0,
    selectMarker: (selectedMarkerId) =>
        set((s) => ({ selectedMarkerId, markerSelection: s.markerSelection + 1 })),
    markers: [],
    setCamera: (camera) => set({ camera }),
    selectCountry: (selectedCountryId) => set({ selectedCountryId }),
    setMarkers: (markers) => set({ markers }),
}));
