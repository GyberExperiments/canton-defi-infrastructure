import { expect, afterEach, vi } from 'vitest';

// Mock window for authService (requestPasswordReset uses window.location.origin)
if (typeof window === 'undefined') {
  (global as any).window = {
    location: { origin: 'https://test.example.com' },
  };
}

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console logs during tests unless needed
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
