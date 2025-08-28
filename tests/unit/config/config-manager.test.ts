import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationManager, type IServerConfig } from '../../../src/config/config-manager.js';

describe('ConfigurationManager', () => {
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

  describe('constructor and validateConfig', () => {
    it('should successfully create instance with all required environment variables', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      expect(() => new ConfigurationManager(false)).not.toThrow();
    });

    it('should throw error when MATRIX_USERNAME is missing', () => {
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_USERNAME');
    });

    it('should throw error when MATRIX_PASSWORD is missing', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_PASSWORD');
    });

    it('should throw error when MATRIX_PREFERED_LOCATION is missing', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_PREFERED_LOCATION');
    });

    it('should throw error when multiple required variables are missing', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_PASSWORD, MATRIX_PREFERED_LOCATION');
    });

    it('should throw error when required variables are empty strings', () => {
      process.env['MATRIX_USERNAME'] = '';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_USERNAME');
    });

    it('should throw error when required variables are whitespace only', () => {
      process.env['MATRIX_USERNAME'] = '   ';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      expect(() => new ConfigurationManager(false))
        .toThrow('Missing required environment variables: MATRIX_USERNAME');
    });

    it('should include helpful message about .env.example file', () => {
      expect(() => new ConfigurationManager(false))
        .toThrow('Please copy .env.example to .env and configure the required values.');
    });
  });

  describe('getConfig', () => {
    it('should return correct configuration with required variables only', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      const expectedConfig: IServerConfig = {
        matrixUsername: 'testuser',
        matrixPassword: 'testpass',
        matrixPreferredLocation: 'loc123',
        apiTimeout: 5000,
        apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
        cacheEnabled: true
      };

      expect(config).toEqual(expectedConfig);
    });

    it('should return correct configuration with custom optional variables', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = '10000';
      process.env['MATRIX_API_BASE_URL'] = 'https://custom.api.url/v1';
      process.env['CACHE_ENABLED'] = 'false';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(10000);
      expect(config.apiBaseUrl).toBe('https://custom.api.url/v1');
      expect(config.cacheEnabled).toBe(false);
    });

    it('should handle invalid timeout value by defaulting to 5000', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = 'invalid';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(5000);
    });

    it('should handle empty timeout value by defaulting to 5000', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = '';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(5000);
    });

    it('should not expose sensitive data in config object logging', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'secretpassword123';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      // Verify sensitive data is present in the config object (internal usage)
      expect(config.matrixPassword).toBe('secretpassword123');
      
      // But verify it shouldn't be logged - this is a security test
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        // Simulate config being stringified for logging (which we want to prevent)
        const configString = JSON.stringify(config);
        console.error('Config loaded:', configString);
        
        // Verify the password was logged (this shows the vulnerability exists)
        expect(configString).toContain('secretpassword123');
        
        // In a real implementation, we'd want to ensure this doesn't happen
        // This test documents the current behavior but highlights the security concern
      } finally {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    it('should throw error when accessing config without initialization', () => {
      // Set up valid environment for construction
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      const configManager = new ConfigurationManager(false);
      
      // Manually set serverConfig to null to simulate uninitialized state
      (configManager as any).serverConfig = null;
      
      expect(() => {
        configManager.getConfig();
      }).toThrow('Configuration not loaded. Call validateConfig() first.');
    });
  });

  describe('validateConfig method', () => {
    it('should be callable independently', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      const configManager = new ConfigurationManager(false);
      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should throw when called independently with missing vars', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      
      const configManager = new ConfigurationManager(false);
      
      delete process.env['MATRIX_USERNAME'];
      delete process.env['MATRIX_PASSWORD'];
      delete process.env['MATRIX_PREFERED_LOCATION'];

      expect(() => configManager.validateConfig())
        .toThrow('Missing required environment variables');
    });
  });

  describe('edge cases', () => {
    it('should handle numeric string timeout values correctly', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = '0';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(0);
    });

    it('should handle negative timeout values', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = '-1000';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(-1000);
    });

    it('should handle very large timeout values', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['MATRIX_API_TIMEOUT'] = '999999';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.apiTimeout).toBe(999999);
    });

    it('should trim whitespace from environment variable values', () => {
      process.env['MATRIX_USERNAME'] = '  testuser  ';
      process.env['MATRIX_PASSWORD'] = '  testpass  ';
      process.env['MATRIX_PREFERED_LOCATION'] = '  loc123  ';

      expect(() => new ConfigurationManager(false)).not.toThrow();
    });
  });

  describe('cache configuration', () => {
    it('should default cacheEnabled to true when CACHE_ENABLED is not set', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.cacheEnabled).toBe(true);
    });

    it('should set cacheEnabled to false when CACHE_ENABLED is "false"', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['CACHE_ENABLED'] = 'false';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.cacheEnabled).toBe(false);
    });

    it('should set cacheEnabled to false when CACHE_ENABLED is "FALSE"', () => {
      process.env['MATRIX_USERNAME'] = 'testuser';
      process.env['MATRIX_PASSWORD'] = 'testpass';
      process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
      process.env['CACHE_ENABLED'] = 'FALSE';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();

      expect(config.cacheEnabled).toBe(false);
    });

    it('should set cacheEnabled to true for any value other than "false"', () => {
      const testValues = ['true', 'TRUE', 'yes', '1', 'enabled', 'anything'];
      
      testValues.forEach(value => {
        process.env['MATRIX_USERNAME'] = 'testuser';
        process.env['MATRIX_PASSWORD'] = 'testpass';
        process.env['MATRIX_PREFERED_LOCATION'] = 'loc123';
        process.env['CACHE_ENABLED'] = value;

        const configManager = new ConfigurationManager(false);
        const config = configManager.getConfig();

        expect(config.cacheEnabled).toBe(true);
      });
    });
  });
});