import { useEffect, useRef } from 'react';

export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const abilityText = {
    IQ: '推論・分析・問題解決',
    EQ: '感情理解・対話・共感',
    SYSTEM: '自動化・社会システム統合',
};

export function Meter({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
    return (
        <span className="meter">
            <span
                style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }}
            />
        </span>
    );
}

export function Modal({
    children,
    label,
    wide = false,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        dialog.current!.showModal();
    }, []);
    return (
        <dialog
            ref={dialog}
            className={`modal ${wide ? 'wide' : ''}`}
            aria-label={label}
            onCancel={(event) => event.preventDefault()}
        >
            {children}
        </dialog>
    );
}
