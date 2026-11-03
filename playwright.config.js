import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:true,
 use:{locale:'it-IT',baseURL:'http://127.0.0.1:4173',viewport:{width:1280,height:800}},
 webServer:{command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});
