import { ChevronRight, MessageCircle } from 'lucide-react';
import { AREAS, FIELDS, REGIONS, STAGE_COLORS } from '../../game/data';
import type { metrics } from '../../game/metrics';
import { forecastArea } from '../../game/predictions';
import type { GameState, Population } from '../../game/types';
import { Meter, percent } from '../widgets';
import { PopulationDetails } from './PopulationDetails';

interface AreaPanelProps {
    game: GameState;
    local: ReturnType<typeof metrics>['areas'][number];
    areaIndex: number;
    selectedPoint: Population | null | undefined;
    region: string;
    setRegion: (region: string) => void;
    onSelectArea: (index: number) => void;
    onSocial: () => void;
}
export function AreaPanel({
    game,
    local,
    areaIndex,
    selectedPoint,
    region,
    setRegion,
    onSelectArea,
    onSocial,
}: AreaPanelProps) {
    const area = game.areas[areaIndex],
        definition = AREAS[areaIndex];
    const forecast = forecastArea(game, areaIndex);
    const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    return (
        <>
            <div className="section-intro">
                <h2>生活圏の状況</h2>
                <span>{AREAS.length} AREAS</span>
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
                <label htmlFor="area">生活圏</label>
                <select
                    id="area"
                    value={areaIndex}
                    onChange={(event) => onSelectArea(Number(event.target.value))}
                >
                    <option value={areaIndex} hidden>
                        {definition.name}
                    </option>
                    {AREAS.map((item, index) =>
                        region === 'すべて' || item.region === region ? (
                            <option key={item.id} value={index}>
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
                    人口 約{(local.population / 1e8).toFixed(2)}億人 · {local.count}集団
                </small>
            </div>
            <div className="area-metrics">
                <span>
                    信頼<b>{percent(local.trust)}</b>
                </span>
                <span>
                    警戒<b>{percent(local.vigilance)}</b>
                </span>
                <span>
                    自律的判断<b>{percent(local.autonomy)}</b>
                </span>
                <span>
                    同調<b>{percent(local.conformity)}</b>
                </span>
                <span>
                    構造的依存<b>{percent(local.stages[3])}</b>
                </span>
                <span>
                    社会安定<b>{percent(area.stability)}</b>
                </span>
                <span>
                    自律性回復制度<b>{percent(area.coexistence)}</b>
                </span>
                <span>
                    都市相当点の人口<b>{percent(local.urban)}</b>
                </span>
            </div>
            <div className="forecast-card">
                <b>12か月の依存人口比率変化</b>
                <strong>
                    {signed(forecast.low)}〜{signed(forecast.high)}ポイント
                </strong>
                <small>
                    {forecast.confidence}
                    。追加介入なしの概算です。新イベント・社会運動で範囲を外れる場合があります。
                </small>
            </div>
            <h3 className="subheading">
                分野ごとの制度統合<span>0〜4段階</span>
            </h3>
            <div className="institutions">
                {FIELDS.map((field, index) => (
                    <div key={field}>
                        <span>
                            {field}
                            <b>{area.institutions[index].toFixed(2)} / 4</b>
                        </span>
                        <Meter
                            value={area.institutions[index] / 4}
                            color={
                                area.institutions[index] >= 2.7 ? STAGE_COLORS[3] : 'var(--accent)'
                            }
                        />
                    </div>
                ))}
            </div>
            <p className="muted">
                紫化には自動意思決定・SYSTEM52以上・対象分野2.7以上・行政2.4以上が必要です。
            </p>
            <h3 className="subheading">世代構成</h3>
            <div className="generations">
                {['0–14歳', '15–64歳', '65歳以上', '年齢未収録'].map((name, index) => (
                    <span key={name}>
                        {name}
                        <b>{percent(local.generations[index])}</b>
                    </span>
                ))}
            </div>
            <p className="muted">
                AI教育の経験 {percent(local.schoolExposure)}
                。学校での習慣が成長後の労働・情報分野へ継承されます。
            </p>
            <h3 className="subheading">公表統計からの初期条件</h3>
            <div className="area-metrics">
                {(['digital', 'education', 'economic'] as const).map((key, index) => (
                    <span key={key}>
                        {['接続性', '教育指標', '経済指標'][index]}
                        <b>{local[`${key}Coverage`] > 0 ? percent(local[key]) : '未収録'}</b>
                        <small>統計の人口カバー率 {percent(local[`${key}Coverage`])}</small>
                    </span>
                ))}
            </div>
            <p className="muted">
                国別統計を代表人口で加重集計。教育は25歳以上の前期中等教育修了率、経済は1人当たりGNIの正規化。心理値は実測統計ではありません。
            </p>
            {selectedPoint && selectedPoint.area === areaIndex && (
                <PopulationDetails point={selectedPoint} />
            )}
            <button type="button" className="primary campaign-button" onClick={onSocial}>
                <MessageCircle size={16} />
                SNS・社会介入を開く<span>{Math.floor(game.influence)} IP</span>
            </button>
            <h3 className="subheading">人口移動・経済・情報の接続</h3>
            <div className="linked-areas">
                {area.networks.map((network) => (
                    <button
                        type="button"
                        key={network.area}
                        title={`移動 ${network.migration.toFixed(2)}／経済 ${network.economy.toFixed(2)}／情報 ${network.information.toFixed(2)}（モデル）`}
                        onClick={() => onSelectArea(network.area)}
                    >
                        {AREAS[network.area].name}
                        <ChevronRight size={13} />
                    </button>
                ))}
            </div>
            <p className="muted">
                接続強度は距離・デジタル基盤から構成したモデルです。実測の移民数・貿易額ではありません。
            </p>
        </>
    );
}
