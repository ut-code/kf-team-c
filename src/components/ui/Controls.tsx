import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import styles from './Primitives.module.css';

type ButtonProps = ComponentProps<'button'> & { variant?: 'default' | 'quiet' };
export function Button({
    variant = 'default',
    className = '',
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={`${styles.button} ${variant === 'quiet' ? styles.quiet : ''} ${className}`}
            {...props}
        />
    );
}

type IconButtonProps = Omit<ButtonProps, 'children'> & {
    icon: LucideIcon;
    label: string;
    tone?: 'normal' | 'accent';
};
export function IconButton({
    icon: Icon,
    label,
    tone = 'normal',
    className = '',
    ...props
}: IconButtonProps) {
    return (
        <Button
            variant="quiet"
            aria-label={label}
            title={label}
            className={`${styles.iconButton} ${tone === 'accent' ? styles.accent : ''} ${className}`}
            {...props}
        >
            <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
        </Button>
    );
}
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
    return <input className={`${styles.field} ${className}`} {...props} />;
}
export function Select({ className = '', ...props }: ComponentProps<'select'>) {
    return <select className={`${styles.field} ${className}`} {...props} />;
}
