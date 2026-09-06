import { defineConfig } from 'vite';
export default defineConfig({ build: { emptyOutDir: false, lib: { entry: 'packages/core/src/index.ts', formats: ['es'], fileName: () => 'twosided-core.js' } } });
