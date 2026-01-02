import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30秒（統合テスト用に長めに設定）
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './tests'),
    },
  },
});
