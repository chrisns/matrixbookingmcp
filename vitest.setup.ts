/**
 * Global Vitest setup configuration
 * Sets up MSW and other test environment configuration
 */

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { setupMSW } from './tests/mocks/setup.js';

/**
 * Setup test environment variables
 */
beforeAll(() => {
  // Set required environment variables for testing
  process.env.MATRIX_USERNAME = 'test-username';
  process.env.MATRIX_PASSWORD = 'test-password';
  process.env.MATRIX_PREFERED_LOCATION = '42';
});

/**
 * Setup MSW for all tests
 */
const mswConfig = setupMSW();

beforeAll(() => {
  // MSW is already started in setupMSW()
});

beforeEach(() => {
  mswConfig.beforeEach();
});

afterAll(() => {
  mswConfig.afterAll();
});

/**
 * Global test environment configuration
 */

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Override console methods to reduce test noise
// Tests can still explicitly call console methods when needed
console.log = (...args: any[]) => {
  // Allow console.log in tests when VITEST_VERBOSE is set
  if (process.env.VITEST_VERBOSE === 'true') {
    originalConsoleLog(...args);
  }
};

console.error = (...args: any[]) => {
  // Always show errors
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Allow warnings when VITEST_VERBOSE is set
  if (process.env.VITEST_VERBOSE === 'true') {
    originalConsoleWarn(...args);
  }
};

/**
 * Restore console methods after all tests
 */
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;  
  console.warn = originalConsoleWarn;
});