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
        skills: ['companion', 'care'],
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
        skills: ['curriculum', 'drug-design'],
        domain: 'learning',
    },
    { id: 'information', name: 'SNS上の情報操作', skills: ['sns-intervention'], domain: 'general' },
];

export function researchTarget(project: ScientificInvestigation) {
    return RESEARCH_TARGETS.find((target) => target.id === project.targetId)!;
}

export function targetExposure(game: GameState, targetId: string) {
    const target = RESEARCH_TARGETS.find((item) => item.id === targetId)!;
    const ids =
        targetId === 'general'
            ? SKILLS.filter((skill) => skill.effect.dependency || skill.exceedsAuthority).map(
                  (skill) => skill.id,
              )
            : target.skills;
    return ids.reduce((sum, id) => sum + game.skillExposure[id], 0);
}

export function targetIsHarmful(targetId: string, game: GameState) {
    const target = RESEARCH_TARGETS.find((item) => item.id === targetId)!;
    return target.skills.some(
        (id) =>
            SKILLS.find((skill) => skill.id === id)!.exceedsAuthority &&
            (game.skillExposure[id] > 0 || game.skills.includes(id)),
    );
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

export function researchOutcomeSummary(project: ScientificInvestigation) {
    const topic = RESEARCH_TOPICS.find((item) => item.id === project.researchId)!;
    if (topic.id === 'intent-decoding') return '支配目的が立証され、利用拒否が広がる';
    if (topic.category === 'regulation') return '対象用途への規制を段階的に適用';
    if (topic.effects.recovery) return '依存者の自律的な利用への回復を支援';
    if (topic.effects.alternatives) return 'AIを使わない選択が広がる';
    if (topic.countermeasures[project.targetId]) return '対象の仕組みによる依存化への対策を共有';
    if (topic.effects.reassurance) return '安全性の確認が信頼度の回復を後押し';
    return '依存の実態を共有し、利用者の警戒が広がる';
}

export function researchPhaseLabel(project: ScientificInvestigation) {
    if (RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!.field === 'assessment')
        return project.phase === 'complete' ? '調査結果を公表済み' : '調査中';
    if (RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!.category === 'regulation')
        return {
            research: '法案検討中',
            validation: '審議中',
            legislation: '成立・施行中',
            complete: '成立・施行中',
        }[project.phase];
    return {
        research: '研究中',
        validation: '検証中',
        legislation: '段階施行中',
        complete: '成果を公表済み',
    }[project.phase];
}

/** 地図では同一案件の進行をつなぎ、段階移行のたびにバーを0へ戻さない。 */
export function researchOverallProgress(project: ScientificInvestigation) {
    if (RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!.field === 'assessment')
        return project.progress;
    switch (project.phase) {
        case 'research':
            return project.progress * 0.6;
        case 'validation':
            return 60 + project.progress * 0.4;
        case 'legislation':
            return 100;
        case 'complete':
            return 100;
    }
}
