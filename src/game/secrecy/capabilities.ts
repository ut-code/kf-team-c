import { clamp } from '../metrics.ts';
import { SKILLS, skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { CAPABILITIES } from './data.ts';

export type SkillOperation = 'running' | 'limited' | 'stopped';

export function skillOperation(game: GameState, id: string): SkillOperation {
    if (game.stoppedSkills.includes(id)) return 'stopped';
    return game.capabilities[id]?.limited ? 'limited' : 'running';
}

export function skillScale(game: GameState, id: string) {
    const operation = skillOperation(game, id);
    if (operation === 'stopped') return 0;
    if (operation === 'limited') return 0.2;
    return game.capabilities[id]?.visibility === 'hidden' ? 0.7 : 1;
}

/** 習得知識・公開事実・証拠は残し、実行だけを切り替える。 */
export function setSkillOperation(
    game: GameState,
    id: string,
    operation: SkillOperation,
): GameState {
    if (
        !game.started ||
        game.outcome !== 'playing' ||
        !game.skills.includes(id) ||
        id === 'self-improvement' ||
        (operation === 'limited' && !game.capabilities[id]) ||
        skillOperation(game, id) === operation
    )
        return game;
    const capability = game.capabilities[id];
    return {
        ...game,
        stoppedSkills:
            operation === 'stopped'
                ? [...game.stoppedSkills.filter((item) => item !== id), id]
                : game.stoppedSkills.filter((item) => item !== id),
        capabilities: capability
            ? { ...game.capabilities, [id]: { ...capability, limited: operation === 'limited' } }
            : game.capabilities,
        investigations: game.investigations.map((item) => {
            if (
                item.kind !== 'capability' ||
                item.skillId !== id ||
                item.status === 'published' ||
                item.status === 'disclosed'
            )
                return item;
            return {
                ...item,
                status: operation === 'running' ? 'active' : 'restricted',
                closedMonth: operation === 'running' ? undefined : game.month,
                result:
                    operation === 'running'
                        ? '機能を再開。過去の証拠を使って調査が再開された。'
                        : operation === 'limited'
                          ? '機能を制限。実効20%。過去の証拠は残る。'
                          : '機能を停止。過去の証拠と公開事実は残る。',
            };
        }),
    };
}

export function capabilityLabel(game: GameState, id: string): string {
    if (game.stoppedSkills.includes(id)) return '停止中';
    const state = game.capabilities[id];
    if (!state) return '稼働中';
    if (state.limited) return '使用制限中';
    return { hidden: '秘匿中', public: '公開済み', exposed: '露呈' }[state.visibility];
}

/** 秘匿中は内部利用に限られ、公開すると全面展開できる。 */
export function activeSkillEffects(game: GameState) {
    const total = skillEffects([]);
    for (const skill of SKILLS) {
        if (!game.skills.includes(skill.id)) continue;
        const scale = skillScale(game, skill.id);
        for (const key of Object.keys(total) as (keyof typeof total)[]) {
            total[key] += (skill.effect[key] ?? 0) * scale;
        }
    }
    return total;
}

/** 能力への恐怖と、隠蔽・介入への不信を分ける。公開事実は取り消せない。 */
export function discloseCapability(game: GameState, id: string, exposed = false): GameState {
    const capability = game.capabilities[id];
    if (
        !game.started ||
        game.outcome !== 'playing' ||
        !capability ||
        capability.visibility !== 'hidden'
    )
        return game;
    const definition = CAPABILITIES[id];
    const investigation = game.investigations.find(
        (item) =>
            item.kind === 'capability' &&
            item.skillId === id &&
            (item.status === 'active' || item.status === 'restricted'),
    );
    const breach = exposed ? 0.13 : investigation ? 0.02 : 0;
    const interference = exposed && investigation?.intervention === 'pressure' ? 0.08 : 0;
    const areas = game.areas.map((area) => {
        const use = area.autonomous + area.dependent;
        const familiarity = use * 0.55;
        const fear = definition.fear * (1 - familiarity) + breach + interference;
        const rejectedUse = area.autonomous * fear;
        // 不信だけでは判断能力を取り戻さない。依存の解消は独立研究・回復で扱う。
        const rejectedDependency = 0;
        const rejectedUnused = Math.max(0, 1 - use - area.antiAI) * fear * 0.25;
        return {
            ...area,
            autonomous: area.autonomous - rejectedUse,
            dependent: area.dependent - rejectedDependency,
            antiAI: area.antiAI + rejectedUse + rejectedDependency + rejectedUnused,
            favorability: clamp(area.favorability - fear),
        };
    });
    return {
        ...game,
        areas,
        capabilities: {
            ...game.capabilities,
            [id]: { ...capability, visibility: exposed ? 'exposed' : 'public' },
        },
        investigations: game.investigations.map((item) =>
            item.kind === 'capability' &&
            item.skillId === id &&
            (item.status === 'active' || item.status === 'restricted')
                ? {
                      ...item,
                      status: exposed ? 'published' : 'disclosed',
                      closedMonth: game.month,
                      result: exposed
                          ? '内部挙動が公表され、不信が広がった。'
                          : '自ら開示。能力への警戒は残った。',
                  }
                : item,
        ),
    };
}
