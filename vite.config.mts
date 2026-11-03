import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const target = process.env.CMP_ODOO_URL || process.env.CMP_ODOO_TARGET || 'http://127.0.0.1:16069';
const backend = new URL(target);
const proxyIdentity = backend.protocol === 'https:' ? { changeOrigin: true, secure: true,
  headers: { Origin: backend.origin, 'X-Forwarded-Host': backend.host, 'X-Forwarded-Proto': 'https' } } : { changeOrigin: false };

export default defineConfig({
  plugins: [react(), {
    name: 'cmp-reader-license',
    transformIndexHtml: { order: 'post', handler: () => [{ tag: 'script', attrs: { src: '/runtime-config.js' }, injectTo: 'head-prepend' }] },
    configureServer(server) {
      server.middlewares.use('/runtime-config.js', (_request, response) => {
        response.setHeader('Content-Type', 'application/javascript');
        response.setHeader('Cache-Control', 'no-store');
        response.end('window.CMP_CONFIG = ' + JSON.stringify({ database: process.env.CMP_ODOO_DB || 'cmpslu',
          backend: backend.origin, appOrigin: process.env.CMP_APP_URL || 'http://127.0.0.1:4184' }) + ';');
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'licenses/jsqr-LICENSE.txt',
        source: readFileSync(new URL('./dist/vendor/jsqr-LICENSE.txt', import.meta.url), 'utf8') });
    },
  }],
  build: { outDir: 'build', emptyOutDir: true },
  server: {
    proxy: {
      '^/api/cmp_pallets/(lookup|associate|move|create|label|locations)$': {
        target, ...proxyIdentity,
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '^/api/session/prepare$': {
        target, ...proxyIdentity,
        rewrite: () => '/web/login?db=' + encodeURIComponent(process.env.CMP_ODOO_DB || 'cmpslu'),
      },
      '^/api/(cmp_pallets/access/(bootstrap|unlock|setup_pin|profile|lock)|web/session/(authenticate|destroy))$': {
        target, ...proxyIdentity,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
