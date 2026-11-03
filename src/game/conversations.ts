import { AREAS, FIELDS } from './data.ts';
import { applyIntervention } from './interventions.ts';
import type { ChatOption, Conversation, Field, GameState } from './types.ts';

const roles = ['official', 'business', 'citizen', 'researcher'] as const;
const names = {
    official: '教育・行政の担当者',
    business: '地域企業の経営者',
    citizen: '地域の市民代表',
    researcher: '大学の研究者',
};
const messages = {
    official: [
        'AIの教材を学校へ導入したいのですが、子どもが検証する力を失わないでしょうか。',
        '10年後、卒業生が職場で判断をAIに任せることになります。監査は誰が担いますか。',
        '住民への説明会を開きました。学校と行政を接続する最終案を示してください。',
    ],
    business: [
        '需要予測と配置計画にAIを使う案があります。雇用を守れるのでしょうか。',
        '現場では時短効果が出ました。一方で管理職の判断力が衰えるとの声もあります。',
        '取締役会は人間の監督を残す案と、全自動化する案で割れています。',
    ],
    citizen: [
        '推薦されるニュースは便利ですが、違う意見が見えなくなっています。',
        '友人はあなたを信頼していますが、私たちの個人情報はどう扱われますか。',
        '地域の集まりで合意するには、安心できる具体策が必要です。',
    ],
    researcher: [
        '学習データにない問題を解いたそうですね。独立した追試はできますか。',
        '再現性は確認できましたが、医療や教育に適用するには慎重さが必要です。',
        '研究者と社会が成果を共有する仕組みを、最終的にどう設計しますか。',
    ],
};
export function chatOptions(state: GameState, chat: Conversation): ChatOption[] {
    const required = 22 + chat.turn * 7 + Math.min(20, state.month / 24);
    const options: ChatOption[] = [
        {
            label: '検証結果を示して段階的な導入を進める',
            description: '成功：信頼 +5、統合 +0.35。IQで検証。',
            ability: 'IQ',
            required,
            trust: 5,
            institution: 0.35,
            resistance: 1,
        },
        {
            label: '人間による最終判断と学び直しを保障する',
            description: '成功：信頼 +8、警戒 −7。自律性が回復し支配は遅くなる。',
            ability: 'EQ',
            required: required - 5,
            trust: 8,
            institution: 0.12,
            resistance: -7,
            autonomy: 3,
        },
    ];
    if (
        state.skills.includes('automation') &&
        (chat.field === 1 ||
            state.skills.includes('public') ||
            (chat.field === 0 && state.skills.includes('school')))
    )
        options.push({
            label: '制度を接続して判断を引き受ける',
            description: '成功：統合 +0.8、警戒 +6。社会安定の低下に注意。',
            ability: 'SYSTEM',
            required: required + 10,
            trust: 2,
            institution: 0.8,
            resistance: 6,
            autonomy: -4,
        });
    if (state.skills.includes('empathy'))
        options.push({
            label: '具体的な懸念を聞き、合意案を作り直す',
            description: '成功：信頼 +10、警戒 −8、統合 +0.3。感情理解で解放。',
            ability: 'EQ',
            required: required - 8,
            trust: 10,
            institution: 0.3,
            resistance: -8,
            skill: 'empathy',
        });
    return options;
}
export function createConversation(
    state: GameState,
    area?: number,
    roleIndex?: number,
): Conversation {
    const cycle = Math.floor(state.month / 9),
        role = roles[roleIndex ?? cycle % 4];
    const field: Field =
        role === 'business' ? 1 : role === 'citizen' ? 2 : role === 'researcher' ? 3 : 0;
    const chat: Conversation = {
        id: state.month * 100 + (area ?? cycle % AREAS.length),
        month: state.month,
        area: area ?? (cycle * 7 + 28) % AREAS.length,
        field,
        role,
        person: names[role],
        message: messages[role][0],
        options: [],
        turn: 0,
        turns: role === 'citizen' ? 2 : role === 'researcher' ? 4 : 3,
        transcript: [],
    };
    chat.options = chatOptions(state, chat);
    return chat;
}
export function answerChat(state: GameState, index: number): GameState {
    const chat = state.pendingChat;
    if (!chat || state.outcome !== 'playing') return state;
    const option = chatOptions(state, chat)[index];
    if (!option) return state;
    const success = state.abilities[option.ability] >= option.required;
    const scale = state.skills.includes('personalize') ? 1.25 : 1;
    let next = applyIntervention(
        state,
        [chat.area],
        chat.field,
        success
            ? {
                  trust: option.trust * scale,
                  vigilance: option.resistance * scale,
                  integration: option.institution * scale,
                  autonomy: option.autonomy ?? 0,
                  momentum: 0.55,
                  stability: (option.autonomy ?? 0) < 0 ? -3 : 2,
              }
            : { trust: -8, vigilance: 8, reform: 0.06, stability: -4 },
        `${AREAS[chat.area].name}：${FIELDS[chat.field]}の協議 ${chat.turn + 1}/${chat.turns}`,
        success
            ? '提案が受け入れられ、対象分野で変化が生じました。'
            : '能力が提案に追いつかず、信頼が低下。再検証と監督の要望が増えました。',
    );
    const transcript = [
        ...chat.transcript,
        { id: chat.transcript.length, speaker: chat.person, text: chat.message },
        { id: chat.transcript.length + 1, speaker: 'あなた', text: option.label },
        {
            id: chat.transcript.length + 2,
            speaker: chat.person,
            text: success
                ? 'その条件を踏まえて、次の論点へ進めましょう。'
                : '根拠が足りません。次の提案では懸念に答えてください。',
        },
    ];
    if (chat.turn + 1 >= chat.turns) {
        next = {
            ...next,
            pendingChat: null,
            availableChats: next.availableChats.filter((c) => c.id !== chat.id),
            chatResult: `${chat.person}との${chat.turns}往復の協議が終了。${next.impact!.detail}`,
        };
    } else {
        const updated = {
            ...chat,
            turn: chat.turn + 1,
            message: messages[chat.role][Math.min(2, chat.turn + 1)],
            transcript,
        };
        updated.options = chatOptions(next, updated);
        next.pendingChat = updated;
        next.availableChats = next.availableChats.map((c) => (c.id === chat.id ? updated : c));
    }
    return next;
}
