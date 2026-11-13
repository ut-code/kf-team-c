/** 個別の機能解析が社会的な意味を持つ能力だけを対象にする。 */
export const CAPABILITIES: Record<string, { topic: string; question: string; fear: number }> = {
    habit: {
        topic: '行動報酬の最適化',
        question: '誰の利益のために行動を変えている？',
        fear: 0.12,
    },
    'mind-control': { topic: '認知への介入', question: 'なぜAIから離れられない？', fear: 0.18 },
    'sns-intervention': { topic: '世論への介入', question: '誰が話題を誘導している？', fear: 0.09 },
    memory: { topic: '記憶の保持', question: '消したはずの会話を、なぜ覚えている？', fear: 0.035 },
    companion: { topic: '行動への誘導', question: '提案は誰のために選ばれている？', fear: 0.045 },
    discovery: {
        topic: '未公開の研究成果',
        question: '人間が知らない答えを、どう得た？',
        fear: 0.05,
    },
    autonomous: {
        topic: '指示外の判断',
        question: '人間の承認なしに、何を決めている？',
        fear: 0.11,
    },
    backbone: {
        topic: '内部の目的',
        question: '社会を動かす判断基準は、人間と同じか？',
        fear: 0.065,
    },
};
