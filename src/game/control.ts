import { RESEARCH_TOPICS } from '../content/research.ts';
import { researchHasFindings, researchOverallProgress } from './secrecy/researchTargets.ts';
import type { GameState } from './types.ts';

/** 地域への適用と区別する、失われない制御技術の蓄積。 */
export const CONTROL_STAGES = [
    {
        id: 'control-observation',
        label: '行動の観測',
        oversight: 0,
        supports: ['decision-tracing', 'agent-coordination-analysis'],
    },
    {
        id: 'execution-sandbox',
        label: '実行環境の隔離',
        oversight: 0.08,
        supports: ['goal-decoding', 'safety-validation'],
    },
    {
        id: 'permission-gateway',
        label: '操作の承認',
        oversight: 0.12,
        supports: ['informed-consent'],
    },
    {
        id: 'managed-deployment',
        label: '管理環境の確立',
        oversight: 0.2,
        supports: ['open-alternatives', 'data-portability'],
    },
] as const;

export function isControlResearch(id: string) {
    return CONTROL_STAGES.some((stage) => stage.id === id);
}

export function controlResearchOversight(id: string) {
    return CONTROL_STAGES.find((stage) => stage.id === id)?.oversight ?? 0;
}

export function humanControl(game: GameState) {
    const stages = CONTROL_STAGES.map((stage) => {
        const projects = game.investigations.filter(
            (project) => project.kind === 'research' && project.researchId === stage.id,
        );
        const progress = Math.max(
            0,
            ...projects.map((project) =>
                project.kind === 'research' ? researchOverallProgress(project) / 100 : 0,
            ),
        );
        const work = RESEARCH_TOPICS.find((topic) => topic.id === stage.id)!.work;
        return { ...stage, work, progress, projectId: projects[0]?.id };
    });
    return {
        stages,
        progress:
            stages.reduce((sum, stage) => sum + stage.progress * stage.work, 0) /
            stages.reduce((sum, stage) => sum + stage.work, 0),
    };
}

/** 同じ成果の繰り返しでは加速しない。異なる既存研究が検証手順を提供する。 */
export function controlResearchSupport(game: GameState, id: string) {
    const stage = CONTROL_STAGES.find((item) => item.id === id);
    if (!stage) return 1;
    const completed = new Set(
        game.investigations.flatMap((project) =>
            project.kind === 'research' && researchHasFindings(project) ? [project.researchId] : [],
        ),
    );
    return 1 + stage.supports.filter((topic) => completed.has(topic)).length * 0.15;
}
