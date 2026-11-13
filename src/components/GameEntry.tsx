import { useEffect, useState } from 'react';
import type { MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameApp } from './GameApp';
import { LicensePage } from './LicensePage';
import { StartScreen } from './StartScreen';

export function GameEntry({ regions }: { regions: MapRegion[] }) {
    const [atTitle, setAtTitle] = useState(!useGameStore.getState().game!.started);
    const [licensesOpen, setLicensesOpen] = useState(window.location.hash === '#licenses');
    useEffect(() => {
        const navigate = () => setLicensesOpen(window.location.hash === '#licenses');
        window.addEventListener('hashchange', navigate);
        return () => window.removeEventListener('hashchange', navigate);
    }, []);
    if (licensesOpen) return <LicensePage />;
    if (atTitle) return <StartScreen onStart={() => setAtTitle(false)} />;
    return (
        <GameApp
            regions={regions}
            onReturnToTitle={() => {
                const seed = useGameStore.getState().game!.seed;
                useGameStore.getState().initialize(seed + 1);
                useMapStore.setState({ camera: { x: 0 }, selectedAreaId: null });
                setAtTitle(true);
            }}
        />
    );
}
