import type { MapRegion } from './types';

export async function loadRegions(url: string): Promise<MapRegion[]> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`小地域データの読み込みに失敗しました (${response.status})`);
    return response.json() as Promise<MapRegion[]>;
}
