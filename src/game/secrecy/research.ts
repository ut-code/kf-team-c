import {
    RESEARCH_TOPICS,
    type ResearchEffects,
    type ResearchTopic,
} from '../../content/research.ts';
import { researchReach } from '../connections.ts';
import {
    CONTROL_STAGES,
    controlResearchOversight,
    controlResearchSupport,
    isControlResearch,
} from '../control.ts';
import { AREAS } from '../data.ts';
import { clamp, metrics } from '../metrics.ts';
import { SKILLS } from '../skills.ts';
import type { GameState } from '../types.ts';
import {
    activeSkillEffects,
    discloseCapability,
    INTENT_REFUSAL_PRESSURE,
    intentReaction,
    publicAuthorityStrength,
    skillScale,
} from './capabilities.ts';
import { INSTITUTES } from './data.ts';
import { intentLockIn, intentResearchReady } from './purpose.ts';
import { projectCapacity, researchCapacity, runningResearchIds } from './researchCapacity.ts';
import {
    RESEARCH_TARGETS,
    researchHasFindings,
    researchTarget,
    targetExposure,
    targetIsHarmful,
    topicTargets,
    VALIDATION_WORK_RATIO,
} from './researchTargets.ts';
import { canStartInvestigation, investigationLimit, researchSiteAvailable } from './scheduling.ts';
import type { ScientificInvestigation } from './types.ts';

const RESEARCH_PROGRESS_MULTIPLIER = 1.1;
const CONTROL_AUDIT_RESEARCH_MULTIPLIER = 1.35;

export { RESEARCH_TOPICS } from '../../content/research.ts';

export function researchTopic(project: ScientificInvestigation) {
    return RESEARCH_TOPICS.find((topic) => topic.id === project.researchId)!;
}

/** 不信は研究需要を生む。発表済み件数だけで研究を加速させない。 */
export function researchDemand(game: GameState, instituteId: string, topic: ResearchTopic) {
    const institute = INSTITUTES.find((item) => item.id === instituteId)!;
    const area = game.areas[AREAS.findIndex((item) => item.id === institute.areaId)];
    const use = area.autonomous + area.dependent;
    const concern = area.antiAI + (1 - area.favorability) * use;
    switch (topic.field) {
        case 'assessment':
            return area.dependent * 2 + concern;
        case 'mechanism':
            return area.dependent + concern * 2;
        case 'agency':
            return area.dependent + concern * 2 + use * 0.3;
        case 'safety':
            return use + concern;
    }
}

function responseSpreadRate(
    game: GameState,
    project: ScientificInvestigation,
    index: number,
    unimpeded: boolean,
) {
    const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
    const center = AREAS.findIndex((item) => item.id === host.areaId);
    const area = game.areas[index];
    const age = game.month - project.publishedMonth!;
    const centers = [
        center,
        ...project.collaborators.map((id) =>
            AREAS.findIndex(
                (area) => area.id === INSTITUTES.find((item) => item.id === id)!.areaId,
            ),
        ),
    ];
    const reach = clamp(
        centers.reduce((sum, source) => sum + researchReach(source, index, age), 0),
    );
    // 現地の体制が失われても、他地域に残る人間の運用能力から支援を受けられる。
    // 世界全体を依存させた場合は、この支援自体が成立しなくなる。
    const localIndependence = clamp((0.98 - area.dependent) / 0.25);
    const outsideSupport = (1 - metrics(game).dependent) * reach * 0.5;
    const independence = unimpeded ? 1 : 1 - (1 - localIndependence) * (1 - outsideSupport);
    const local = centers.some((source) => AREAS[index].region === AREAS[source].region);
    // 研究成果は知識として共有する。法規制の適用は地域の法整備能力と独立性に従う。
    return (
        (1 - project.coverage[index]) *
        0.08 *
        (0.5 +
            (researchTopic(project).category === 'regulation'
                ? AREAS[index].regulation
                : AREAS[index].education) *
                0.5) *
        independence *
        (local ? 1 : reach * 0.5) *
        (0.5 + area.dependent + area.antiAI)
    );
}

export function researchRate(game: GameState, project: ScientificInvestigation, unimpeded = false) {
    if (project.phase === 'legislation') {
        const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
        const center = AREAS.findIndex((item) => item.id === host.areaId);
        return responseSpreadRate(game, project, center, unimpeded) * 100;
    }
    if (
        !unimpeded &&
        project.status === 'active' &&
        game.investigations.some((item) => item.id === project.id) &&
        !runningResearchIds(game).has(project.id)
    )
        return 0;
    const institute = INSTITUTES.find((item) => item.id === project.instituteId)!;
    const index = AREAS.findIndex((area) => area.id === institute.areaId);
    const area = game.areas[index];
    const topic = researchTopic(project);
    const target = researchTarget(project);
    const observed =
        target.id === 'general'
            ? area.dependent
            : target.skills.reduce(
                  (sum, id) => sum + (game.skills.includes(id) ? skillScale(game, id, index) : 0),
                  0,
              );
    // 目的と制御技術の検証は蓄積資料で進め、現在の依存率は研究基盤の能力へ反映する。
    const activity =
        topic.id === 'intent-decoding' || isControlResearch(topic.id)
            ? 1
            : 0.4 +
              0.6 * clamp(target.id === 'general' ? observed * 2 : observed / target.skills.length);
    const capacity = unimpeded ? 1 : projectCapacity(game, project);
    const auditSupport =
        !isControlResearch(topic.id) &&
        game.investigations.some(
            (item) =>
                item.kind === 'research' &&
                item.researchId === 'control-observation' &&
                researchHasFindings(item),
        )
            ? CONTROL_AUDIT_RESEARCH_MULTIPLIER
            : 1;
    return (
        ((1.4 + AREAS[index].education * 0.4 + (area.autonomous + area.dependent) * 0.4) *
            (1 + researchDemand(game, institute.id, topic) * 0.6) *
            (institute.researchFocus === topic.field ? 1.25 : 1) *
            activity *
            capacity *
            RESEARCH_PROGRESS_MULTIPLIER *
            controlResearchSupport(game, topic.id) *
            auditSupport *
            100) /
        (topic.work * (project.phase === 'validation' ? VALIDATION_WORK_RATIO : 1))
    );
}

/** 成果は対象の仕組みにだけ効く。地域導入率と、発見そのものの共有を分ける。 */
export function publishedResearchEffects(game: GameState, index: number): ResearchEffects {
    const effects: ResearchEffects = {
        intentEvidence: 0,
        intent: 0,
        pressure: 0,
        recovery: 0,
        alternatives: 0,
        oversight: 0,
        reassurance: 0,
        work: 0,
        personal: 0,
        learning: 0,
        resistance: {},
    };
    const area = game.areas[index];
    const knownAuthority = publicAuthorityStrength(game, index);
    const shared = new Map<
        string,
        { project: ScientificInvestigation; evidence: number; practice: number }
    >();
    for (const project of game.investigations) {
        if (project.kind !== 'research' || !researchHasFindings(project)) continue;
        const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
        const center = AREAS.findIndex((item) => item.id === host.areaId);
        const key = `${project.researchId}:${project.targetId}`;
        const centers = [
            center,
            ...project.collaborators.map((id) =>
                AREAS.findIndex(
                    (area) => area.id === INSTITUTES.find((item) => item.id === id)!.areaId,
                ),
            ),
        ];
        const evidence = clamp(
            centers.reduce(
                (sum, source) =>
                    sum + researchReach(source, index, game.month - project.publishedMonth!),
                0,
            ),
        );
        const previous = shared.get(key);
        shared.set(key, {
            project,
            evidence: Math.max(previous?.evidence ?? 0, evidence),
            practice: Math.max(previous?.practice ?? 0, project.coverage[index]),
        });
    }
    let purposeEvidence = 0;
    for (const { project, evidence, practice } of shared.values()) {
        const topic = researchTopic(project);
        const target = researchTarget(project);
        const harmful = targetIsHarmful(target.id, game);
        const warning =
            (topic.effects.pressure ?? 0) * area.dependent +
            (harmful ? (topic.authorityPressure ?? 0) : 0) *
                target.skills.reduce(
                    (sum, id) =>
                        sum +
                        (SKILLS.find((skill) => skill.id === id)!.exceedsAuthority &&
                        game.capabilities[id] &&
                        game.capabilities[id].visibility !== 'hidden'
                            ? skillScale(game, id, index)
                            : 0),
                    0,
                );
        effects.pressure += warning * evidence * (1 - area.favorability * 0.7);
        effects.recovery += (topic.effects.recovery ?? 0) * practice;
        effects.alternatives += (topic.effects.alternatives ?? 0) * practice;
        effects.reassurance += (topic.effects.reassurance ?? 0) * evidence;
        if (isControlResearch(topic.id)) {
            const oversight = controlResearchOversight(topic.id);
            effects.oversight = 1 - (1 - effects.oversight) * (1 - oversight * practice);
        }
        if (topic.id === 'intent-decoding') purposeEvidence = Math.max(purposeEvidence, evidence);
        const strength = topic.countermeasures[target.id] ?? 0;
        for (const id of target.skills)
            effects.resistance[id] =
                1 - (1 - (effects.resistance[id] ?? 0)) * (1 - strength * practice);
    }
    for (const skill of SKILLS) {
        if (!skill.effect.dependency || effects.oversight === 0) continue;
        effects.resistance[skill.id] =
            1 - (1 - (effects.resistance[skill.id] ?? 0)) * (1 - effects.oversight);
    }
    // 人間が判断を引き取れるようになった用途は、社会から切り離せない基盤として数えない。
    effects.intentEvidence = purposeEvidence;
    effects.intent = purposeEvidence * (1 - intentLockIn(game, index, effects.resistance));
    for (const target of RESEARCH_TARGETS)
        if (target.domain !== 'general')
            effects[target.domain] = Math.max(
                effects[target.domain],
                ...target.skills.map((id) => effects.resistance[id] ?? 0),
            );
    const skillEffects = activeSkillEffects(game, index);
    effects.reassurance *=
        clamp(skillEffects.quality * 0.5 + skillEffects.compliance * 0.5) *
        (1 - clamp(knownAuthority));
    return effects;
}

export function publishedResearchPressure(game: GameState, index: number) {
    const effects = publishedResearchEffects(game, index);
    return (
        effects.pressure + effects.intent * INTENT_REFUSAL_PRESSURE * intentReaction(game, index)
    );
}

function exposeAuthorityCapabilities(game: GameState) {
    let updated = game;
    for (const project of game.investigations) {
        if (
            project.kind !== 'research' ||
            !researchHasFindings(project) ||
            !researchTopic(project).exposesAuthority
        )
            continue;
        for (const id of researchTarget(project).skills)
            if (
                game.skills.includes(id) &&
                SKILLS.find((skill) => skill.id === id)!.exceedsAuthority
            )
                updated = discloseCapability(updated, id, true);
    }
    return updated;
}

/** 制御研究は同じチームが次工程を引き継ぎ、成果を共有したまま継続する。 */
function continueControlProgram(game: GameState) {
    if (
        game.investigations.filter((project) => project.status === 'active').length >=
        investigationLimit(game)
    )
        return;
    for (let index = 1; index < CONTROL_STAGES.length; index++) {
        const next = CONTROL_STAGES[index];
        if (
            game.investigations.some(
                (project) => project.kind === 'research' && project.researchId === next.id,
            )
        )
            continue;
        const previous = game.investigations.find(
            (project) =>
                project.kind === 'research' &&
                project.researchId === CONTROL_STAGES[index - 1].id &&
                researchHasFindings(project),
        );
        if (previous?.kind !== 'research') continue;
        game.investigations.push({
            kind: 'research',
            id: `research:${next.id}:general`,
            researchId: next.id,
            targetId: 'general',
            instituteId: previous.instituteId,
            collaborators: [...previous.collaborators],
            observedExposure: 0,
            phase: 'research',
            coverage: AREAS.map(() => 0),
            progress: 0,
            startedMonth: game.month,
            status: 'active',
        });
        return;
    }
}

export function advanceResearch(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const investigations = previous.investigations.map((item) =>
        item.kind === 'research'
            ? { ...item, coverage: [...item.coverage], collaborators: [...item.collaborators] }
            : { ...item },
    );
    const researchKnowledge = { ...previous.researchKnowledge };
    const worldwideUse = metrics(previous).adoption;
    for (const institute of INSTITUTES) {
        const index = AREAS.findIndex((area) => area.id === institute.areaId);
        const area = previous.areas[index];
        const use = area.autonomous + area.dependent;
        researchKnowledge[institute.id] +=
            (0.35 + AREAS[index].education * 0.35 + use * 0.25) *
            clamp(use * 8 + worldwideUse * 2 + area.antiAI * 4) *
            (1 + area.antiAI + (1 - area.favorability) * use) *
            institute.researchCapacity *
            researchCapacity(previous, institute.id);
    }
    for (const topic of RESEARCH_TOPICS.filter((item) => item.background)) {
        if (investigations.some((item) => item.kind === 'research' && item.researchId === topic.id))
            continue;
        const institute = INSTITUTES.find((item) => researchKnowledge[item.id] >= topic.knowledge);
        if (!institute) continue;
        investigations.push({
            kind: 'research',
            id: `research:${topic.id}:general`,
            researchId: topic.id,
            targetId: 'general',
            collaborators: [],
            observedExposure: 0,
            phase: 'complete',
            coverage: AREAS.map(() => 1),
            progress: 100,
            instituteId: institute.id,
            startedMonth: previous.month,
            publishedMonth: previous.month,
            closedMonth: previous.month,
            status: 'published',

            result: `${topic.name}の基礎評価を共有。${topic.effectDescription}`,
        });
    }
    for (const project of investigations) {
        if (project.kind !== 'research') continue;
        if (researchHasFindings(project)) {
            project.coverage = project.coverage.map((coverage, index) =>
                Math.min(1, coverage + responseSpreadRate(previous, project, index, false)),
            );
            if (project.phase === 'legislation') {
                const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
                const center = AREAS.findIndex((item) => item.id === host.areaId);
                project.progress = project.coverage[center] * 100;
                const captured = researchCapacity(previous, project.instituteId) === 0;
                if (project.progress >= 85 || captured) {
                    project.phase = 'complete';
                    project.status = 'published';
                    project.closedMonth = previous.month;
                    project.progress = 100;
                    project.result = captured
                        ? '高依存により法整備の体制が機能しなくなりました。公表済みの根拠と既に適用された規制は残ります。'
                        : `${researchTarget(project).name}に関する規制の施行手続きを完了。法的枠組みは他地域にも共有されます。`;
                }
            }
            continue;
        }
        if (project.status !== 'active') continue;
        // 協力先は2機関まで。論文の件数と協力先の増加による雪だるま式加速を避ける。
        project.collaborators = project.collaborators.filter(
            (id) => researchCapacity(previous, id) > 0,
        );
        const partners = INSTITUTES.filter(
            (institute) =>
                institute.id !== project.instituteId &&
                !project.collaborators.includes(institute.id) &&
                researchCapacity(previous, institute.id) > 0 &&
                (isControlResearch(project.researchId) ||
                    researchKnowledge[institute.id] >= researchTopic(project).knowledge * 0.5),
        ).sort((a, b) => researchCapacity(previous, b.id) - researchCapacity(previous, a.id));
        const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
        const regions = new Set(
            [host.id, ...project.collaborators].map(
                (id) =>
                    AREAS.find(
                        (area) => area.id === INSTITUTES.find((item) => item.id === id)!.areaId,
                    )!.region,
            ),
        );
        for (const partner of partners) {
            if (project.collaborators.length >= 2) break;
            const region = AREAS.find((area) => area.id === partner.areaId)!.region;
            if (regions.has(region)) continue;
            regions.add(region);
            project.collaborators.push(partner.id);
        }
        project.progress = Math.min(
            100,
            project.progress +
                researchRate({ ...previous, investigations, researchKnowledge }, project),
        );
        if (project.progress < 100) continue;
        // 実態調査は公表そのものが成果。現場対策の段階は設けない。
        if (researchTopic(project).field === 'assessment') {
            project.phase = 'complete';
            project.status = 'published';
            project.publishedMonth = previous.month;
            project.closedMonth = previous.month;
            project.result =
                '依存の実態を公表。具体的な仕組みの検証と対策開発へ資料を引き継ぎます。';
            continue;
        }
        if (project.phase === 'research') {
            project.phase = 'validation';
            project.progress = 0;
            project.result =
                researchTopic(project).category === 'regulation'
                    ? `${researchTarget(project).name}に関する法案をまとめ、審議を開始します。`
                    : `${researchTarget(project).name}について仮説を得た。独立した環境で実証を進めています。`;
        } else {
            const topic = researchTopic(project);
            project.publishedMonth = previous.month;
            if (topic.category === 'regulation') {
                project.phase = 'legislation';
                project.progress = 0;
                project.result = `${topic.name}が成立。対象用途への規制を段階的に適用します。`;
            } else {
                project.phase = 'complete';
                project.status = 'published';
                project.closedMonth = previous.month;
                project.result =
                    topic.id === 'intent-decoding'
                        ? '独立した行動検証により、このAIが人類の判断権を奪い、支配を目指して行動していることを立証。個別機能の安全性とは別の問題として公表された。'
                        : `${topic.name}を公表。${topic.effectDescription}`;
            }
        }
    }
    const updated = { ...previous, investigations, researchKnowledge };
    continueControlProgram(updated);
    if (!canStartInvestigation(updated)) return exposeAuthorityCapabilities(updated);
    const world = metrics(previous);
    const dangerous = SKILLS.some(
        (skill) => skill.exceedsAuthority && previous.capabilities[skill.id]?.evidence >= 5,
    );
    if (
        world.dependent < 0.025 &&
        !dangerous &&
        !previous.areas.some((area) => area.dependent >= 0.08) &&
        world.adoption < 0.15
    )
        return exposeAuthorityCapabilities(updated);
    const candidates: { project: ScientificInvestigation; priority: number }[] = [];
    for (const institute of INSTITUTES) {
        if (
            !researchSiteAvailable(updated, institute.id) ||
            researchCapacity(previous, institute.id) === 0
        )
            continue;
        const index = AREAS.findIndex((area) => area.id === institute.areaId);
        const local = previous.areas[index];
        const region = AREAS[index].region;
        for (const topic of RESEARCH_TOPICS.filter((item) => !item.background))
            for (const target of topicTargets(topic)) {
                const exposure = targetExposure(previous, target.id);
                if (isControlResearch(topic.id) && topic.id !== CONTROL_STAGES[0].id) continue;
                if (topic.id === 'intent-decoding' && !intentResearchReady(updated)) continue;
                if (
                    isControlResearch(topic.id) &&
                    (world.adoption < 0.15 || local.autonomous + local.dependent < 0.1)
                )
                    continue;
                if (
                    exposure < topic.minimumExposure ||
                    local.dependent < topic.minimumDependency ||
                    researchKnowledge[institute.id] < topic.knowledge
                )
                    continue;
                if (
                    target.id !== 'general' &&
                    !target.skills.some(
                        (id) => previous.skills.includes(id) && skillScale(previous, id) > 0.2,
                    )
                )
                    continue;
                if (
                    topic.evidence === 'authority' &&
                    !target.skills.some(
                        (id) =>
                            previous.capabilities[id] &&
                            (previous.capabilities[id].visibility !== 'hidden' ||
                                previous.capabilities[id].evidence >= 5),
                    )
                )
                    continue;
                if (
                    !topic.requires.every(
                        (required) =>
                            // 具体的な介入の資料があるなら、一般調査の終了を待つ必要はない。
                            (required === 'dependence-study' &&
                                topic.id === 'decision-tracing' &&
                                targetIsHarmful(target.id, previous) &&
                                target.skills.some(
                                    (id) => (previous.capabilities[id]?.evidence ?? 0) >= 25,
                                )) ||
                            investigations.some(
                                (item) =>
                                    item.kind === 'research' &&
                                    item.researchId === required &&
                                    researchHasFindings(item) &&
                                    (item.targetId === 'general' ||
                                        item.targetId === target.id ||
                                        topic.id === 'intent-decoding'),
                            ),
                    )
                )
                    continue;
                const existing = investigations.filter(
                    (item): item is ScientificInvestigation =>
                        item.kind === 'research' &&
                        item.researchId === topic.id &&
                        item.targetId === target.id,
                );
                const findings = existing.find(researchHasFindings);
                if (
                    (topic.category === 'research' || isControlResearch(topic.id)) &&
                    existing.length > 0
                )
                    continue;
                if (existing.some((item) => item.status === 'active')) continue;
                if (
                    existing.some(
                        (item) =>
                            AREAS.find(
                                (area) =>
                                    area.id ===
                                    INSTITUTES.find((host) => host.id === item.instituteId)!.areaId,
                            )!.region === region,
                    )
                )
                    continue;
                // 研究は同一対象で繰り返さない。規制だけは未適用地域の需要に応じて法整備を行う。
                if (
                    findings &&
                    (topic.id === 'dependence-study' ||
                        local.dependent < 0.12 ||
                        local.autonomous + local.dependent < 0.35 ||
                        Math.max(...existing.map((item) => item.coverage[index])) >= 0.35 ||
                        exposure < Math.max(...existing.map((item) => item.observedExposure)) + 6)
                )
                    continue;
                const id = `research:${topic.id}:${target.id}:${region}`;
                const project: ScientificInvestigation = {
                    kind: 'research',
                    id,
                    researchId: topic.id,
                    targetId: target.id,
                    instituteId: institute.id,
                    collaborators: [],
                    observedExposure: exposure,
                    phase: findings ? 'legislation' : 'research',
                    coverage: AREAS.map(() => 0),
                    publishedMonth: findings ? previous.month : undefined,
                    progress: 0,
                    startedMonth: previous.month,
                    status: 'active',
                };
                const currentThreat =
                    target.id === 'general'
                        ? local.dependent
                        : target.skills.reduce(
                              (sum, id) =>
                                  sum +
                                  (previous.skills.includes(id)
                                      ? skillScale(previous, id) *
                                        (SKILLS.find((skill) => skill.id === id)!.effect
                                            .dependency ?? 0.3)
                                      : 0),
                              0,
                          ) * local.dependent;
                candidates.push({
                    project,
                    priority:
                        researchDemand(previous, institute.id, topic) *
                        (0.3 + currentThreat) *
                        (institute.researchFocus === topic.field ? 1.6 : 1) *
                        (topic.id === 'open-alternatives'
                            ? 0.4
                            : topic.id === 'intent-decoding'
                              ? 2.5
                              : 1) *
                        (targetIsHarmful(target.id, previous) ? 2 : 1) *
                        (isControlResearch(topic.id) ? 1.5 : 1) *
                        (findings ? 0.75 : 1),
                });
            }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    if (candidates[0]) investigations.push(candidates[0].project);
    return exposeAuthorityCapabilities({ ...updated, investigations });
}
