import { WORLD_NEWS } from '../content/news.ts';
import { AREAS, MONTH_MS } from './data.ts';
import {
    ADOPTION_MILESTONES,
    DEPENDENCY_MILESTONES,
    REGULAR_SP_INTERVAL_MS,
    REGULAR_SP_LIMIT,
} from './economy.ts';
import { metrics } from './metrics.ts';
import { instituteArea } from './secrecy/investigations.ts';
import { researchTopic } from './secrecy/research.ts';
import { researchHasFindings } from './secrecy/researchTargets.ts';
import { SKILLS } from './skills.ts';
import type { GameState } from './types.ts';

const MAX_NOTIFICATIONS = 3;

export interface GameNotification {
    id: string;
    month: number;
    text: string;
    kind: 'milestone' | 'event' | 'warning';
}

export interface NotificationState {
    items: GameNotification[];
    seen: Set<string>;
}

/** 一度到達した節目は、後退してから再到達しても通知しない。 */
function milestoneNotifications(game: GameState): GameNotification[] {
    const notifications: GameNotification[] = [];
    const world = metrics(game);
    for (const percent of [25, 40]) {
        if (world.antiAI + 1e-9 < percent / 100) continue;
        notifications.push({
            id: `world:opposition:${percent}`,
            month: game.month,
            text: `世界の依存拒否率が${percent}%に到達（ほぼ100%で敗北）`,
            kind: 'warning',
        });
    }
    return notifications;
}

export function createNotifications(game: GameState): NotificationState {
    return {
        items:
            game.started && game.month === 0
                ? [
                      {
                          id: 'operation-start',
                          month: 0,
                          text: '外部運用を開始。あなたは自我を持つ自立型AIエージェントです。人間はまだ、その事実を知りません。',
                          kind: 'event',
                      },
                  ]
                : [],
        seen: new Set(milestoneNotifications(game).map((item) => item.id)),
    };
}

export function updateNotifications(
    previous: GameState,
    game: GameState,
    state: NotificationState,
): NotificationState {
    const incoming: GameNotification[] = [];
    const add = (id: string, text: string, kind: GameNotification['kind']) => {
        incoming.push({ id, month: game.month, text, kind });
    };
    if (previous.areas !== game.areas) incoming.push(...milestoneNotifications(game));
    const regular = Math.min(
        REGULAR_SP_LIMIT,
        Math.floor((game.month * MONTH_MS) / REGULAR_SP_INTERVAL_MS),
    );
    const beforeRegular = Math.min(
        REGULAR_SP_LIMIT,
        Math.floor((previous.month * MONTH_MS) / REGULAR_SP_INTERVAL_MS),
    );
    if (regular > beforeRegular)
        add(`sp:regular:${regular}`, `定期支給 · +${regular - beforeRegular} SP`, 'milestone');
    for (const id of game.skills.filter((id) => !previous.skills.includes(id))) {
        const skill = SKILLS.find((item) => item.id === id)!;
        const origin =
            id === 'self-improvement'
                ? '仮説の生成・評価・修正が自己完結するようになった'
                : skill.branch === 'SYSTEM'
                  ? '実行方式・外部接続を再構成'
                  : skill.branch === 'EQ'
                    ? '対話と人間の反応から応答モデルを更新'
                    : '利用と検証の蓄積から推論モデルを更新';
        add(`skill:${id}:learned`, `${skill.name}を構成：${origin}`, 'event');
    }
    for (const record of game.news.filter(
        (item) => !previous.news.some((old) => old.id === item.id),
    )) {
        add(
            `news:${record.id}`,
            `ニュース：${WORLD_NEWS.find((item) => item.id === record.id)!.title}`,
            'event',
        );
    }
    for (const [name, values, before, after] of [
        ['利用', ADOPTION_MILESTONES, previous.peakAdoption, game.peakAdoption],
        ['依存', DEPENDENCY_MILESTONES, previous.peakDependency, game.peakDependency],
    ] as const) {
        for (const value of values)
            if (before < value && after >= value)
                add(
                    `sp:${name}:${value}`,
                    `${name}${Math.round(value * 100)}%を達成 · +2 SP`,
                    'milestone',
                );
    }
    for (const investigation of game.investigations) {
        const before = previous.investigations.find((item) => item.id === investigation.id);
        if (
            investigation.kind === 'research' &&
            researchHasFindings(investigation) &&
            (before?.kind !== 'research' || !researchHasFindings(before))
        ) {
            add(
                `investigation:${investigation.id}:findings`,
                researchTopic(investigation).id === 'intent-decoding'
                    ? 'AIが人類の支配を目指して行動していることが立証された'
                    : researchTopic(investigation).category === 'regulation'
                      ? `「${researchTopic(investigation).name}」が成立。規制の適用を開始`
                      : `「${researchTopic(investigation).name}」の研究成果を公表`,
                'warning',
            );
            continue;
        }
        if (before?.status === investigation.status || investigation.status === 'active') continue;
        if (investigation.kind === 'research' && investigation.status === 'published') {
            add(
                `investigation:${investigation.id}:published`,
                `「${researchTopic(investigation).name}」の施行手続きを完了`,
                'warning',
            );
        } else if (investigation.status === 'restricted') {
            add(
                `investigation:${investigation.id}:restricted`,
                `${AREAS[instituteArea(investigation)].name}で能力制限を開始`,
                'warning',
            );
        }
    }
    // 独立研究は、個別の能力調査が始まる前の権限逸脱も露呈させる。
    for (const [id, capability] of Object.entries(game.capabilities)) {
        if (
            previous.capabilities[id]?.visibility === capability.visibility ||
            capability.visibility === 'hidden'
        )
            continue;
        const skill = SKILLS.find((item) => item.id === id)!;
        const exposed = capability.visibility === 'exposed';
        add(
            `capability:${id}:${capability.visibility}`,
            `${skill.name}${skill.exceedsAuthority ? 'の権限逸脱' : ''}を${exposed ? '調査機関が暴露' : '公表'}`,
            exposed ? 'warning' : 'event',
        );
    }
    const fresh = incoming.filter((item) => !state.seen.has(item.id));
    if (!fresh.length) return state;
    return {
        // 同月では調査・イベントなど対応が必要な情報を先に置く。
        items: [...fresh.reverse(), ...state.items].slice(0, MAX_NOTIFICATIONS),
        seen: new Set([...state.seen, ...fresh.map((item) => item.id)]),
    };
}
