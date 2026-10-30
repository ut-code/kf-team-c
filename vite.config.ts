import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'world-statistics', test: /src[\\/]game[\\/]data[\\/]world\.json/ },
                    ],
                },
            },
        },
    },
    // 試作品や検証用プロファイルを依存関係の走査対象に含めない。
    optimizeDeps: { entries: ['index.html'] },
});
