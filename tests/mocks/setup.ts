/**
 * MSW setup configuration for testing
 * Configures Mock Service Worker for Node.js environment
 */

import { setupServer } from 'msw/node';
import { allHandlers } from './matrix-api.handlers.js';

/**
 * MSW server instance for Node.js testing environment
 */
export const server = setupServer(...allHandlers);

/**
 * Setup MSW for tests
 * Call this in your test setup file
 */
export function setupMSW() {
  // Start MSW server before all tests
  server.listen({
    onUnhandledRequest: 'warn'
  });

  // Reset handlers after each test to ensure test isolation
  return {
    beforeEach: () => {
      server.resetHandlers();
    },
    
    // Clean up after all tests
    afterAll: () => {
      server.close();
    }
  };
}

/**
 * Utility to temporarily override handlers for specific tests
 */
export function withHandlers(handlers: any[], testFn: () => void | Promise<void>) {
  return async () => {
    server.use(...handlers);
    try {
      await testFn();
    } finally {
      server.resetHandlers();
    }
  };
}

/**
 * Utility to disable MSW for specific tests (useful for testing actual network errors)
 */
export function withoutMSW(testFn: () => void | Promise<void>) {
  return async () => {
    server.close();
    try {
      await testFn();
    } finally {
      server.listen();
    }
  };
}