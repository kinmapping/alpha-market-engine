import js from '@eslint/js';
import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import customRules from './.eslint/custom-rules/index.ts';

const config: Linter.Config[] = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'custom-rules': customRules,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      // Biome が担当するルールは無効化（フォーマット、スタイル関連）
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      semi: 'off',
      quotes: 'off',
      indent: 'off',
      'comma-dangle': 'off',

      // 複雑度関連のルール（ESLint が担当）
      'max-depth': ['error', 4],
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 5],

      // カスタムルール: チェーンメソッドの深さを制限（最大3段階）
      'custom-rules/limit-chain-depth': ['warn', { maxDepth: 3 }],

      // TypeScript 固有のルール
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // テストファイルは複雑度チェックを緩和
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines-per-function': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 6],
      complexity: ['warn', 25],
      // カスタムルール: チェーンメソッドの深さを制限（最大3段階）
      'custom-rules/limit-chain-depth': ['warn', { maxDepth: 3 }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.config.ts', '*.config.js', 'vitest.config.ts', '.eslint/**'],
  },
];

export default config;
