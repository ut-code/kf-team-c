import { type RefObject, useLayoutEffect } from 'react';

/** CSSの演出も再生位置を保ったままゲーム速度へ追従させる。 */
export function useAnimationSpeed(root: RefObject<HTMLElement | null>, speed: number) {
    useLayoutEffect(() => {
        const element = root.current!;
        const synchronize = () => {
            for (const animation of element.getAnimations({ subtree: true })) {
                const target = (animation.effect as KeyframeEffect).target;
                if (!(target instanceof Element)) continue;
                // 地図はパネル表示などによるゲームの一時停止にも従う。
                const scope = target.closest<HTMLElement>('[data-animation-speed]');
                const rate = scope ? Number(scope.dataset.animationSpeed) : speed;
                if (animation.playbackRate !== rate) animation.playbackRate = rate;
            }
        };
        synchronize();
        const observer = new MutationObserver(synchronize);
        observer.observe(element, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-animation-speed'],
        });
        element.addEventListener('animationstart', synchronize);
        element.addEventListener('transitionrun', synchronize);
        return () => {
            observer.disconnect();
            element.removeEventListener('animationstart', synchronize);
            element.removeEventListener('transitionrun', synchronize);
        };
    }, [root, speed]);
}
