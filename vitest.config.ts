import path from 'path';

export default {
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./src/lib/canton/services/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      '.next',
      '**/*.integration.test.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/types/**',
        '**/interfaces/**'
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    'process.env.NEXT_PUBLIC_DAML_USE_MOCK_FALLBACK': 'true'
  }
};
