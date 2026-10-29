import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [react(), {
    name: 'cmp-reader-license',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'licenses/jsqr-LICENSE.txt',
        source: readFileSync(new URL('./dist/vendor/jsqr-LICENSE.txt', import.meta.url), 'utf8') });
    },
  }],
  define: {
    __ODOO_DB__: JSON.stringify(process.env.CMP_ODOO_DB || 'cmpslu'),
  },
  build: { outDir: 'build', emptyOutDir: true },
  server: {
    proxy: {
      '^/api/cmp_pallets/(lookup|associate)$': {
        target: process.env.CMP_ODOO_TARGET || 'http://127.0.0.1:16069',
        changeOrigin: false,
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '^/api/session/prepare$': {
        target: process.env.CMP_ODOO_TARGET || 'http://127.0.0.1:16069',
        changeOrigin: false,
        rewrite: () => '/web/login?db=' + encodeURIComponent(process.env.CMP_ODOO_DB || 'cmpslu'),
      },
      '^/api/(cmp_pallets/access/(bootstrap|unlock|setup_pin|profile|lock)|web/session/(authenticate|destroy))$': {
        target: process.env.CMP_ODOO_TARGET || 'http://127.0.0.1:16069',
        changeOrigin: false,
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
