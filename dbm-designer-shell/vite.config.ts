import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'dbm-contract': path.resolve(__dirname, '../dbm-contract/dist/index.js'),
      'dbm-designer-core': path.resolve(__dirname, '../dbm-designer-core/dist/index.js')
    }
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, '../dbm-app/bundle'),
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      formats: ['iife'],
      name: 'DbmDesignerShell',
      fileName: () => 'bundle.js'
    },
    rollupOptions: {
      output: {
        extend: true
      }
    }
  },
  test: {
    environment: 'jsdom'
  }
});
