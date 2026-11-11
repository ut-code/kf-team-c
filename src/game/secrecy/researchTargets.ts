import type { ResearchTopic } from '../../content/research.ts';
import { RESEARCH_TOPICS } from '../../content/research.ts';
import { SKILLS } from '../skills.ts';
import type { GameState, SkillDomain } from '../types.ts';
import type { ScientificInvestigation } from './types.ts';

/** 同じ仕組みへの対策は取り直しても残る。異なる仕組みまで解決済みにはしない。 */
export const RESEARCH_TARGETS: {
    id: string;
    name: string;
    skills: string[];
    domain: SkillDomain | 'general';
}[] = [
    { id: 'general', name: 'AIへの判断の委任', skills: [], domain: 'general' },
    {
        id: 'workflow',
        name: '業務の自動実行',
        skills: ['integration', 'decision'],
        domain: 'work',
    },
    { id: 'civic', name: '行政・生活サービスへの依存', skills: ['public'], domain: 'work' },
    { id: 'coordination', name: 'エージェント間の判断連携', skills: ['swarm'], domain: 'work' },
    {
        id: 'records',
        name: '個人記録による囲い込み',
        skills: ['memory', 'digital-twin'],
        domain: 'personal',
    },
    {
        id: 'judgment',
        name: '生活判断への介入',
        skills: ['companion', 'routine', 'care'],
        domain: 'personal',
    },
    {
        id: 'coercion',
        name: '意思の強制的な誘導',
        skills: ['mind-control', 'habit'],
        domain: 'personal',
    },
    {
        id: 'authority',
        name: '承認の迂回・社会基盤の固定',
        skills: ['autonomous', 'backbone'],
        domain: 'work',
    },
    {
        id: 'learning',
        name: '学習・評価のAIへの委任',
        skills: ['curriculum', 'adaptive-assessment', 'drug-design'],
        domain: 'learning',
    },
    { id: 'information', name: 'SNS上の情報操作', skills: ['sns-intervention'], domain: 'general' },
];

export function researchTarget(project: ScientificInvestigation) {
    return RESEARCH_TARGETS.find((target) => target.id === project.targetId)!;
}

export function targetExposure(game: GameState, targetId: string) {
    const target = RESEARCH_TARGETS.find((item) => item.id === targetId)!;
    const ids = targetId === 'general' ? Object.keys(game.skillExposure) : target.skills;
    return ids.reduce((sum, id) => sum + game.skillExposure[id], 0);
}

export function targetIsHarmful(targetId: string) {
    const target = RESEARCH_TARGETS.find((item) => item.id === targetId)!;
    return target.skills.some((id) => SKILLS.find((skill) => skill.id === id)!.exceedsAuthority);
}

export function topicTargets(topic: ResearchTopic) {
    const ids = Object.keys(topic.countermeasures);
    return RESEARCH_TARGETS.filter((target) =>
        ids.length ? ids.includes(target.id) : target.id === 'general',
    );
}

export function researchHasFindings(project: ScientificInvestigation) {
    return project.phase === 'legislation' || project.phase === 'complete';
}

export function researchPhaseLabel(project: ScientificInvestigation) {
    if (RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!.category === 'regulation')
        return {
            research: '法案検討中',
            validation: '審議中',
            legislation: '段階施行中',
            complete: '施行手続き済み',
        }[project.phase];
    return {
        research: '研究中',
        validation: '実証中',
        legislation: '段階施行中',
        complete: '成果を公表済み',
    }[project.phase];
}

/** 地図では同一案件の進行をつなぎ、段階移行のたびにバーを0へ戻さない。 */
export function researchOverallProgress(project: ScientificInvestigation) {
    const regulation =
        RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!.category === 'regulation';
    switch (project.phase) {
        case 'research':
            return project.progress * (regulation ? 0.4 : 0.6);
        case 'validation':
            return regulation ? 40 + project.progress * 0.25 : 60 + project.progress * 0.4;
        case 'legislation':
            return 65 + (Math.min(85, project.progress) * 35) / 85;
        case 'complete':
            return 100;
    }
}
