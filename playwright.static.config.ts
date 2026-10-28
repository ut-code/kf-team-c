import { defineConfig } from '@playwright/test';

// ビルド済みの地図をリクエスト差し替えで読み込む操作テスト。
export default defineConfig({ testDir: './tests/browser', testMatch: 'zoom.spec.ts', workers: 1 });
