import { Check, LockKeyhole } from 'lucide-react';
import { ABILITIES, SKILLS } from '../../game/data';
import type { GameState } from '../../game/types';
import { abilityText } from '../widgets';

export function ResearchPanel({
    game,
    onUnlock,
}: {
    game: Pick<GameState, 'research' | 'skills'>;
    onUnlock: (id: string) => void;
}) {
    return (
        <div className="research">
            <div className="section-intro">
                <h2>技術ツリー</h2>
                <span>{Math.floor(game.research)} RP</span>
            </div>
            <p className="muted">
                能力の成長と普及から研究点を獲得。各系統は上から順に解放します。
            </p>
            {ABILITIES.map((ability) => (
                <section className={`skill-branch ${ability.toLowerCase()}`} key={ability}>
                    <h3>
                        {ability}
                        <span>{abilityText[ability]}</span>
                    </h3>
                    {SKILLS.filter((skill) => skill.branch === ability).map((skill) => {
                        const owned = game.skills.includes(skill.id);
                        const locked = skill.requires.some((id) => !game.skills.includes(id));
                        return (
                            <button
                                type="button"
                                className={`skill ${owned ? 'owned' : ''}`}
                                key={skill.id}
                                disabled={owned || locked || game.research < skill.cost}
                                onClick={() => onUnlock(skill.id)}
                            >
                                <div>
                                    <b>{skill.name}</b>
                                    <span>
                                        {owned ? (
                                            <Check size={15} />
                                        ) : locked ? (
                                            <LockKeyhole size={13} />
                                        ) : (
                                            `${skill.cost} RP`
                                        )}
                                    </span>
                                </div>
                                <p>{skill.description}</p>
                            </button>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}
