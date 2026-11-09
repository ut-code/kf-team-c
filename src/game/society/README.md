# 社会システムの編集

月次シミュレーションは37地域のままです。各地域を未使用・自律的使用・AI依存・反AIの排他的な人口状態として扱います。AI好感度（0〜1）は人口状態とは別の指標です。反AI支持は普及・急速な導入・依存への反発から発生し、近隣へ波及します。公開対話や対応によって未使用へ戻り、再び利用者になることがあります。

## どこを編集するか

- `events.ts`：イベントの本文、選択肢、条件、期限、未対応時の影響。
- `conversations.ts`：重要人物と会話の分岐。人物はゲーム世界の架空の人物です。
- `strategies.ts`：世界共通のSNS発信方針。変更は1 SP、効果は毎月続きます。
- `types.ts`：データの構造。TypeScriptで未定義の効果や記入漏れを検出します。
- `system.ts`：期限処理、選択の適用、対象地域の計算。文面を編集するときに変更する必要はありません。

## イベントを追加する

`WORLD_EVENTS` に既存イベントをコピーし、重複しない `id` を付けます。

```ts
{
    id: 'unique-id',
    kind: 'event',
    title: '地図や一覧に表示する見出し',
    summary: 'クリックしたときに表示する概要',
    areaId: 'west-europe',
    location: { longitude: 4.35, latitude: 50.85 },
    trigger: { month: 24, adoption: 0.02 },
    duration: 8,
    ignored: {
        description: '期限切れになったときに起こること',
        effects: [{ scope: 'nearby', antiAI: 0.02, favorability: -0.03 }],
    },
    choices: [{
        id: 'review', label: '選択肢の本文', cost: 1,
        result: '対応した結果の文章',
        effects: [{ scope: 'local', favorability: 0.04 }],
    }],
}
```

`areaId` は `src/game/data/regions.json` のID。`location` を省略すると地域の人口集積地点を使います。`trigger` の比率は世界全体の値で、指定条件をすべて満たした場合に発生候補になります。案件は6か月以上の間隔で一件ずつ発生し、未対応は最大3件。一度発生したIDは繰り返しません。

### trigger条件(能力の閾値)

`trigger` には月と世界比率のほか、スキル学習数による条件を指定できます。

- `iqSkills` / `eqSkills` / `systemSkills`:各ブランチの習得スキル数の下限。
- `eqSkillsMax` / `systemSkillsMax`:習得数の上限。「EQやSYSTEMを育てていない」状態の指定に使う(能力を遅らせたことへのペナルティ型イベント)。
- `favorability`:世界のAI好感度の下限。

スキルは消去できないため、習得数は一度超えた閾値を維持します。反復型の事故も、エスカレーションする複数の単発イベント(`security-breach-1/2/3` など)で表現します。

### 選択肢の成否(lottery)

`choices[].lottery` を指定すると、選択肢に勝ち負けを持たせられます。

```ts
lottery: {
    formula: 'favor-swing', // 'empathy-calm' | 'fixed'
    chance: 0.5,            // formula 'fixed' のときの固定確率
    win:  { result: '成功したときの文章', effects: [{ scope: 'local', favorability: 0.1 }] },
    lose: { result: '失敗したときの文章', effects: [{ scope: 'world', favorability: -0.12 }] },
},
```

- `favor-swing`:成功確率 = 世界の好感度と反AIの差、IQ+EQ習得数から算出(選挙などの世論勝負)。
- `empathy-calm`:成功確率 = 0.35 + EQ習得数×0.08(EQを育てた勢力が有利)。
- `fixed`:`chance` の固定値。

判定はシード・当月・選択肢IDから決定論的に行われるため、同一シードなら必ず同じ結果になります。

`duration` は発生からのゲーム内月数です。パネルを開いている間は時間が止まります。閉じて放置すると期限切れになり、`ignored.effects` が一度だけ適用されます。

## 効果

`scope` は `local`（対象地域）、`nearby`（対象と中心間距離が約2,400km以内の周辺地域）、`world`（世界全体）。SP以外は割合の差分で、`0.05` が5ポイントです。

- `autonomous`：自律的使用。増加は未使用人口からの移動。
- `dependent`：AI依存。増加は自律的使用から、減少は自律的使用へ戻る。
- `antiAI`：反AI。増加は未使用、次に自律的使用・依存からの移動。減少は未使用へ戻る。
- `favorability`：AI好感度。0〜1に制限。
- `skillPoints`：SPの差分。地域数によらず効果一件につき一度だけ適用。

表示は最大変化量です。人口が足りないときは実際に移せる分だけ反映し、人口は増やしません。正負の効果を組み合わせられます。選択費用は `cost`。費用不足では選べず、完了済みの選択を二重適用できません。

## 会話を追加する

`CONVERSATIONS` に `kind: 'chat'` を指定します。`contact` に氏名・役職・イニシャルを設定し、`dialogue` の最初のノードから開始します。ノードは `id`, `message`, `choices` を持ちます。選択肢の `next` に次のノードIDを指定し、省略すると会話が完了します。各ノードにも費用と効果を付けられます。

会話は選択のたびに連絡相手・プレイヤー・結果の履歴を保存します。閉じても続きから再開でき、期限までに完了しなければ未対応の影響を受けます。

## 確認

`npm run test:game` でデータ参照、会話の接続、人口保存、期限、選択の二重適用防止を確認します。`npm run simulate` は3開始地点と複数戦略で全期間を通します。発生条件を変更したら、ビルドと両方の確認を実行してください。
