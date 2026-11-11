# UI setup verification

確認日: 2026-11-11 (Asia/Tokyo)

## セットアップ
- frontend-design: C:/Users/mocch/.codex/skills/frontend-design/SKILL.md に導入済み。
- playwright: C:/Users/mocch/.codex/skills/playwright/SKILL.md に導入済み。
- Playwright CLI: Windows版を導入し、既存Chromeで実行確認済み。
- AGENTS.md: プロジェクト直下に作成。ゲームUIの設計基準と実画像レビューを設定。
- npm ci: 起動中の当該Viteサーバーを一時停止して完了。
- npm run build: Windowsの通常の実行環境で成功。
- 開発URL: http://127.0.0.1:5173/

## 実画像の確認
以下8枚をChromeで撮影し、画像を開いて確認した。
- status-desktop.png / status-mobile.png
- tree-iq-desktop.png / tree-iq-mobile.png
- tree-eq-desktop.png / tree-eq-mobile.png
- tree-system-desktop.png / tree-system-mobile.png

Desktop: 1440x900。Mobile: 390x844。
デバッグ用research状態で、獲得済み9スキルを使用。ユーザーの通常プレイ状態は変更していない。

## 発見して修正した不具合
ゲーム停止中にCSSトランジションも停止し、非選択のIQタブに選択色が残ることを再現した。
useAnimationSpeed.tsで、操作UIのCSSTransitionは再生速度1のままにするよう修正した。
再読み込み後、選択タブの色が一致し、再生速度0のCSSTransitionが0件であることを実ブラウザーで確認した。
ステータス画面のDebug要素も非表示で、ページの横方向へのはみ出しはなかった。

## 継続して把握する点
- スマートフォン幅では全ノードが収まる一方、ツリー内の文字・タップ対象が小さい。次回のUI設計時に改善対象とする。
- favicon.icoの404が初回読み込み時にあった。確認対象の画面動作を妨げる実行時エラーはなかった。
- このチャットの起動ディレクトリとして古いC:/mnt/c/...が渡されている。実フォルダーはC:/Users/mocch/projects/kf-team-c。