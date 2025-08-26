import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have Node.js environment available', () => {
    expect(process).toBeDefined();
    expect(process.env).toBeDefined();
  });

  it('should support ES2022 features', () => {
    const testArray = [1, 2, 3];
    expect(testArray.at(-1)).toBe(3);
  });
});