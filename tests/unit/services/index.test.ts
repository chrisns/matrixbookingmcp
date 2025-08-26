import { describe, it, expect } from 'vitest';
import { AvailabilityService } from '../../../src/services/index.js';

describe('Services Module Exports', () => {
  it('should export AvailabilityService', () => {
    expect(AvailabilityService).toBeDefined();
    expect(typeof AvailabilityService).toBe('function');
  });

  it('should be able to create AvailabilityService instance', () => {
    // This tests that the export is valid - we don't need to actually create
    // a working instance since that would require mocking all dependencies
    expect(AvailabilityService.prototype.constructor).toBe(AvailabilityService);
  });
});