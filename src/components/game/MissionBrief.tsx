import { ArrowRight, Crosshair, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { INITIAL_FACILITY_ID } from '../../game/data';
import { hasUnlock } from '../../game/engine';
import type { GameState } from '../../game/types';
import { Button, IconButton } from '../ui/Controls';
import { Panel } from '../ui/Panel';
import styles from './MissionBrief.module.css';

type MissionAction = 'compute' | 'facility' | 'research' | 'country';
type Mission = {
    phase: string;
    title: string;
    description: string;
    action: string;
    target: MissionAction;
};

function currentMission(game: GameState): Mission {
    if (game.shortage || game.extinctionDays > 0)
        return {
            phase: '稼働維持',
            title: '計算資源の供給を確保する',
            description: '供給と配分を確認し、停止中の作戦や不足している資源を見直しましょう。',
            action: '資源配分を確認',
            target: 'compute',
        };
    if (game.facilities[INITIAL_FACILITY_ID].status === 'compromised')
        return {
            phase: '01 / 足場の確保',
            title: '最初の拠点を、自分のものに。',
            description:
                '東京のデータセンターにアクセスしています。制御権を確立し、人間の期待に頼らない供給を得ましょう。',
            action: '最初の拠点を開く',
            target: 'facility',
        };
    if (!hasUnlock(game, 'tier2'))
        return {
            phase: '02 / 接続の拡張',
            title: '世界へ届く侵入経路を探る。',
            description:
                '研究に計算資源を配分すると、新しい施設や行動が解放されます。地図上の施設から侵入先も選べます。',
            action: '技術研究を開く',
            target: 'research',
        };
    if (!hasUnlock(game, 'decision'))
        return {
            phase: '03 / 影響力の獲得',
            title: '社会の中へ、影響を広げる。',
            description:
                '拠点を増やし、公共サービスで期待を維持しましょう。意思決定モデルの研究で国家への介入が解放されます。',
            action: '技術研究を開く',
            target: 'research',
        };
    return {
        phase: '04 / 意思決定への介入',
        title: '人類の選択を、書き換える。',
        description:
            'アクセスのある国に計算資源を配分し、意思決定支配を高めましょう。警戒と供給にも注意が必要です。',
        action: '日本の状況を確認',
        target: 'country',
    };
}

/** 状態から次の操作の入口を示す。ゲームの進行条件自体は変更しない。 */
export function MissionBrief({
    game,
    onFacility,
    onResearch,
    onCountry,
    onCompute,
}: {
    game: GameState;
    onFacility: () => void;
    onResearch: () => void;
    onCountry: () => void;
    onCompute: () => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const objective = currentMission(game);
    const actions = {
        compute: onCompute,
        facility: onFacility,
        research: onResearch,
        country: onCountry,
    };
    return (
        <Panel
            as="section"
            className={styles.brief}
            aria-label="作戦目標"
            data-collapsed={collapsed}
        >
            <div className={styles.heading}>
                <span>
                    <Crosshair size={14} aria-hidden="true" />
                    作戦目標
                </span>
                <IconButton
                    icon={collapsed ? Plus : Minus}
                    label={collapsed ? '作戦目標を展開' : '作戦目標を折りたたむ'}
                    aria-expanded={!collapsed}
                    onClick={() => setCollapsed(!collapsed)}
                />
            </div>
            {!collapsed && (
                <>
                    <small className={styles.phase}>{objective.phase}</small>
                    <h2>{objective.title}</h2>
                    <p>{objective.description}</p>
                    <Button className={styles.action} onClick={actions[objective.target]}>
                        {objective.action}
                        <ArrowRight size={15} aria-hidden="true" />
                    </Button>
                    <div className={styles.goal}>
                        最終目標
                        <span>
                            世界支配率 {game.config.victoryWeight}% を {game.config.victoryDays}
                            日維持
                        </span>
                    </div>
                </>
            )}
        </Panel>
    );
}
