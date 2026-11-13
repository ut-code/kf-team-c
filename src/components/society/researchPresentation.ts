import { BadgeCheck, Scale, Search, ShieldCheck } from 'lucide-react';
import { CONTROL_STAGES, isControlResearch } from '../../game/control';
import { researchTopic } from '../../game/secrecy/research';
import { researchTarget } from '../../game/secrecy/researchTargets';
import type { ScientificInvestigation } from '../../game/secrecy/types';

/** 同じ研究は地図・通知・詳細で同じ記号を使う。 */
export function researchPresentation(project: ScientificInvestigation) {
    const topic = researchTopic(project);
    if (isControlResearch(topic.id))
        return { Icon: ShieldCheck, label: '制御技術', color: 'var(--accent)' };
    if (topic.category === 'regulation')
        return { Icon: Scale, label: '法規制', color: 'var(--warning)' };
    if (topic.field === 'safety')
        return { Icon: BadgeCheck, label: '安全性の確認', color: 'var(--accent)' };
    if (
        Object.keys(topic.countermeasures).length ||
        topic.effects.recovery ||
        topic.effects.alternatives
    )
        return { Icon: ShieldCheck, label: '依存対策', color: 'var(--warning)' };
    return { Icon: Search, label: '実態・危険性の解明', color: 'var(--warning)' };
}

export function researchEffectLabels(project: ScientificInvestigation) {
    const topic = researchTopic(project);
    const effects: string[] = [];
    if (isControlResearch(topic.id)) effects.push(topic.effectDescription);
    for (const stage of CONTROL_STAGES)
        if (stage.supports.some((id) => id === topic.id))
            effects.push(`「${stage.label}」の研究を加速`);
    const strength = topic.countermeasures[project.targetId] ?? 0;
    if (strength)
        effects.push(
            `${researchTarget(project).name}による依存化を最大${Math.round(strength * 100)}%抑制`,
        );
    if (topic.effects.recovery) effects.push('依存者が自律的な利用へ戻りやすくなる');
    if (topic.effects.alternatives) effects.push('AIを使わない選択が増える');
    if (topic.effects.reassurance) effects.push('安全性への評価が信頼度と利用再開を後押しする');
    if (topic.id === 'intent-decoding')
        effects.push('支配目的の立証により信頼度が低下し、利用拒否が広がる');
    else if (topic.effects.pressure || topic.authorityPressure)
        effects.push('公表された根拠が伝わった地域で利用拒否が増える');
    return effects;
}
