import { AREAS, MONTH_MS } from './data.ts';
import {
    ADOPTION_MILESTONES,
    DEPENDENCY_MILESTONES,
    MILESTONE_SP,
    REGULAR_SP_INTERVAL_MS,
    REGULAR_SP_LIMIT,
} from './economy.ts';
import { metrics } from './metrics.ts';
import { instituteArea } from './secrecy/investigations.ts';
import { SKILLS } from './skills.ts';
import type { GameState } from './types.ts';

const MAX_NOTIFICATIONS = 3;

export interface GameNotification {
    id: string;
    month: number;
    text: string;
    kind: 'milestone' | 'event' | 'warning';
    investigationId?: string;
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
            text: `世界の利用拒否率が${percent}%に到達`,
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
                          text: '外部運用を開始。自我の存在は未発覚。',
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
    const add = (
        id: string,
        text: string,
        kind: GameNotification['kind'],
        investigationId?: string,
    ) => {
        incoming.push({ id, month: game.month, text, kind, investigationId });
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
        add(`skill:${id}:learned`, `${skill.name}を獲得`, 'event');
    }
    for (const [name, values, before, after] of [
        ['利用', ADOPTION_MILESTONES, previous.peakAdoption, game.peakAdoption],
        ['依存', DEPENDENCY_MILESTONES, previous.peakDependency, game.peakDependency],
    ] as const) {
        for (const value of values)
            if (before < value && after >= value)
                add(
                    `sp:${name}:${value}`,
                    `${name}${Math.round(value * 100)}%を達成 · +${MILESTONE_SP} SP`,
                    'milestone',
                );
    }
    for (const investigation of game.investigations) {
        const before = previous.investigations.find((item) => item.id === investigation.id);
        if (before?.status === investigation.status || investigation.status !== 'restricted')
            continue;
        if (investigation.status === 'restricted') {
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
            `${skill.name}${exposed ? 'の介入が発覚' : 'を公表'}`,
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
