import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasmPlugin from 'vite-plugin-wasm';
import path from 'path';
import { latexCompilerPlugin } from './latexCompilerPlugin';

export default defineConfig({
  plugins: [latexCompilerPlugin(), wasmPlugin(), react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@tupan/core-rust'],
  },
  worker: {
    format: 'es',
  },
});
