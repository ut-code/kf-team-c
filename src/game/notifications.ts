import { AREAS, DEFEAT_OPPOSITION } from './data.ts';
import { metrics } from './metrics.ts';
import { instituteArea } from './secrecy/investigations.ts';
import { researchTopic } from './secrecy/research.ts';
import { SKILLS } from './skills.ts';
import { encounterDefinition } from './society/system.ts';
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
    const check = (id: string, label: string, value: number, kind: GameNotification['kind']) => {
        for (const percent of [25, 50, 75, 100]) {
            if (value + 1e-9 < percent / 100) break;
            notifications.push({
                id: `${id}:${percent}`,
                month: game.month,
                text: `${label}が${percent}%に到達`,
                kind,
            });
        }
    };
    game.areas.forEach((area, index) => {
        check(
            `area:${index}:adoption`,
            `${AREAS[index].name}のAI普及率`,
            area.autonomous + area.dependent,
            'milestone',
        );
        check(
            `area:${index}:dependent`,
            `${AREAS[index].name}のAI依存率`,
            area.dependent,
            'milestone',
        );
    });
    const world = metrics(game);
    for (const percent of [25, 40]) {
        if (world.antiAI + 1e-9 < percent / 100) continue;
        notifications.push({
            id: `world:opposition:${percent}`,
            month: game.month,
            text: `世界の反AI率が${percent}%に到達（${DEFEAT_OPPOSITION * 100}%で敗北）`,
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
    for (const encounter of game.encounters) {
        const before = previous.encounters.find((item) => item.id === encounter.id);
        const definition = encounterDefinition(encounter.id)!;
        if (before && before.status !== encounter.status && encounter.status === 'expired') {
            add(
                `encounter:${encounter.id}:expired`,
                `対応期限切れ：${definition.title}`,
                'warning',
            );
        }
    }
    for (const investigation of game.investigations) {
        const before = previous.investigations.find((item) => item.id === investigation.id);
        if (before?.status === investigation.status || investigation.status === 'active') continue;
        if (investigation.kind === 'research' && investigation.status === 'published') {
            add(
                `investigation:${investigation.id}:published`,
                `「${researchTopic(investigation).name}」が公表された`,
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
