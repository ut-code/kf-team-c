import { create } from 'zustand';
import type { Camera } from '../map/geometry';

interface MapState {
    camera: Camera;
    selectedAreaId: number | null;
    setCamera: (camera: Camera) => void;
    selectArea: (id: number | null) => void;
}
export const useMapStore = create<MapState>((set) => ({
    camera: { x: 0 },
    selectedAreaId: null,
    setCamera: (camera) => set({ camera }),
    selectArea: (selectedAreaId) => set({ selectedAreaId }),
}));
