/**
 * カスタムESLintルールのエクスポート
 */
import limitChainDepth from './limit-chain-depth.ts';
import type { ESLint } from 'eslint';

const plugin: ESLint.Plugin = {
  rules: {
    'limit-chain-depth': limitChainDepth as any,
  },
};

export default plugin;

