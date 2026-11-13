import { researchHasFindings, researchOverallProgress } from '../../game/secrecy/researchTargets';
import type { Investigation } from '../../game/secrecy/types';
import { ContinuousProgress, useProjectedGame } from '../ContinuousProgress';

export function ResearchProgress({
    project,
    label,
    className,
    id,
}: {
    project: Investigation;
    label: string;
    className?: string;
    id?: string;
}) {
    const nextGame = useProjectedGame();
    const next = nextGame.investigations.find((item) => item.id === project.id)!;
    if (project.kind === 'research' && researchHasFindings(project)) return null;
    return (
        <ContinuousProgress
            id={id}
            className={className}
            label={label}
            value={
                project.kind === 'research' ? researchOverallProgress(project) : project.progress
            }
            nextValue={next.kind === 'research' ? researchOverallProgress(next) : next.progress}
        />
    );
}
