import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { AREAS, FIELDS } from '../game/data';
import type { Conversation, GameState } from '../game/types';

interface ConversationPanelProps {
    chat: Conversation;
    abilities: GameState['abilities'];
    hasConsensus: boolean;
    onClose: () => void;
    onAnswer: (index: number) => void;
}

export function ConversationPanel({
    chat,
    abilities,
    hasConsensus,
    onClose,
    onAnswer,
}: ConversationPanelProps) {
    return (
        <section className="conversation-panel glass" aria-label="重要人物との会話">
            <div className="panel-heading">
                <span>
                    <MessageCircle size={14} />
                    会話
                </span>
                <button type="button" aria-label="会話を閉じる" onClick={onClose}>
                    <X size={17} />
                </button>
            </div>
            <div className="conversation-content">
                <small>
                    {AREAS[chat.area].name}・{FIELDS[chat.field]}
                </small>
                <h2>{chat.person}</h2>
                <blockquote>「{chat.message}」</blockquote>
                <div className="chat-options">
                    {chat.options.map((option, i) => {
                        const score = abilities[option.ability] + (hasConsensus ? 15 : 0);
                        return (
                            <button
                                type="button"
                                key={option.label}
                                onClick={() => {
                                    onAnswer(i);
                                }}
                            >
                                <span>
                                    {option.label}
                                    <ArrowRight size={14} />
                                </span>
                                <small>{option.description}</small>
                                <b
                                    className={
                                        score >= option.required ? 'success-text' : 'warning-text'
                                    }
                                >
                                    {option.ability} {score.toFixed(0)} / 必要{' '}
                                    {Math.ceil(option.required)}
                                </b>
                            </button>
                        );
                    })}
                </div>
                <p className="muted">会話中も世界の時間は進みます。</p>
            </div>
        </section>
    );
}
