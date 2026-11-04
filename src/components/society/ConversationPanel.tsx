import { ArrowUp, Check, Clock, MessageCircle, Sparkles, X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { encounterChoices } from '../../game/society/system';
import type { EncounterDefinition, EncounterState } from '../../game/society/types';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal } from '../widgets';
import { EffectSummary } from './EffectSummary';
import { useConversationPlayback } from './useConversationPlayback';

export function ConversationPanel({
    game,
    definition,
    encounter,
    onClose,
}: {
    game: GameState;
    definition: EncounterDefinition;
    encounter: EncounterState;
    onClose: () => void;
}) {
    const log = useRef<HTMLDivElement>(null);
    const followLatest = useRef(true);
    const playback = useConversationPlayback(encounter.messages);
    useLayoutEffect(() => {
        // 履歴を読み返している間はスクロール位置を奪わない。
        if (followLatest.current && log.current) log.current.scrollTop = log.current.scrollHeight;
    });
    const contact = definition.contact!;
    const choices = encounterChoices(definition, encounter);
    const pending = encounter.status === 'pending';
    return (
        <Modal label={definition.title} wide className="conversation-modal" onClose={onClose}>
            <header className="conversation-heading">
                <MessageCircle size={20} aria-hidden="true" />
                <div>
                    <h2>{contact.name}</h2>
                    <p>{contact.role}</p>
                </div>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="チャットを閉じる"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
            </header>
            <div className="conversation-status">
                <span>
                    <Clock size={12} aria-hidden="true" />
                    {pending
                        ? `回答期限まで ${encounter.deadline - game.month}か月`
                        : encounter.status === 'resolved'
                          ? '対応済み'
                          : '期限切れ'}
                </span>
                <span>{game.skillPoints} SP</span>
            </div>
            <div
                className="conversation-log"
                ref={log}
                role="log"
                aria-label="対話履歴"
                aria-live="polite"
                aria-busy={playback.busy}
                onScroll={(event) => {
                    const element = event.currentTarget;
                    followLatest.current =
                        element.scrollHeight - element.scrollTop - element.clientHeight < 48;
                }}
            >
                <p className="conversation-topic">{definition.title}</p>
                {playback.messages.map((message) => (
                    <article
                        className={`conversation-message ${message.role}`}
                        key={message.id}
                        aria-label={
                            message.role === 'contact'
                                ? contact.name
                                : message.role === 'player'
                                  ? 'あなた'
                                  : '結果'
                        }
                    >
                        {message.role === 'contact' && (
                            <span className="conversation-avatar" aria-hidden="true">
                                {contact.initials}
                            </span>
                        )}
                        {message.role === 'player' && (
                            <Sparkles
                                className="conversation-ai-icon"
                                size={20}
                                aria-hidden="true"
                            />
                        )}
                        <div className="conversation-message-content">
                            {message.role !== 'system' && (
                                <small>
                                    {message.role === 'contact' ? contact.name : 'あなた'}
                                </small>
                            )}
                            <p>{message.text}</p>
                        </div>
                    </article>
                ))}
                {playback.streamingMessage && (
                    <article
                        className="conversation-message player"
                        aria-label="あなた、返信を生成中"
                    >
                        <Sparkles className="conversation-ai-icon" size={20} aria-hidden="true" />
                        <div className="conversation-message-content">
                            <small>あなた</small>
                            <p>
                                {playback.streamingText}
                                <span className="conversation-cursor" aria-hidden="true" />
                            </p>
                        </div>
                    </article>
                )}
                {playback.waitingForContact && (
                    <article
                        className="conversation-message contact"
                        aria-label={`${contact.name}が入力中`}
                    >
                        <span className="conversation-avatar" aria-hidden="true">
                            {contact.initials}
                        </span>
                        <div className="conversation-message-content">
                            <small>{contact.name}</small>
                            <p className="conversation-typing" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </p>
                        </div>
                    </article>
                )}
            </div>
            <footer className="conversation-footer">
                {playback.busy ? (
                    <p className="conversation-progress" role="status">
                        {playback.streamingMessage
                            ? '返信を生成中…'
                            : `${contact.name}の返信を待っています…`}
                    </p>
                ) : pending ? (
                    <>
                        <fieldset className="conversation-replies">
                            <legend>返信を選択</legend>
                            {choices.map((choice) => (
                                <button
                                    type="button"
                                    className="conversation-reply"
                                    key={choice.id}
                                    disabled={game.skillPoints < (choice.cost ?? 0)}
                                    onClick={() =>
                                        useGameStore.getState().choose(encounter.id, choice.id)
                                    }
                                >
                                    <span>{choice.label}</span>
                                    <small>
                                        {game.skillPoints < (choice.cost ?? 0)
                                            ? 'SP不足'
                                            : choice.cost
                                              ? `${choice.cost} SP`
                                              : '費用なし'}
                                    </small>
                                    <ArrowUp size={16} aria-hidden="true" />
                                </button>
                            ))}
                        </fieldset>
                        <details className="conversation-effects" key={encounter.nodeId}>
                            <summary>返信の影響・対応しなかった場合</summary>
                            <small>数値は最大変化量</small>
                            {choices.map((choice) => (
                                <div key={choice.id}>
                                    <p>{choice.label}</p>
                                    <EffectSummary effects={choice.effects} />
                                </div>
                            ))}
                            <p>対応しなかった場合：{definition.ignored.description}</p>
                            <EffectSummary effects={definition.ignored.effects} />
                        </details>
                    </>
                ) : (
                    <p className="conversation-complete">
                        <Check size={14} aria-hidden="true" />
                        {encounter.status === 'resolved'
                            ? '会話は終了しました'
                            : '回答期限を過ぎました'}
                    </p>
                )}
            </footer>
        </Modal>
    );
}
