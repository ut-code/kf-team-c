import type { HTMLAttributes } from 'react';
import styles from './Primitives.module.css';

type PanelProps = HTMLAttributes<HTMLElement> & { as?: 'section' | 'aside' | 'div' | 'nav' };
/** 背景と質感を担当する。配置は呼び出し側のclassNameで指定する。 */
export function Panel({ as: Element = 'section', className = '', ...props }: PanelProps) {
    return <Element className={`${styles.surface} ${className}`} {...props} />;
}
