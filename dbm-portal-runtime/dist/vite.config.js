import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
        alias: {
            react: path.resolve(__dirname, 'node_modules/react'),
            'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
            'dbm-contract': path.resolve(__dirname, '../dbm-contract/dist/index.js'),
            'dbm-process-experience': path.resolve(__dirname, '../dbm-process-experience/dist/src/index.js')
        }
    },
    build: {
        emptyOutDir: false,
        outDir: path.resolve(__dirname, 'dist/browser'),
        lib: {
            entry: path.resolve(__dirname, 'src/browser-entry.ts'),
            formats: ['iife'],
            name: 'DbmPortalRuntime',
            fileName: () => 'portal-runtime.js'
        },
        rollupOptions: {
            output: {
                extend: true
            }
        }
    },
    test: {
        environment: 'jsdom',
        exclude: ['dist/**', 'node_modules/**']
    }
}));
