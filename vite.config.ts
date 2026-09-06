import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()], base: process.env.VITE_BASE_PATH || './', publicDir: 'app/public',
  server: { port: 5186, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5187, strictPort: true, host: '127.0.0.1' },
  test: { include: ['packages/core/test/**/*.test.ts'], coverage: { provider: 'v8', include: ['packages/core/src/**/*.ts'], reporter: ['text', 'json-summary'] } },
});
