import { Check, LockKeyhole } from 'lucide-react';
import { SKILLS } from '../../game/data';
import { skillBlockReason } from '../../game/skills';
import type { GameState, Skill } from '../../game/types';

// 配置だけをここで管理し、習得条件はゲーム側のSkill定義を唯一の基準にする。
const positions: Record<string, { x: number; y: number }> = {
    reason: { x: 120, y: 110 },
    knowledge: { x: 330, y: 65 },
    forecast: { x: 330, y: 155 },
    science: { x: 550, y: 65 },
    optimize: { x: 770, y: 155 },
    empathy: { x: 120, y: 300 },
    personalize: { x: 330, y: 255 },
    memory: { x: 330, y: 345 },
    social: { x: 550, y: 255 },
    nudge: { x: 770, y: 255 },
    transparent: { x: 770, y: 345 },
    automation: { x: 120, y: 500 },
    public: { x: 330, y: 545 },
    school: { x: 550, y: 455 },
    decision: { x: 550, y: 545 },
    oversight: { x: 770, y: 545 },
    opaque: { x: 770, y: 455 },
};
const MAP_WIDTH = 980;
const MAP_HEIGHT = 620;
const NODE_HALF_WIDTH = 76;
function connectionPath(parent: string, child: string) {
    const from = positions[parent];
    const to = positions[child];
    const start = from.x + NODE_HALF_WIDTH;
    const end = to.x - NODE_HALF_WIDTH;
    const middle = (start + end) / 2;
    return `M${start},${from.y} C${middle},${from.y} ${middle},${to.y} ${end},${to.y}`;
}
export function SkillTreeMap({
    game,
    selected,
    onSelect,
}: {
    game: GameState;
    selected: Skill;
    onSelect: (skill: Skill) => void;
}) {
    return (
        <section className="skill-map-scroll" aria-label="スキルの前提関係">
            <div className="skill-map">
                <div className="skill-lane-label iq">
                    <b>IQ</b>
                    <span>判断精度・合理性</span>
                </div>
                <div className="skill-lane-label eq">
                    <b>EQ</b>
                    <span>対話・信頼</span>
                </div>
                <div className="skill-lane-label system">
                    <b>SYSTEM</b>
                    <span>制度統合</span>
                </div>
                <svg
                    className="skill-connections"
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {SKILLS.flatMap((skill) =>
                        skill.requires.map((parent) => {
                            const active = selected.id === skill.id || selected.id === parent;
                            const complete =
                                game.skills.includes(parent) && game.skills.includes(skill.id);
                            const crossBranch =
                                SKILLS.find((candidate) => candidate.id === parent)!.branch !==
                                skill.branch;
                            return (
                                <path
                                    key={`${parent}-${skill.id}`}
                                    d={connectionPath(parent, skill.id)}
                                    className={`${active ? 'active' : ''} ${complete ? 'complete' : ''} ${crossBranch ? 'cross-branch' : ''}`}
                                />
                            );
                        }),
                    )}
                    <path className="exclusive-connection" d="M850,345 C920,345 920,455 850,455" />
                    <text className="exclusive-label" x="898" y="404">
                        排他
                    </text>
                </svg>
                {SKILLS.map((skill) => {
                    const owned = game.skills.includes(skill.id);
                    const blocked = skillBlockReason(game, skill);
                    const excluded = skill.excludes && game.skills.includes(skill.excludes);
                    const position = positions[skill.id];
                    return (
                        <button
                            type="button"
                            key={skill.id}
                            className={`skill-node ${skill.branch.toLowerCase()} ${owned ? 'owned' : blocked ? 'locked' : 'available'} ${excluded ? 'excluded' : ''}`}
                            style={{
                                left: `${(position.x / MAP_WIDTH) * 100}%`,
                                top: `${(position.y / MAP_HEIGHT) * 100}%`,
                            }}
                            aria-pressed={selected.id === skill.id}
                            aria-label={`${skill.name}、${owned ? '習得済み' : excluded ? '排他により習得不可' : `${skill.work} CU・月`}`}
                            onClick={() => onSelect(skill)}
                        >
                            <span className="skill-node-title">
                                {owned ? (
                                    <Check size={13} />
                                ) : blocked ? (
                                    <LockKeyhole size={12} />
                                ) : (
                                    <i />
                                )}
                                {skill.name}
                            </span>
                            <small>
                                {owned
                                    ? `${skill.branch} +${skill.gain}`
                                    : excluded
                                      ? 'もう一方の路線を選択済み'
                                      : game.activeResearch === skill.id
                                        ? `研究中 ${Math.floor(((game.researchProgress[skill.id] ?? 0) / skill.work) * 100)}%`
                                        : `${skill.work} CU・月`}
                            </small>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
