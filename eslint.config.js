import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, prettier],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Chart layers must not reach into each other's internals.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['konva', 'konva/*', 'react-konva'],
              message: 'Konva may only be imported inside src/current-chart/rendering/konva.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/current-chart/rendering/konva/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The domain, engine and render-model layers stay framework-free.
    files: [
      'src/current-chart/domain/**/*.ts',
      'src/current-chart/engine/**/*.ts',
      'src/current-chart/rendering/types/**/*.ts',
    ],
    // Tests may build fixtures through the adapters.
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'konva', 'react-konva'],
              message: 'This layer must not depend on React or Konva.',
            },
            {
              group: ['**/adapters', '**/adapters/**'],
              message: 'This layer must not depend on data adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
