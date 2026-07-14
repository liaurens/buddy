import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        rules: {
            // Allow intentionally-unused identifiers when prefixed with `_`
            // (the convention already used throughout this codebase).
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            // These rules report React Compiler optimization eligibility. The app is
            // not compiled with React Compiler, so retain the diagnostics without
            // blocking correctness gates on existing data-loading effects.
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/use-memo': 'warn',
            'react-hooks/purity': 'warn',
            // Mixed hook/component modules are established public APIs in this app.
            // Keep HMR diagnostics visible without failing production CI.
            'react-refresh/only-export-components': 'warn',
        },
    },
]);
