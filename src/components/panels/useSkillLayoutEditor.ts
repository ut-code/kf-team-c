import { useEffect, useMemo, useState } from 'react';
import {
    SAVED_SKILL_POSITIONS,
    type SkillPositions,
    skillLayout,
    type TreePoint,
} from '../../game/skillLayout';
import { parseSkillPositions } from '../../game/skillLayoutPositions';

let savedPositions = SAVED_SKILL_POSITIONS;

export function useSkillLayoutEditor() {
    const [positions, setPositions] = useState(() => savedPositions);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(import.meta.env.DEV);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const tree = useMemo(() => skillLayout(positions), [positions]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        let cancelled = false;
        async function load() {
            try {
                const response = await fetch('/__debug/skill-positions');
                const latest = await readPositions(response);
                if (cancelled) return;
                savedPositions = latest;
                setPositions(latest);
            } catch (error) {
                if (!cancelled) setError(String(error));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

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
            const latest = await readPositions(response);
            savedPositions = latest;
            setPositions(latest);
            setDirty(false);
        } catch (error) {
            setError(String(error));
        } finally {
            setSaving(false);
        }
    };
    return {
        tree,
        editing: import.meta.env.DEV && editing,
        setEditing,
        loading,
        dirty,
        saving,
        error,
        move,
        save,
    };
}

async function readPositions(response: Response): Promise<SkillPositions> {
    if (!response.ok)
        throw new Error(`配置データの取得・保存に失敗しました（HTTP ${response.status}）`);
    const positions = parseSkillPositions(
        await response.json(),
        Object.keys(SAVED_SKILL_POSITIONS),
    );
    if (!positions) throw new Error('配置データの座標が不正です');
    return positions;
}
