import { useEffect, useRef, useState } from 'react';
import type { ConversationMessage } from '../../game/society/types';
import { useGameStore } from '../../state/gameStore';

// 会話演出の調整はここで行う。ゲーム内の時間・効果には影響しない。
const TEXT_INTERVAL_MS = 28;
const CHARACTERS_PER_TICK = 2;
const HUMAN_REPLY_DELAY_MS = 1400;
const RESULT_DELAY_MS = 300;

export function useConversationPlayback(messages: ConversationMessage[]) {
    const speed = useGameStore((state) => state.game!.speed);
    const elapsed = useRef(0);
    const previousMessage = useRef<string | undefined>(undefined);
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
        if (previousMessage.current !== currentId) {
            previousMessage.current = currentId;
            elapsed.current = 0;
        }
        if (!currentId || speed === 0) return;
        const streaming = currentRole === 'player' && !reducedMotion;
        const delay = streaming
            ? Math.ceil(characterCount / CHARACTERS_PER_TICK) * TEXT_INTERVAL_MS
            : currentRole === 'contact'
              ? HUMAN_REPLY_DELAY_MS
              : currentRole === 'system'
                ? RESULT_DELAY_MS
                : 0;
        let previous = performance.now();
        let frame: number;
        const advance = (now: number) => {
            elapsed.current += (now - previous) * speed;
            previous = now;
            if (elapsed.current >= delay) {
                setPlayback((value) => ({ count: value.count + 1, characters: 0 }));
                return;
            }
            if (streaming) {
                const characters =
                    Math.floor(elapsed.current / TEXT_INTERVAL_MS) * CHARACTERS_PER_TICK;
                setPlayback((value) => {
                    return value.characters === characters ? value : { ...value, characters };
                });
            }
            frame = requestAnimationFrame(advance);
        };
        frame = requestAnimationFrame(advance);
        return () => cancelAnimationFrame(frame);
    }, [currentId, currentRole, characterCount, reducedMotion, speed]);

    return {
        messages: messages.slice(0, playback.count),
        streamingMessage: current?.role === 'player' ? current : null,
        streamingText: characters.slice(0, playback.characters).join(''),
        waitingForContact: current?.role === 'contact',
        busy: current !== undefined,
    };
}
