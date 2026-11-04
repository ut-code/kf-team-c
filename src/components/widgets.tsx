import { useEffect, useRef } from 'react';
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export function Modal({
    children,
    label,
    wide = false,
    className = '',
    onClose,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
    className?: string;
    onClose?: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        dialog.current!.showModal();
    }, []);
    return (
        <dialog
            ref={dialog}
            className={`modal ${wide ? 'wide' : ''} ${className}`}
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
