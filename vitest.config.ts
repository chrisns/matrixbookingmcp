import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/types/**',
        'src/index.ts'
      ],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});