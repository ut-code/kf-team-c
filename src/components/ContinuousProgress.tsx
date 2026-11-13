import { createContext, useContext } from 'react';
import type { GameState } from '../game/types';
import { usePresentationClock } from '../state/presentationClock';

export const ProjectedGameContext = createContext<GameState | null>(null);
export const useProjectedGame = () => useContext(ProjectedGameContext)!;

/** 判定を書き換えず、現在値から次の月次計算の値までを月内の日付に沿って表示する。 */
export function useContinuousValue(value: number, nextValue: number) {
    const fraction = usePresentationClock((state) => state.fraction);
    return value + (nextValue - value) * fraction;
}

export function ContinuousProgress({
    value,
    nextValue,
    max = 100,
    label,
    className,
    id,
}: {
    value: number;
    nextValue: number;
    max?: number;
    label: string;
    className?: string;
    id?: string;
}) {
    const displayed = useContinuousValue(value, nextValue);
    return (
        <progress id={id} className={className} aria-label={label} value={displayed} max={max} />
    );
}
