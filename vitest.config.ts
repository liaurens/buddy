import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json', 'html'],
            reportsDirectory: './coverage',
            // Measure every source file, not just the ones imported by a test,
            // so the report honestly reflects what is and isn't covered.
            all: true,
            // Focus the report on testable logic. Per CLAUDE.md, UI components
            // are intentionally not unit-tested in the MVP, so they (and other
            // non-logic files) are excluded to keep the numbers meaningful.
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'node_modules/',
                'src/test/',
                'src/**/*.{test,spec}.{ts,tsx}',
                'src/**/*.tsx', // React components & pages (not unit-tested in MVP)
                'src/**/types.ts', // type-only modules
                'src/**/types/**', // type-only modules
                'src/**/*.d.ts',
                'src/**/index.ts', // barrel re-exports
                'src/main.tsx',
                'src/constants/**', // static data tables
            ],
        },
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
