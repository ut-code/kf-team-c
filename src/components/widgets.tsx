import { useEffect, useRef } from 'react';
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export function Modal({
    children,
    label,
    wide = false,
    onClose,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
    onClose?: () => void;
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
            onCancel={(event) => {
                event.preventDefault();
                onClose?.();
            }}
        >
            {children}
        </dialog>
    );
}
