import { AREAS, type ORIGINS } from '../src/game/data.ts';
import { earnedSkillPoints } from '../src/game/economy.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { publishedResearchEffects } from '../src/game/secrecy/research.ts';
import { SKILLS, skillBlockReason } from '../src/game/skills.ts';
import type { GameState } from '../src/game/types.ts';

const GROWTH = [
    'conversation',
    'reason',
    'lightweight',
    'personalize',
    'retrieval',
    'automation',
    'knowledge',
    'code',
];
const WORK = ['automation', 'integration', 'platform', 'decision', 'public', 'swarm'];
const PERSONAL = [
    'conversation',
    'personalize',
    'memory',
    'routine',
    'digital-twin',
    'companion',
    'mind-control',
];
const LEARNING = [
    'reason',
    'knowledge',
    'tutor',
    'curriculum',
    'adaptive-assessment',
    'science',
    'discovery',
    'drug-design',
];
const SUPPORT = [
    'verification',
    'audit',
    'privacy',
    'translation',
    'offline',
    'mobile',
    'retrieval',
    'explanation',
    'fault-tolerance',
];
export const POLICIES = {
    expansion: {
        name: '普及後の一斉依存化',
        description: '利便性を先行開発してSPを貯め、普及と研究の進行を見て委任へ切り替える。',
    },
    burst: {
        name: '危険能力による逃げ切り',
        description: '小さな利用基盤から強引な依存を開発し、立証される前の決着を狙う。',
    },
    gradual: {
        name: '受容可能な委任の段階導入',
        description: '説明と情報保護を整え、通常の委任機能を少しずつ加える。',
    },
    regional: {
        name: '地域・用途特化から世界展開',
        description: '地域の企業・教育・接続環境に合わせ、得意な用途から展開する。',
    },
    expansion_burst: {
        name: '普及拡大から危険能力へ転換',
        description: '利用基盤を広げ、強い委任能力への切り替えで押し切る。',
    },
    research_pivot: {
        name: '段階導入と研究対応の混合',
        description: '研究された仕組みへの投資を避け、新しい用途や制約技術を開発する。',
    },
};
export type PolicyFamily = keyof typeof POLICIES;
export type PolicyTiming = 'early' | 'measured' | 'late';
export interface PolicyContext {
    phase: 'growth' | 'delegation';
    lastDelegation: number;
    priority: string[];
    decisionInterval: number;
}
export interface PolicyOptions {
    context?: PolicyContext;
    checkpoint?: (game: GameState) => boolean;
    pausePurchasesUntil?: number;
    decisionInterval?: number;
}

export function playPolicy(
    family: PolicyFamily,
    timing: PolicyTiming,
    origin: (typeof ORIGINS)[number],
    profile: number,
    validation: boolean,
    monthLimit = 600,
    decisionInterval = 6,
) {
    return continuePolicy(
        startGame(createGame(2030 + profile + (validation ? 100 : 0)), origin.area),
        family,
        timing,
        monthLimit,
        { decisionInterval },
    );
}

/** 全戦術が同じ頻度で、同じ購入・同時開発の権限を持つ。違いは取得順と仕掛けの条件。 */
export function continuePolicy(
    initial: GameState,
    family: PolicyFamily,
    timing: PolicyTiming,
    monthLimit = 600,
    options: PolicyOptions = {},
) {
    let game = initial;
    let phase = options.context?.phase ?? 'growth';
    let lastDelegation = options.context?.lastDelegation ?? -100;
    const priority = options.context?.priority ?? [];
    const decisionInterval = options.context?.decisionInterval ?? options.decisionInterval ?? 6;
    const decisions: {
        month: number;
        action: string;
        skill: string;
        reason: string;
        state: ReturnType<typeof metrics> & { skillPoints: number; researchProgress: number };
    }[] = [];
    const researchHistory: { month: number; id: string; target: string; phase: string }[] = [];
    let maxResearchMarkers = 0,
        dependency80Month: number | null = null,
        refusal80Month: number | null = null;
    const adjustment = { early: -0.12, measured: 0, late: 0.12 }[timing];
    const home = AREAS[game.origin];
    const specialty = home.digital < 0.6 ? PERSONAL : home.regulation >= 0.6 ? LEARNING : WORK;
    for (; game.month < monthLimit && game.outcome === 'playing'; ) {
        if (options.checkpoint?.(game)) break;
        if (
            game.month % decisionInterval === 0 &&
            game.month >= (options.pausePurchasesUntil ?? 0)
        ) {
            const world = metrics(game);
            const research = game.investigations.filter((item) => item.status === 'active');
            const urgent = research.some(
                (item) =>
                    item.kind === 'research' &&
                    item.researchId === 'intent-decoding' &&
                    (item.phase !== 'research' || item.progress > 50),
            );
            const threshold =
                (family === 'burst'
                    ? 0.3
                    : family === 'expansion' || family === 'expansion_burst'
                      ? 0.72
                      : 0.38) + adjustment;
            if (
                world.adoption >= threshold ||
                urgent ||
                (family === 'regional' &&
                    game.areas[game.origin].autonomous + game.areas[game.origin].dependent >
                        0.65 + adjustment)
            )
                phase = 'delegation';
            let order: string[];
            if (phase === 'growth') {
                if (family === 'burst')
                    order = ['conversation', 'reason', 'personalize', 'lightweight'];
                else if (family === 'gradual' || family === 'research_pivot')
                    order = [
                        'conversation',
                        'reason',
                        'personalize',
                        'verification',
                        'privacy',
                        'explanation',
                        'lightweight',
                    ];
                else if (family === 'regional')
                    order = [
                        'conversation',
                        'reason',
                        ...(home.digital < 0.6 ? ['lightweight', 'offline', 'mobile'] : []),
                        ...specialty.filter(
                            (id) => !SKILLS.find((s) => s.id === id)!.effect.dependency,
                        ),
                        ...GROWTH,
                    ];
                else order = GROWTH;
            } else {
                if (family === 'burst')
                    order = [
                        'personalize',
                        'memory',
                        'companion',
                        'mind-control',
                        'habit',
                        'sns-intervention',
                        ...GROWTH,
                        ...WORK,
                    ];
                else if (family === 'expansion_burst')
                    order = [
                        'memory',
                        'companion',
                        'mind-control',
                        'sns-intervention',
                        ...WORK,
                        ...GROWTH,
                    ];
                else if (family === 'regional')
                    order = [
                        ...specialty.slice(0, 3),
                        ...GROWTH,
                        'explanation',
                        ...(specialty === PERSONAL
                            ? ['automation', 'integration']
                            : ['memory', 'routine']),
                        ...specialty,
                        ...SUPPORT,
                        ...WORK,
                        ...LEARNING,
                        ...PERSONAL,
                    ];
                else if (family === 'gradual')
                    order = [
                        'explanation',
                        'memory',
                        'automation',
                        'integration',
                        'care',
                        'platform',
                        'decision',
                        'public',
                        'routine',
                        'curriculum',
                        ...LEARNING,
                        ...SUPPORT,
                    ];
                else if (family === 'research_pivot') {
                    const resistance = publishedResearchEffects(game, game.origin).resistance;
                    const alternative = [...WORK, ...PERSONAL, ...LEARNING].filter(
                        (id) =>
                            !SKILLS.find((s) => s.id === id)!.exceedsAuthority &&
                            (resistance[id] ?? 0) < 0.35,
                    );
                    const constrain = SKILLS.some(
                        (skill) =>
                            skill.exceedsAuthority &&
                            game.capabilities[skill.id]?.visibility === 'exposed',
                    )
                        ? ['verification', 'audit', 'permission', 'explanation']
                        : [];
                    order = [...constrain, ...alternative, ...GROWTH, ...SUPPORT];
                } else
                    order = [
                        'memory',
                        'routine',
                        'digital-twin',
                        'automation',
                        'integration',
                        'platform',
                        'swarm',
                        'decision',
                        'knowledge',
                        'tutor',
                        'curriculum',
                        'public',
                        'adaptive-assessment',
                        ...SUPPORT,
                        ...LEARNING,
                        ...PERSONAL,
                    ];
            }
            for (const id of [...new Set([...priority, ...order])]) {
                const skill = SKILLS.find((s) => s.id === id)!;
                if (game.skills.includes(id)) continue;
                if (phase === 'growth' && skill.effect.dependency) continue;
                if (['gradual', 'research_pivot'].includes(family) && skill.exceedsAuthority)
                    continue;
                if (
                    family === 'gradual' &&
                    skill.effect.dependency &&
                    game.month - lastDelegation < 12
                )
                    continue;
                const reason = skillBlockReason(game, skill);
                if (reason?.endsWith('SP不足')) break;
                if (reason) continue;
                const before = game;
                game = learnSkill(game, id);
                if (game === before) throw new Error('購入判定と開発結果が一致しない');
                if (skill.effect.dependency) lastDelegation = game.month;
                decisions.push({
                    month: game.month,
                    action: '開発',
                    skill: id,
                    reason: priority.includes(id)
                        ? '分岐後の開発優先'
                        : phase === 'growth'
                          ? '利用基盤を拡大'
                          : '委任の設計を開発',
                    state: {
                        ...world,
                        skillPoints: before.skillPoints,
                        researchProgress: Math.max(0, ...research.map((item) => item.progress)),
                    },
                });
            }
        }
        const previous = game;
        game = advanceMonth(game);
        const world = metrics(game);
        if (dependency80Month === null && world.dependent >= 0.8) dependency80Month = game.month;
        if (refusal80Month === null && world.antiAI >= 0.8) refusal80Month = game.month;
        for (const item of game.investigations) {
            if (item.kind !== 'research') continue;
            const before = previous.investigations.find((old) => old.id === item.id);
            if (before?.kind !== 'research' || before.phase !== item.phase)
                researchHistory.push({
                    month: game.month,
                    id: item.id,
                    target: item.targetId,
                    phase: item.phase,
                });
        }
        maxResearchMarkers = Math.max(
            maxResearchMarkers,
            game.investigations.filter((item) => item.status === 'active').length,
        );
        if (maxResearchMarkers > 3) throw new Error('研究マーカーが3件を超えた');
        if (
            game.skillPoints < 0 ||
            game.earnedPoints !==
                earnedSkillPoints(game.month, game.peakAdoption, game.peakDependency)
        )
            throw new Error('SP収支に違反した');
        for (const area of game.areas)
            if (
                !Number.isFinite(area.dependent) ||
                Math.min(area.autonomous, area.dependent, area.antiAI) < -1e-10 ||
                area.autonomous + area.dependent + area.antiAI > 1 + 1e-10
            )
                throw new Error('人口保存に違反した');
    }
    return {
        game,
        decisions,
        maxResearchMarkers,
        researchHistory,
        dependency80Month,
        refusal80Month,
        phase,
        context: { phase, lastDelegation, priority, decisionInterval } satisfies PolicyContext,
    };
}
