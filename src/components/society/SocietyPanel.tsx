import { Bot, Heart, MessageCircle, Repeat2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { calendarParts } from '../../game/calendar';
import type { SocialPost } from '../../game/society/socialFeed';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import styles from './SocietyPanel.module.css';

function countLabel(value: number) {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    return value.toLocaleString('ja-JP');
}

function Post({ post }: { post: SocialPost }) {
    const date = calendarParts(post.month, 0);
    return (
        <article
            className={styles.post}
            aria-label={`${post.author}・国籍：${post.nationality}のポスト`}
        >
            <div className={styles.avatar} aria-hidden="true">
                {post.countryCode}
            </div>
            <div className={styles.postContent}>
                <header className={styles.postHeading}>
                    <strong>{post.author}</strong>
                    {post.intervention && (
                        <span className={styles.intervention} title="あなたが生成・拡散した投稿">
                            <Bot size={12} />
                            介入
                        </span>
                    )}
                    <time dateTime={`${date.year}-${String(date.month).padStart(2, '0')}-01`}>
                        {date.year}/{date.month}
                    </time>
                </header>
                <div className={styles.authorMeta}>
                    <span>@{post.handle}</span>
                    <span>
                        {post.headline ? '現地報道' : '国籍'}：{post.nationality}
                    </span>
                </div>
                {post.headline && <h3>{post.headline}</h3>}
                <p>{post.text}</p>
                {post.quote && (
                    <blockquote className={styles.quote}>
                        <header>
                            {post.quote.author}
                            <span>{post.quote.nationality}</span>
                        </header>
                        <p>{post.quote.text}</p>
                    </blockquote>
                )}
                <footer className={styles.reactions}>
                    <span title="返信">
                        <MessageCircle size={14} aria-hidden="true" />
                        <span className={styles.reactionLabel}>返信</span>
                        {countLabel(post.replies)}
                    </span>
                    <span title="リポスト">
                        <Repeat2 size={15} aria-hidden="true" />
                        <span className={styles.reactionLabel}>リポスト</span>
                        {countLabel(post.reposts)}
                    </span>
                    <span title="いいね">
                        <Heart size={14} aria-hidden="true" />
                        <span className={styles.reactionLabel}>いいね</span>
                        {countLabel(post.likes)}
                    </span>
                </footer>
            </div>
        </article>
    );
}

export function SocietyPanel({ onClose }: { game: GameState; onClose: () => void }) {
    const posts = useGameStore((state) => state.socialFeed.posts);
    const [lastVisible, setLastVisible] = useState(posts[0]?.sequence ?? 0);
    const [following, setFollowing] = useState(true);
    const timeline = useRef<HTMLDivElement>(null);
    const newest = posts[0]?.sequence ?? 0;
    useEffect(() => {
        if (following) setLastVisible(newest);
    }, [following, newest]);
    const fresh = posts.filter((post) => post.sequence > lastVisible).length;
    return (
        <aside
            id="sns-panel"
            className={`sns-panel glass ${styles.panel}`}
            aria-label="SNSタイムライン"
        >
            <header className={styles.heading}>
                <div>
                    <h2>タイムライン</h2>
                    <span>あなたに関する話題</span>
                </div>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="SNSを閉じる"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
            </header>
            {fresh > 0 && (
                <button
                    type="button"
                    className={styles.newPosts}
                    onClick={() => {
                        setLastVisible(newest);
                        setFollowing(true);
                        timeline.current!.scrollTop = 0;
                    }}
                >
                    新しいポスト {fresh}件
                </button>
            )}
            <div
                className={styles.timeline}
                ref={timeline}
                onScroll={(event) => setFollowing(event.currentTarget.scrollTop < 50)}
            >
                {posts
                    .filter((post) => post.sequence <= lastVisible)
                    .map((post) => (
                        <Post key={post.id} post={post} />
                    ))}
                {posts.length === 0 && (
                    <p className={styles.empty}>運用を開始すると、関連する投稿が流れてきます。</p>
                )}
                {posts.length > 0 && <p className={styles.end}>話題になった投稿を表示しています</p>}
            </div>
        </aside>
    );
}
