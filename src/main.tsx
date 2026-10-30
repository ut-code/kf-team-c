import './components/game.css';
import './map/tone.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './components/GameApp';
import { mapScene } from './map/config';
import { loadRegions } from './map/loadRegions';
import { useGameStore } from './state/gameStore';

const root = createRoot(document.getElementById('root')!);
loadRegions(mapScene.regionsUrl)
    .then((regions) => {
        useGameStore.getState().initialize();
        root.render(
            <StrictMode>
                <GameApp regions={regions} />
            </StrictMode>,
        );
    })
    .catch((error: unknown) => {
        root.render(
            <p role="alert" className="startup-error">
                起動に失敗しました。{error instanceof Error ? error.message : String(error)}
            </p>,
        );
    });
