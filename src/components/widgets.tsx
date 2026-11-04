import { useEffect, useRef } from 'react';

const populationFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
export const population = (millions: number) =>
    `${populationFormatter.format(Math.max(0, millions) * 1_000_000)}人`;
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export function Modal({
    children,
    label,
    wide = false,
    className = '',
    onClose,
    modal = true,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
    className?: string;
    onClose?: () => void;
    modal?: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current!;
        if (modal) element.showModal();
        else element.show();
        return () => element.close();
    }, [modal]);
    return (
        <dialog
            ref={dialog}
            className={`modal ${wide ? 'wide' : ''} ${modal ? '' : 'floating'} ${className}`}
            aria-label={label}
            onCancel={(event) => {
                event.preventDefault();
                onClose?.();
            }}
        >
            {children}
        </dialog>
    );
}
