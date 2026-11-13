import { create } from 'zustand';
import type { Camera } from '../map/geometry';
import type { MapView } from '../map/view';

export interface PresentedMap {
    view: MapView;
    left: number;
    top: number;
}

interface MapState {
    camera: Camera;
    selectedAreaId: number | null;
    presentedMap: PresentedMap | null;
    setCamera: (camera: Camera) => void;
    selectArea: (id: number | null) => void;
    presentMap: (frame: PresentedMap) => void;
}
export const useMapStore = create<MapState>((set) => ({
    camera: { x: 0 },
    selectedAreaId: null,
    presentedMap: null,
    setCamera: (camera) => set({ camera }),
    selectArea: (selectedAreaId) => set({ selectedAreaId }),
    presentMap: (presentedMap) => set({ presentedMap }),
}));
