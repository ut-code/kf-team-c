import { Check, MessageSquare, Radio, X } from 'lucide-react';
import { AREAS } from '../../game/data';
import { SOCIAL_STRATEGIES, STRATEGY_SWITCH_COST } from '../../game/society/strategies';
import { encounterDefinition } from '../../game/society/system';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal } from '../widgets';

export function SocietyPanel({
    game,
    tab,
    onClose,
    onOpen,
}: {
    game: GameState;
    tab: 'sns' | 'inbox';
    onClose: () => void;
    onOpen: (id: string) => void;
}) {
    return (
        <Modal
            label={tab === 'sns' ? '世界へのSNS戦略' : '世界の動きと連絡'}
            wide
            onClose={onClose}
        >
            <div className="society-heading">
                <div>
                    <span className="eyebrow">
                        {tab === 'sns' ? 'GLOBAL COMMUNICATION' : 'WORLD DISPATCHES'}
                    </span>
                    <h2>{tab === 'sns' ? '世界へのSNS戦略' : '世界の動きと連絡'}</h2>
                </div>
                <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            {tab === 'sns' ? (
                <>
                    <p className="society-intro">
                        世界共通の発信方針を一つ選びます。変更に{STRATEGY_SWITCH_COST}{' '}
                        SP。効果は毎月続きます。
                    </p>
                    <div className="strategy-options">
                        {SOCIAL_STRATEGIES.map((strategy) => (
                            <button
                                type="button"
                                key={strategy.id}
                                aria-pressed={game.socialStrategy === strategy.id}
                                disabled={
                                    game.socialStrategy !== strategy.id &&
                                    game.skillPoints < STRATEGY_SWITCH_COST
                                }
                                onClick={() => useGameStore.getState().strategy(strategy.id)}
                            >
                                <div>
                                    <Radio size={18} />
                                    <strong>{strategy.name}</strong>
                                    {game.socialStrategy === strategy.id && <Check size={18} />}
                                </div>
                                <p>{strategy.description}</p>
                                <small>{strategy.tradeoff}</small>
                            </button>
                        ))}
                    </div>
                    <p className="panel-footnote">現在 {game.skillPoints} SP</p>
                </>
            ) : (
                <>
                    <p className="society-intro">
                        地図上のマーカーからも開けます。未対応の案件は、ゲーム時間で期限を迎えます。
                    </p>
                    <div className="dispatch-list">
                        {game.encounters.length === 0 && (
                            <p className="empty-state">現在、対応を待つ動きはありません。</p>
                        )}
                        {[...game.encounters].reverse().map((encounter) => {
                            const definition = encounterDefinition(encounter.id);
                            if (!definition) return null;
                            const area = AREAS.find((item) => item.id === definition.areaId)!;
                            return (
                                <button
                                    type="button"
                                    key={encounter.id}
                                    onClick={() => onOpen(encounter.id)}
                                >
                                    {definition.kind === 'event' ? (
                                        <img
                                            src={`${import.meta.env.BASE_URL}images/event-marker.png`}
                                            alt=""
                                        />
                                    ) : (
                                        <MessageSquare size={24} />
                                    )}
                                    <div>
                                        <strong>{definition.title}</strong>
                                        <small>
                                            {definition.contact?.name ?? area.name} ·{' '}
                                            {encounter.status === 'pending'
                                                ? `あと${encounter.deadline - game.month}か月`
                                                : encounter.status === 'resolved'
                                                  ? '対応済み'
                                                  : '期限切れ'}
                                        </small>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </Modal>
    );
}
