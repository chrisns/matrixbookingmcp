import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationManager } from '../../src/config/config-manager.js';

describe('Server Startup Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    
    delete process.env['MATRIX_USERNAME'];
    delete process.env['MATRIX_PASSWORD'];
    delete process.env['MATRIX_PREFERED_LOCATION'];
    delete process.env['MATRIX_API_TIMEOUT'];
    delete process.env['MATRIX_API_BASE_URL'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate configuration integration', () => {
    process.env['MATRIX_USERNAME'] = 'testuser';
    process.env['MATRIX_PASSWORD'] = 'testpass';
    process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

    const configManager = new ConfigurationManager(false);
    const config = configManager.getConfig();

    expect(config.matrixUsername).toBe('testuser');
    expect(config.matrixPassword).toBe('testpass');
    expect(config.matrixPreferredLocation).toBe('loc123');
    expect(config.apiTimeout).toBe(5000);
    expect(config.apiBaseUrl).toBe('https://app.matrixbooking.com/api/v1');
  });

  it('should fail validation with missing environment variables', () => {
    expect(() => new ConfigurationManager(false))
      .toThrow('Missing required environment variables');
  });

  it('should handle custom configuration values', () => {
    process.env['MATRIX_USERNAME'] = 'customuser';
    process.env['MATRIX_PASSWORD'] = 'custompass';
    process.env['MATRIX_PREFERED_LOCATION'] = 'customloc456';
    process.env['MATRIX_API_TIMEOUT'] = '10000';
    process.env['MATRIX_API_BASE_URL'] = 'https://custom.api.url/v1';

    const configManager = new ConfigurationManager(false);
    const config = configManager.getConfig();

    expect(config.apiTimeout).toBe(10000);
    expect(config.apiBaseUrl).toBe('https://custom.api.url/v1');
  });
});