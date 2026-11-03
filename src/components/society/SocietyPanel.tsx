import { Check, Radio, X } from 'lucide-react';
import { SOCIAL_STRATEGIES, STRATEGY_SWITCH_COST } from '../../game/society/strategies';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal } from '../widgets';

export function SocietyPanel({ game, onClose }: { game: GameState; onClose: () => void }) {
    return (
        <Modal label="世界へのSNS戦略" wide onClose={onClose}>
            <div className="society-heading">
                <div>
                    <span className="eyebrow">GLOBAL COMMUNICATION</span>
                    <h2>世界へのSNS戦略</h2>
                </div>
                <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
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
        </Modal>
    );
}
