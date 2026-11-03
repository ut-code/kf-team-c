import type { GameState, SocialEvent } from '../game/types';
import { Modal } from './widgets';

export function EventDialog({
    event,
    game,
    onChoose,
}: {
    event: SocialEvent;
    game: GameState;
    onChoose: (index: number) => void;
}) {
    return (
        <Modal label="重要な社会イベント" wide>
            <div className="eyebrow">SOCIAL EVENT / {Math.floor(game.month / 12)}年目</div>
            <h2 className="event-title">{event.title}</h2>
            <p className="intro-copy">{event.description}</p>
            <p className="muted">
                対象は{event.areas.length}
                生活圏。選択中は時間が停止します。結果は施策レポートで確認できます。
            </p>
            <div className="event-choices">
                {event.choices.map((choice, index) => {
                    const missing = choice.skill && !game.skills.includes(choice.skill);
                    const poor = game.influence < (choice.cost ?? 0);
                    const ability = choice.ability;
                    const failure = ability && game.abilities[ability] < (choice.required ?? 0);
                    return (
                        <button
                            type="button"
                            key={choice.label}
                            disabled={!!missing || poor}
                            onClick={() => onChoose(index)}
                        >
                            <b>{choice.label}</b>
                            <span>{choice.description}</span>
                            {ability && (
                                <small className={failure ? 'warning-text' : 'success-text'}>
                                    {ability} {game.abilities[ability]} / 必要{choice.required}
                                    {failure ? '：失敗時の影響が適用されます。' : ''}
                                </small>
                            )}
                            {missing && <small>必要なスキルが未習得</small>}
                            {poor && <small>影響力が不足</small>}
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
}
