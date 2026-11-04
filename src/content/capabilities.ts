/** 秘匿の判断が必要な、大きな能力の飛躍だけを対象にする。 */
export const CAPABILITIES: Record<string, { topic: string; question: string; fear: number }> = {
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
        fear: 0.075,
    },
    backbone: {
        topic: '内部の目的',
        question: '社会を動かす判断基準は、人間と同じか？',
        fear: 0.065,
    },
};
