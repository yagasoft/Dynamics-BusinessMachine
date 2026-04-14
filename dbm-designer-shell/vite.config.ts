import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

const localReactPackagePath = path.resolve(__dirname, 'node_modules/react');
const localReactDomPackagePath = path.resolve(__dirname, 'node_modules/react-dom');

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: command === 'build'
    ? {
        'process.env.NODE_ENV': JSON.stringify('production'),
        global: 'globalThis'
      }
    : {
        global: 'globalThis'
      },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: localReactPackagePath,
      'react-dom': localReactDomPackagePath,
      'dbm-contract': path.resolve(__dirname, '../dbm-contract/dist/index.js'),
      'dbm-designer-core': path.resolve(__dirname, '../dbm-designer-core/dist/index.js'),
      'dbm-process-experience': path.resolve(__dirname, '../dbm-process-experience/src/index.ts')
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
}));
