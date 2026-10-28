import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:5188', viewport: { width: 1440, height: 900 } },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort',
        url: 'http://127.0.0.1:5188',
        reuseExistingServer: true,
    },
});
