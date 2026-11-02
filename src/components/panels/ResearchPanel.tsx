import { Brain, HeartHandshake, Network } from 'lucide-react';
import { useState } from 'react';
import { ABILITIES, SKILLS } from '../../game/data';
import { metrics } from '../../game/metrics';
import { skillBlockReason } from '../../game/skills';
import type { GameState } from '../../game/types';
import { ComputeAllocation } from '../ComputeAllocation';
import { abilityText, Meter } from '../widgets';
import { SkillDetails } from './SkillDetails';
import { SkillTreeMap } from './SkillTreeMap';

const abilityIcons = { IQ: Brain, EQ: HeartHandshake, SYSTEM: Network };
export function ResearchPanel({
    game,
    onResearch,
    onAllocate,
}: {
    game: GameState;
    onResearch: (id: string | null) => void;
    onAllocate: (share: number) => void;
}) {
    const [selectedId, setSelectedId] = useState(
        () => SKILLS.find((skill) => !skillBlockReason(game, skill))?.id ?? SKILLS[0].id,
    );
    const summary = metrics(game);
    const selected = SKILLS.find((skill) => skill.id === selectedId)!;
    return (
        <div className="research-workbench">
            <header className="research-header">
                <div>
                    <span className="eyebrow">RESEARCH / STRATEGY</span>
                    <h2>三つの能力で、社会への道をひらく。</h2>
                    <p>つながりを選び、影響を見極める。全習得は困難です。</p>
                </div>
                <div className="research-budget">
                    <span>研究へ配分中</span>
                    <strong>
                        {summary.researchCompute.toFixed(1)}
                        <small>CU</small>
                    </strong>
                    <small>
                        {game.skills.length} / {SKILLS.length} 習得
                    </small>
                </div>
            </header>
            <div className="research-abilities">
                {ABILITIES.map((ability) => {
                    const Icon = abilityIcons[ability];
                    return (
                        <div className={`research-ability ${ability.toLowerCase()}`} key={ability}>
                            <Icon size={19} />
                            <div>
                                <span>
                                    {ability}
                                    <small>{abilityText[ability]}</small>
                                </span>
                                <Meter value={game.abilities[ability] / 100} />
                            </div>
                            <strong>{game.abilities[ability]}</strong>
                        </div>
                    );
                })}
            </div>
            <ComputeAllocation game={game} onAllocate={onAllocate} />
            <div className="research-layout">
                <div className="research-map-column">
                    <div className="skill-map-legend">
                        <span>
                            <i className="owned" />
                            習得済み
                        </span>
                        <span>
                            <i className="available" />
                            習得可能
                        </span>
                        <span>
                            <i className="locked" />
                            未解放
                        </span>
                        <small>スキルを選択して詳細を確認</small>
                    </div>
                    <SkillTreeMap
                        game={game}
                        selected={selected}
                        onSelect={(skill) => setSelectedId(skill.id)}
                    />
                    <p className="research-map-note">
                        実線：前提スキル　点線：系統をまたぐ前提　赤線：排他的な路線
                    </p>
                </div>
                <SkillDetails
                    key={selected.id}
                    game={game}
                    skill={selected}
                    onResearch={onResearch}
                    onSelect={(skill) => setSelectedId(skill.id)}
                />
            </div>
        </div>
    );
}
