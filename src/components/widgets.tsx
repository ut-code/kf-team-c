import { useLayoutEffect, useRef } from 'react';

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
    closeOnEscape = true,
    anchor,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
    className?: string;
    onClose?: () => void;
    modal?: boolean;
    closeOnEscape?: boolean;
    anchor?: { x: number; y: number };
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useLayoutEffect(() => {
        const element = dialog.current!;
        if (modal) element.showModal();
        else element.show();
        return () => element.close();
    }, [modal]);
    useLayoutEffect(() => {
        if (modal || !anchor) return;
        const element = dialog.current!;
        const position = () => {
            if (
                window.matchMedia('(max-width: 700px), (max-height: 500px) and (pointer: coarse)')
                    .matches
            ) {
                element.style.removeProperty('left');
                element.style.removeProperty('top');
                return;
            }
            const { width, height } = element.getBoundingClientRect();
            const margin = 18;
            const gap = 28;
            const right = anchor.x + gap;
            const left = anchor.x - gap - width;
            const preferred = right + width <= window.innerWidth - margin ? right : left;
            element.style.left = `${Math.max(margin, Math.min(window.innerWidth - width - margin, preferred))}px`;
            element.style.top = `${Math.max(margin, Math.min(window.innerHeight - height - margin, anchor.y - 32))}px`;
        };
        position();
        const observer = new ResizeObserver(position);
        observer.observe(element);
        window.addEventListener('resize', position);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
        };
    }, [modal, anchor]);
    return (
        <dialog
            ref={dialog}
            className={`modal ${wide ? 'wide' : ''} ${modal ? '' : 'floating'} ${className}`}
            aria-label={label}
            onCancel={(event) => {
                event.preventDefault();
                if (closeOnEscape) onClose?.();
            }}
        >
            {children}
        </dialog>
    );
}
