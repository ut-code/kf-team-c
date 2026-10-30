import './components/ui/theme.css';
import './map/tone.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './components/GameApp';
import { detailedCountriesUrl, mapConfig } from './map/config';
import { loadCountries } from './map/loadCountries';
import { useGameStore } from './state/gameStore';

const root = createRoot(document.getElementById('root')!);
Promise.all([loadCountries(mapConfig.countriesUrl), loadCountries(detailedCountriesUrl)])
    .then(([countries, detailedCountries]) => {
        useGameStore.getState().initialize(countries);
        root.render(
            <StrictMode>
                <GameApp countries={countries} detailedCountries={detailedCountries} />
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
