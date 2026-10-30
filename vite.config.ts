import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    // 試作品や検証用プロファイルを依存関係の走査対象に含めない。
    optimizeDeps: { entries: ['index.html'] },
});
