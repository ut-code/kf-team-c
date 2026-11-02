import { X } from 'lucide-react';

export function ChatResult({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div className="chat-result glass" role="status">
            <p>{message}</p>
            <button type="button" aria-label="会話結果を閉じる" onClick={onDismiss}>
                <X size={15} />
            </button>
        </div>
    );
}
