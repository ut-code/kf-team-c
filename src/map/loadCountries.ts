import type { Country } from './types';

export async function loadCountries(url: string): Promise<Country[]> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`国境データの読み込みに失敗しました (${response.status})`);
    return response.json() as Promise<Country[]>;
}
