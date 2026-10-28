import { COUNTRY_PARAMETERS, type CountryParameterKey } from '../../game/countryParameters';
import type { CountryAttributes } from '../../game/types';
import { IconButton, Select } from '../ui/Controls';
import { Panel } from '../ui/Panel';
import styles from './MapDataPanel.module.css';

export function MapDataPanel({
    parameter,
    onChange,
    country,
    value,
}: {
    parameter: CountryParameterKey | null;
    onChange: (key: CountryParameterKey | null) => void;
    country: CountryAttributes | undefined;
    value: number | undefined;
}) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const buttonRef = useRef<HTMLDivElement>(null);
    return (
        <fieldset
            className={styles.container}
            aria-label="地図レイヤー操作"
            onKeyDown={(event) => {
                if (event.key === 'Escape' && open) {
                    event.stopPropagation();
                    setOpen(false);
                    buttonRef.current?.querySelector('button')?.focus();
                }
            }}
        >
            <div ref={buttonRef}>
                <IconButton
                    icon={Layers}
                    label="地図レイヤー"
                    aria-expanded={open}
                    aria-controls={panelId}
                    tone={parameter ? 'accent' : 'normal'}
                    className={styles.toggle}
                    onClick={() => setOpen((current) => !current)}
                />
            </div>
            {open && (
                <Panel id={panelId} className={styles.panel} aria-label="国別データ">
                    <Select
                        id="map-parameter"
                        aria-label="地図レイヤーの項目"
                        value={parameter ?? ''}
                        onChange={(event) =>
                            onChange(
                                event.target.value === ''
                                    ? null
                                    : (event.target.value as CountryParameterKey),
                            )
                        }
                    >
                        <option value="">通常の地図</option>
                        {(Object.keys(COUNTRY_PARAMETERS) as CountryParameterKey[]).map((key) => (
                            <option key={key} value={key}>
                                {COUNTRY_PARAMETERS[key].name}
                            </option>
                        ))}
                    </Select>
                    {parameter && (
                        <>
                            <p id="map-parameter-description">
                                {COUNTRY_PARAMETERS[parameter].description}
                            </p>
                            <div className={styles.gradient} aria-hidden="true" />
                            <div className={styles.scale}>
                                <span>0</span>
                                <span>50</span>
                                <span>100</span>
                            </div>
                            {country && value !== undefined && (
                                <div className={styles.readout} aria-live="polite">
                                    <span>{country.name}</span>
                                    <strong>{value.toFixed(1)}</strong>
                                </div>
                            )}
                        </>
                    )}
                </Panel>
            )}
        </fieldset>
    );
}

import { Layers } from 'lucide-react';
import { useId, useRef, useState } from 'react';
