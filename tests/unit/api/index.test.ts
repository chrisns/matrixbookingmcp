import { describe, it, expect } from 'vitest';
import { MatrixAPIClient } from '../../../src/api/index.js';

describe('API Module Exports', () => {
  it('should export MatrixAPIClient', () => {
    expect(MatrixAPIClient).toBeDefined();
    expect(typeof MatrixAPIClient).toBe('function');
  });
});