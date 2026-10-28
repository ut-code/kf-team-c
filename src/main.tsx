import './components/ui/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './components/GameApp';
import { mapConfig } from './map/config';
import { loadCountries } from './map/loadCountries';
import { useGameStore } from './state/gameStore';

const root = createRoot(document.getElementById('root')!);
loadCountries(mapConfig.countriesUrl)
    .then((countries) => {
        useGameStore.getState().initialize(countries);
        root.render(
            <StrictMode>
                <GameApp countries={countries} backgroundUrl={mapConfig.backgroundUrl} />
            </StrictMode>,
        );
    })
    .catch((error: unknown) => {
        root.render(
            <p role="alert" style={{ color: '#f7b6a8', padding: 24 }}>
                地図の起動に失敗しました。{error instanceof Error ? error.message : String(error)}
            </p>,
        );
    });
