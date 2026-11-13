import { useLayoutEffect, useRef } from 'react';
import { type MapLocation, useMapAnchor } from './useMapAnchor';

const populationFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
export const population = (millions: number) =>
    `${populationFormatter.format(Math.max(0, millions) * 1_000_000)}人`;
export { percentage as percent } from '../game/metrics';
export function Modal({
    children,
    label,
    wide = false,
    className = '',
    onClose,
    modal = true,
    closeOnEscape = true,
    mapLocation,
}: {
    children: React.ReactNode;
    label: string;
    wide?: boolean;
    className?: string;
    onClose?: () => void;
    modal?: boolean;
    closeOnEscape?: boolean;
    mapLocation?: MapLocation;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useLayoutEffect(() => {
        const element = dialog.current!;
        if (modal) element.showModal();
        else element.show();
        return () => element.close();
    }, [modal]);
    useMapAnchor(dialog, mapLocation);
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
