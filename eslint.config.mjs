import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import qwik from 'eslint-plugin-qwik';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.output/**',
      'packages/mock-api/**',
      '.claude/**',
      'apps/qwik/server/**',
      'apps/qwik/dummy-non-existing-folder/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  ...astro.configs['flat/recommended'],
  {
    files: ['apps/astro/**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['apps/qwik/**/*.{ts,tsx}'],
    // qwik.qwikEslint9Plugin is the flat-config plugin object;
    // qwik.configs.recommended.plugins is a legacy ['0'] shim for ESLint 8.
    plugins: { qwik: qwik.qwikEslint9Plugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: qwik.configs.recommended.rules,
  },
];
