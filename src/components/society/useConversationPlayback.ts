import { useEffect, useState } from 'react';
import type { ConversationMessage } from '../../game/society/types';

// 会話演出の調整はここで行う。ゲーム内の時間・効果には影響しない。
const TEXT_INTERVAL_MS = 28;
const CHARACTERS_PER_TICK = 2;
const HUMAN_REPLY_DELAY_MS = 1400;
const RESULT_DELAY_MS = 300;

export function useConversationPlayback(messages: ConversationMessage[]) {
    // 開き直したときは履歴を再生せず、新しく追加された発言だけを演出する。
    const [playback, setPlayback] = useState({ count: messages.length, characters: 0 });
    const [reducedMotion] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const current = messages[playback.count];
    const characters = Array.from(current?.text ?? '');
    const currentId = current?.id;
    const currentRole = current?.role;
    const characterCount = characters.length;

    useEffect(() => {
        if (!currentId) return;
        const complete = () => setPlayback((value) => ({ count: value.count + 1, characters: 0 }));
        if (currentRole === 'player' && !reducedMotion) {
            const timer = window.setInterval(() => {
                setPlayback((value) => {
                    const next = value.characters + CHARACTERS_PER_TICK;
                    if (next >= characterCount) {
                        return { count: value.count + 1, characters: 0 };
                    }
                    return { ...value, characters: next };
                });
            }, TEXT_INTERVAL_MS);
            return () => window.clearInterval(timer);
        }
        const delay =
            currentRole === 'contact'
                ? HUMAN_REPLY_DELAY_MS
                : currentRole === 'system'
                  ? RESULT_DELAY_MS
                  : 0;
        const timer = window.setTimeout(complete, delay);
        return () => window.clearTimeout(timer);
    }, [currentId, currentRole, characterCount, reducedMotion]);

    return {
        messages: messages.slice(0, playback.count),
        streamingMessage: current?.role === 'player' ? current : null,
        streamingText: characters.slice(0, playback.characters).join(''),
        waitingForContact: current?.role === 'contact',
        busy: current !== undefined,
    };
}
