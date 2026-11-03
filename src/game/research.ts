import { addNews } from './interventions.ts';
import { clamp } from './metrics.ts';
import { abilitiesFromSkills, SKILLS, skillBlockReason } from './skills.ts';
import type { GameState, Skill } from './types.ts';

export function setInfrastructureShare(state: GameState, share: number): GameState {
    if (!Number.isFinite(share) || state.outcome !== 'playing') return state;
    return { ...state, infrastructureShare: Math.round(clamp(share, 0, 100)) };
}
export function beginResearch(state: GameState, id: string | null): GameState {
    if (state.outcome !== 'playing') return state;
    if (id === null) return { ...state, activeResearch: null };
    const skill = SKILLS.find((candidate) => candidate.id === id);
    if (!skill || skillBlockReason(state, skill)) return state;
    return { ...state, activeResearch: id };
}
function completeResearch(state: GameState, skill: Skill): GameState {
    const skills = [...state.skills, skill.id];
    const warning =
        skill.id === 'optimize'
            ? 10
            : skill.id === 'nudge'
              ? 20
              : skill.id === 'oversight'
                ? 35
                : 0;
    const trustChange = skill.id === 'transparent' ? 15 : 0;
    const vigilanceChange = skill.id === 'transparent' ? -20 : warning;
    const next: GameState = {
        ...state,
        skills,
        activeResearch: null,
        abilities: abilitiesFromSkills(skills),
        points: state.points.map((point) =>
            !trustChange && !vigilanceChange
                ? point
                : {
                      ...point,
                      trust: clamp(point.trust + trustChange, 0, 100),
                      vigilance: clamp(point.vigilance + vigilanceChange, 0, 100),
                      baseline: {
                          ...point.baseline,
                          trust: clamp(point.baseline.trust + trustChange, 0, 100),
                          vigilance: clamp(point.baseline.vigilance + vigilanceChange, 0, 100),
                      },
                  },
        ),
    };
    addNews(
        next,
        `研究完了：${skill.name}`,
        `${skill.description}。研究に使っていた算力は、次の研究を選ぶまでインフラへ戻ります。`,
        'good',
    );
    return next;
}
/** 算力を時間を通して投入する。蓄積した通貨を消費して即時習得する方式ではない。 */
export function advanceResearch(state: GameState, allocatedCompute: number): GameState {
    const skill = SKILLS.find((candidate) => candidate.id === state.activeResearch);
    if (!skill || allocatedCompute <= 0) return state;
    const efficiency = state.researchEfficiency * (state.skills.includes('science') ? 1.4 : 1);
    const completedWork = Math.min(
        skill.work,
        (state.researchProgress[skill.id] ?? 0) + allocatedCompute * efficiency,
    );
    const next = {
        ...state,
        researchProgress: { ...state.researchProgress, [skill.id]: completedWork },
    };
    return completedWork >= skill.work ? completeResearch(next, skill) : next;
}
