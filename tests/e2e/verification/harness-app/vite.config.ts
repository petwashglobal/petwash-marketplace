import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Standalone build for the verification browser harness. Deliberately separate
 * from the product's vite.config.ts so it cannot affect the shipped bundle:
 * no manualChunks, no prerender, no plugins beyond React.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../../client/src'),
      '@shared': path.resolve(__dirname, '../../../../shared'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../../../dist-verification-harness'),
    emptyOutDir: true,
  },
});
