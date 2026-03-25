import path from 'path';

export default {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/lib/canton/services/__tests__/setup.ts'],
    include: ['**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'e2e/',
        '**/*.integration.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_DAML_USE_MOCK_FALLBACK': 'true'
  }
};
