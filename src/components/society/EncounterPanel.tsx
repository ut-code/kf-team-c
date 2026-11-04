import { ArrowUpRight, Check, Clock, X } from 'lucide-react';
import { AREAS } from '../../game/data';
import { encounterChoices, encounterDefinition } from '../../game/society/system';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal } from '../widgets';
import { ConversationPanel } from './ConversationPanel';
import { EffectSummary } from './EffectSummary';

export function EncounterPanel({
    game,
    id,
    onClose,
}: {
    game: GameState;
    id: string;
    onClose: () => void;
}) {
    const encounter = game.encounters.find((item) => item.id === id);
    const definition = encounterDefinition(id);
    if (!encounter || !definition) return null;
    if (definition.kind === 'chat') {
        return (
            <ConversationPanel
                game={game}
                definition={definition}
                encounter={encounter}
                onClose={onClose}
            />
        );
    }
    const area = AREAS.find((item) => item.id === definition.areaId)!;
    const choices = encounterChoices(definition, encounter);
    return (
        <Modal modal={false} label={definition.title} wide onClose={onClose}>
            <div className="encounter-panel">
                <div className="society-heading">
                    <div className="contact-heading">
                        <img
                            className="event-emblem"
                            src={`${import.meta.env.BASE_URL}images/event-marker.svg`}
                            alt=""
                        />
                        <div>
                            <span className="eyebrow">{area.name}</span>
                            <h2>{definition.title}</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="閉じる"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="encounter-meta">
                    <Clock size={13} />
                    {encounter.status === 'pending'
                        ? `回答期限まで ${encounter.deadline - game.month}か月`
                        : encounter.status === 'resolved'
                          ? '対応済み'
                          : '期限切れ'}
                    <span>{game.skillPoints} SP</span>
                </div>
                <p className="event-summary">{definition.summary}</p>
                {encounter.result && (
                    <div className="encounter-result">
                        <Check size={17} />
                        <p>{encounter.result}</p>
                    </div>
                )}
                {encounter.status === 'pending' && (
                    <>
                        <details className="inaction-effects" open>
                            <summary>対応しなかった場合</summary>
                            <p>{definition.ignored.description}</p>
                            <EffectSummary effects={definition.ignored.effects} />
                        </details>
                        <fieldset className="encounter-choices" aria-label="対応を選ぶ">
                            <small>対応を選ぶ · 数値は最大変化量</small>
                            {choices.map((choice) => (
                                <button
                                    type="button"
                                    key={choice.id}
                                    disabled={game.skillPoints < (choice.cost ?? 0)}
                                    onClick={() => useGameStore.getState().choose(id, choice.id)}
                                >
                                    <div>
                                        <strong>{choice.label}</strong>
                                        <span>
                                            {choice.cost ? `${choice.cost} SP` : '費用なし'}
                                            <ArrowUpRight size={15} />
                                        </span>
                                    </div>
                                    <EffectSummary effects={choice.effects} />
                                    {game.skillPoints < (choice.cost ?? 0) && (
                                        <small>SPが不足しています</small>
                                    )}
                                </button>
                            ))}
                        </fieldset>
                    </>
                )}
            </div>
        </Modal>
    );
}
