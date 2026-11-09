import './components/game.css';
import './map/rendering/tone.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './components/GameApp';
import { mapScene } from './map/config';
import { loadRegions } from './map/loadRegions';
import { useGameStore } from './state/gameStore';

const root = createRoot(document.getElementById('root')!);
// 地域データやReactの初期化を待たず、地図画像の取得を並行して始める。
for (const [name, url] of Object.entries(mapScene)) {
    if (name === 'regionsUrl') continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.append(link);
}
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
