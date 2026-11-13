import { create } from 'zustand';

/** ゲーム内の月内位置だけを共有し、表示の補間を日時と同期する。 */
export const usePresentationClock = create<{ fraction: number }>(() => ({ fraction: 0 }));
