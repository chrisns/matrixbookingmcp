import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigurationManager } from '../../../src/config/config-manager';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env['MATRIX_USERNAME'] = 'test@example.com';
    process.env['MATRIX_PASSWORD'] = 'password123';
    process.env['MATRIX_PREFERED_LOCATION'] = '1000001';
    process.env['MATRIX_API_BASE_URL'] = 'https://api.test.com';
    
    configManager = new ConfigurationManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return configuration from environment variables', () => {
      configManager.validateConfig();
      const config = configManager.getConfig();

      expect(config).toEqual({
        apiBaseUrl: 'https://api.test.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password123',
        matrixPreferredLocation: '1000001',
        apiTimeout: 5000,
        cacheEnabled: true
      });
    });

    it('should use default API base URL when not provided', () => {
      delete process.env['MATRIX_API_BASE_URL'];
      configManager = new ConfigurationManager();
      configManager.validateConfig();
      const config = configManager.getConfig();

      expect(config.apiBaseUrl).toBe('https://app.matrixbooking.com/api/v1');
    });

    it('should use default timeout', () => {
      configManager.validateConfig();
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(5000);
    });

    it('should handle missing optional fields', () => {
      // MATRIX_PREFERED_LOCATION is now required, so we don't test removing it
      delete process.env['MATRIX_API_BASE_URL'];
      delete process.env['MATRIX_API_TIMEOUT'];
      configManager = new ConfigurationManager();
      const config = configManager.getConfig();

      expect(config.apiBaseUrl).toBe('https://app.matrixbooking.com/api/v1');
      expect(config.apiTimeout).toBe(5000);
    });
  });

  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should throw error when username is missing', () => {
      delete process.env['MATRIX_USERNAME'];

      expect(() => new ConfigurationManager(false)).toThrow('Missing required environment variables');
    });

    it('should throw error when password is missing', () => {
      delete process.env['MATRIX_PASSWORD'];

      expect(() => new ConfigurationManager(false)).toThrow('Missing required environment variables');
    });

    it('should throw error when preferred location is missing', () => {
      delete process.env['MATRIX_PREFERED_LOCATION'];

      expect(() => new ConfigurationManager(false)).toThrow('Missing required environment variables');
    });
  });


});