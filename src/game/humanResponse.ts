import { RESEARCH_TOPICS } from '../content/research.ts';
import { isControlResearch } from './control.ts';
import { AREAS, WORLD_POPULATION } from './data.ts';
import { dependencyDynamics } from './dependency.ts';
import { activeSkillEffects } from './secrecy/capabilities.ts';
import { publishedResearchEffects } from './secrecy/research.ts';
import { researchHasFindings } from './secrecy/researchTargets.ts';
import type { GameState } from './types.ts';

/** 回復訓練と代替手段が両方届いた範囲。人口の状態は増やさない。 */
function recoveryCoverage(game: GameState) {
    const recovery = AREAS.map(() => 0);
    const alternatives = AREAS.map(() => 0);
    for (const project of game.investigations) {
        if (project.kind !== 'research' || !researchHasFindings(project)) continue;
        const topic = RESEARCH_TOPICS.find((item) => item.id === project.researchId)!;
        for (let i = 0; i < AREAS.length; i++) {
            if (topic.effects.recovery) recovery[i] = Math.max(recovery[i], project.coverage[i]);
            if (topic.effects.alternatives)
                alternatives[i] = Math.max(alternatives[i], project.coverage[i]);
        }
    }
    return recovery.map((value, i) => Math.min(value, alternatives[i]));
}

/** 現在の構成で生じる委任と回復の月次量。未来の人口を予測する値ではない。 */
export function humanResponse(game: GameState, index?: number) {
    const recovery = recoveryCoverage(game);
    const protectionByArea = AREAS.map(() => 0);
    let converted = 0,
        restored = 0,
        potential = 0,
        effective = 0,
        autonomous = 0,
        protectedUse = 0;
    const total = index === undefined ? WORLD_POPULATION : AREAS[index].population;
    for (let i = 0; i < AREAS.length; i++) {
        if (index !== undefined && i !== index) continue;
        const weight = AREAS[i].population / total;
        const dynamics = dependencyDynamics(
            game,
            i,
            activeSkillEffects(game, i),
            publishedResearchEffects(game, i),
        );
        converted += dynamics.converted * weight;
        restored += dynamics.restored * weight;
        potential += dynamics.potential * weight;
        effective += dynamics.effective * weight;
        const suppression =
            dynamics.potential > 0
                ? 1 - dynamics.effective / dynamics.potential
                : publishedResearchEffects(game, i).oversight;
        protectionByArea[i] = Math.max(recovery[i], suppression);
        autonomous += game.areas[i].autonomous * weight;
        protectedUse += game.areas[i].autonomous * protectionByArea[i] * weight;
    }
    return {
        converted,
        restored,
        suppression: potential > 0 ? 1 - effective / potential : 0,
        protection: autonomous > 0 ? protectedUse / autonomous : 0,
        protectedUse,
        protectionByArea,
    };
}

/** 対策に関する研究が始まった段階でHUDを解放する。経過時間では判定しない。 */
export function hasCountermeasureResearch(game: GameState) {
    return game.investigations.some((project) => {
        if (project.kind !== 'research') return false;
        const topic = RESEARCH_TOPICS.find((item) => item.id === project.researchId)!;
        return (
            isControlResearch(topic.id) ||
            Object.keys(topic.countermeasures).length > 0 ||
            Boolean(topic.effects.recovery || topic.effects.alternatives)
        );
    });
}
