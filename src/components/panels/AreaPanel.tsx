import { ChevronRight, MessageCircle } from 'lucide-react';
import { AREAS, FIELDS, REGIONS, STAGE_COLORS } from '../../game/data';
import type { metrics } from '../../game/engine';
import type { GameState, Population } from '../../game/types';
import { Meter, percent } from '../widgets';
import { PopulationDetails } from './PopulationDetails';

interface AreaPanelProps {
    game: Pick<GameState, 'areas' | 'influence' | 'month'>;
    local: ReturnType<typeof metrics>['areas'][number];
    areaIndex: number;
    selectedPoint: Population | null | undefined;
    region: string;
    setRegion: (region: string) => void;
    onSelectArea: (index: number) => void;
    onCampaign: (index: number) => void;
}

export function AreaPanel({
    game,
    local,
    areaIndex,
    selectedPoint,
    region,
    setRegion,
    onSelectArea,
    onCampaign,
}: AreaPanelProps) {
    const area = game.areas[areaIndex];
    const definition = AREAS[areaIndex];
    return (
        <>
            <div className="section-intro">
                <h2>小地域の状況</h2>
                <span>37 AREAS</span>
            </div>
            <div className="area-select">
                <label htmlFor="region">大地域</label>
                <select
                    id="region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                >
                    <option>すべて</option>
                    {REGIONS.map((name) => (
                        <option key={name}>{name}</option>
                    ))}
                </select>
                <label htmlFor="area">小地域</label>
                <select
                    id="area"
                    value={areaIndex}
                    onChange={(event) => {
                        onSelectArea(Number(event.target.value));
                    }}
                >
                    <option value={areaIndex} hidden>
                        {definition.name}
                    </option>
                    {AREAS.map((item, i) =>
                        region === 'すべて' || item.region === region ? (
                            <option key={item.id} value={i}>
                                {item.name}
                            </option>
                        ) : null,
                    )}
                </select>
            </div>
            <div className="area-title">
                <span>{definition.region}</span>
                <h2>{definition.name}</h2>
                <small>
                    人口 約{(definition.population / 100).toFixed(2)}億人 · {local.count}集団
                </small>
            </div>
            <div className="area-metrics">
                <span>
                    信頼<b>{percent(area.trust)}</b>
                </span>
                <span>
                    反発<b>{percent(area.resistance)}</b>
                </span>
                <span>
                    共存制度<b>{percent(area.coexistence)}</b>
                </span>
                <span>
                    構造的依存<b>{percent(local.stages[3])}</b>
                </span>
            </div>
            <h3 className="subheading">
                分野ごとの制度化<span>72%から構造的依存が進行</span>
            </h3>
            <div className="institutions">
                {FIELDS.map((field, i) => (
                    <div key={field}>
                        <span>
                            {field}
                            <b>{percent(area.institutions[i])}</b>
                        </span>
                        <Meter
                            value={area.institutions[i]}
                            color={area.institutions[i] >= 0.72 ? STAGE_COLORS[3] : 'var(--accent)'}
                        />
                    </div>
                ))}
            </div>
            <h3 className="subheading">世代構成</h3>
            <div className="generations">
                {['若年 / 0–14歳', '15–64歳', '高齢 / 65歳以上'].map((name, i) => (
                    <span key={name}>
                        {name}
                        <b>{percent(local.generations[i])}</b>
                    </span>
                ))}
            </div>
            <p className="muted">
                教育制度は次の世代の判断習慣に引き継がれます。世代交代後も人口規模は一定です。
            </p>
            {selectedPoint && selectedPoint.area === areaIndex && (
                <PopulationDetails point={selectedPoint} />
            )}
            <button
                type="button"
                className="primary campaign-button"
                disabled={game.influence < 20 || game.month < area.campaignReady}
                onClick={() => onCampaign(areaIndex)}
            >
                <MessageCircle size={16} />
                SNS対話キャンペーン<span>20 IP</span>
            </button>
            <p className="muted">
                影響力 {Math.floor(game.influence)} / 100 IP。
                {game.month < area.campaignReady
                    ? `再実行まで ${area.campaignReady - game.month}か月。`
                    : '18か月間、信頼と普及を促進。'}
                {game.month < area.campaignUntil && ' 現在実施中。'}
            </p>
            <h3 className="subheading">地理・情報の接続（モデル）</h3>
            <div className="linked-areas">
                {area.links.map((i) => (
                    <button
                        type="button"
                        key={i}
                        onClick={() => {
                            onSelectArea(i);
                        }}
                    >
                        {AREAS[i].name}
                        <ChevronRight size={13} />
                    </button>
                ))}
            </div>
        </>
    );
}
