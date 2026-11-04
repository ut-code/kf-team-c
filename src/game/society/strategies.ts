import { SOCIAL_STRATEGIES } from '../../content/strategies.ts';
import type { SocialStrategy } from './types.ts';

export { SOCIAL_STRATEGIES, STRATEGY_SWITCH_COST } from '../../content/strategies.ts';

export function socialStrategy(id: string): SocialStrategy {
    return SOCIAL_STRATEGIES.find((strategy) => strategy.id === id)!;
}
