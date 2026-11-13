import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { skillLayoutEditor } from './scripts/skill-layout-editor.ts';

export default defineConfig({
    plugins: [react(), skillLayoutEditor()],
    // 試作品や検証用プロファイルを依存関係の走査対象に含めない。
    optimizeDeps: { entries: ['index.html'] },
});
