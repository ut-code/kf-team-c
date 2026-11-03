import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { chatOptions } from '../game/conversations';
import { AREAS, FIELDS } from '../game/data';
import type { Conversation, GameState } from '../game/types';

interface ConversationPanelProps {
    chat: Conversation;
    game: GameState;
    onClose: () => void;
    onAnswer: (index: number) => void;
}
export function ConversationPanel({ chat, game, onClose, onAnswer }: ConversationPanelProps) {
    return (
        <section className="conversation-panel glass" aria-label="重要人物との会話">
            <div className="panel-heading">
                <span>
                    <MessageCircle size={14} />
                    会話 {chat.turn + 1}/{chat.turns}
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
                {chat.transcript.length > 0 && (
                    <details className="conversation-history">
                        <summary>これまでのやり取り</summary>
                        {chat.transcript.map((line) => (
                            <p key={line.id}>
                                <b>{line.speaker}：</b>
                                {line.text}
                            </p>
                        ))}
                    </details>
                )}
                <blockquote>「{chat.message}」</blockquote>
                <div className="chat-options">
                    {chatOptions(game, chat).map((option, index) => {
                        const score = game.abilities[option.ability];
                        return (
                            <button
                                type="button"
                                key={option.label}
                                onClick={() => onAnswer(index)}
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
                                    {option.ability} {score} / 必要{Math.ceil(option.required)}
                                    {score < option.required ? '：失敗リスクあり' : ''}
                                </b>
                            </button>
                        );
                    })}
                </div>
                <p className="muted">
                    会話中も時間は進みます。閉じても協議の続きから再開できます。
                </p>
            </div>
        </section>
    );
}
