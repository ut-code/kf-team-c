export interface MapRegion {
    id: string;
    path: string;
}

export interface MapMarker {
    id: string;
    kind: 'population' | 'conversation';
    area: number;
    stage: number;
    longitude: number;
    latitude: number;
    label: string;
}
