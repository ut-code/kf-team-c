export interface Country {
    id: string;
    name: string;
    path: string;
}

export interface MapMarker {
    id: string;
    kind: 'facility' | 'person' | 'country';
    category?: import('../game/types').Category;
    longitude: number;
    latitude: number;
    label: string;
}
