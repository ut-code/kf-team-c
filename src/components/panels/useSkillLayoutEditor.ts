import { useMemo, useState } from 'react';
import { SAVED_SKILL_POSITIONS, skillLayout, type TreePoint } from '../../game/skillLayout';

let savedPositions = SAVED_SKILL_POSITIONS;

export function useSkillLayoutEditor() {
    const [positions, setPositions] = useState(() => savedPositions);
    const [editing, setEditing] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const tree = useMemo(() => skillLayout(positions), [positions]);

    const move = (id: string, point: TreePoint) => {
        setPositions((current) => ({
            ...current,
            [id]: { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 },
        }));
        setDirty(true);
        setError('');
    };
    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await fetch('/__debug/skill-positions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(positions),
            });
            if (!response.ok) throw new Error(`保存に失敗しました（HTTP ${response.status}）`);
            savedPositions = positions;
            setDirty(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : '配置を保存できませんでした');
        } finally {
            setSaving(false);
        }
    };
    return {
        tree,
        editing: import.meta.env.DEV && editing,
        setEditing,
        dirty,
        saving,
        error,
        move,
        save,
    };
}
