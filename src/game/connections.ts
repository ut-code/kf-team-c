import { ORGANIZATION_CORRIDORS, PERSONAL_CORRIDORS } from '../content/connections.ts';
import { AREAS } from './data.ts';
import { skillScale } from './secrecy/capabilities.ts';
import type { GameState } from './types.ts';

function connections(corridors: [string, string][], organization: boolean) {
    const links: number[][] = AREAS.map((area, i) =>
        AREAS.map((other, j) =>
            i !== j && area.region === other.region ? (organization ? 0.6 : 1) : 0,
        ),
    );
    for (const [from, to] of corridors) {
        const a = AREAS.findIndex((area) => area.id === from);
        const b = AREAS.findIndex((area) => area.id === to);
        links[a][b] = organization ? 1.4 : 1;
        links[b][a] = organization ? 1.4 : 1;
    }
    return links;
}

export const PERSONAL_LINKS = connections(PERSONAL_CORRIDORS, false);
export const ORGANIZATION_LINKS = connections(ORGANIZATION_CORRIDORS, true);

export function networkUse(game: GameState, target: number, organization: boolean) {
    const weights = (organization ? ORGANIZATION_LINKS : PERSONAL_LINKS)[target];
    return (
        weights.reduce((sum, weight, i) => {
            const area = game.areas[i];
            const advocacy = game.skills.includes('mind-control')
                ? skillScale(game, 'mind-control')
                : 0;
            const source =
                area.autonomous + area.dependent * (organization ? 0.8 : 0.2 + advocacy * 0.6);
            const readiness = organization ? AREAS[i].enterprise : 1;
            return sum + weight * source * readiness;
        }, 0) /
        Math.max(
            1,
            weights.reduce((sum, weight) => sum + weight, 0),
        )
    );
}

/** 成果は公開後に徐々に伝わる。接続の薄い地域へも時間をかけて届く。 */
export function researchReach(source: number, target: number, age: number) {
    if (source === target) return 1;
    const direct = Math.max(PERSONAL_LINKS[target][source], ORGANIZATION_LINKS[target][source]);
    const local = direct > 0 ? Math.min(1, age / 12) * 0.8 : 0;
    return Math.min(1, local + Math.min(0.25, age / 240));
}
