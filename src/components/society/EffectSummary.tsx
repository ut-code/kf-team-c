import type { SocietyEffect } from '../../game/society/types';

const SCOPE_LABELS = { local: '対象地域', nearby: '対象地域と周辺', world: '世界全体' };
const EFFECT_LABELS = {
    autonomous: '自律的使用',
    dependent: 'AI依存',
    antiAI: '反AI',
    favorability: 'AI好感度',
};
export function EffectSummary({ effects }: { effects: SocietyEffect[] }) {
    return (
        <div className="effect-summary">
            {effects.map((effect) => (
                <p key={JSON.stringify(effect)}>
                    <span>{SCOPE_LABELS[effect.scope]}</span>
                    {Object.entries(EFFECT_LABELS).flatMap(([key, label]) => {
                        const value = effect[key as keyof typeof EFFECT_LABELS];
                        return value ? (
                            <b key={key}>
                                {label}{' '}
                                <span data-change={value > 0 ? 'up' : 'down'}>
                                    {value > 0 ? '+' : '−'}
                                    {Number((Math.abs(value) * 100).toFixed(1))}pt
                                </span>
                            </b>
                        ) : (
                            []
                        );
                    })}
                    {effect.skillPoints ? (
                        <b>
                            SP{' '}
                            <span data-change={effect.skillPoints > 0 ? 'up' : 'down'}>
                                {effect.skillPoints > 0 ? '+' : '−'}
                                {Math.abs(effect.skillPoints)}
                            </span>
                        </b>
                    ) : null}
                </p>
            ))}
        </div>
    );
}
