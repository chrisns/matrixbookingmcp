import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthenticationManager } from '../../../src/auth/authentication-manager.js';
import type { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import type { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';

describe('AuthenticationManager', () => {
  let mockConfigManager: IConfigurationManager;
  let authManager: IAuthenticationManager;

  const validConfig: IServerConfig = {
    matrixUsername: 'testuser',
    matrixPassword: 'testpass123',
    matrixPreferredLocation: 'LOC001',
    apiTimeout: 5000,
    apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
    cacheEnabled: true
  };

  beforeEach(() => {
    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue(validConfig),
      validateConfig: vi.fn()
    };

    authManager = new AuthenticationManager(mockConfigManager);
  });

  describe('constructor', () => {
    it('should create instance with valid configuration manager', () => {
      expect(() => new AuthenticationManager(mockConfigManager)).not.toThrow();
      expect(authManager).toBeInstanceOf(AuthenticationManager);
    });
  });

  describe('getCredentials', () => {
    it('should return credentials with encoded data when config is valid', () => {
      const credentials = authManager.getCredentials();

      expect(credentials).toEqual({
        username: 'testuser',
        password: 'testpass123',
        encodedCredentials: expect.any(String)
      });

      expect(credentials.encodedCredentials).toBe(
        Buffer.from('testuser:testpass123', 'utf-8').toString('base64')
      );
    });

    it('should throw error when username is empty', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        ...validConfig,
        matrixUsername: ''
      });

      expect(() => authManager.getCredentials())
        .toThrow('Authentication credentials not available');
    });

    it('should throw error when password is empty', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        ...validConfig,
        matrixPassword: ''
      });

      expect(() => authManager.getCredentials())
        .toThrow('Authentication credentials not available');
    });

    it('should throw error when username is null/undefined', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        ...validConfig,
        matrixUsername: undefined as any
      });

      expect(() => authManager.getCredentials())
        .toThrow('Authentication credentials not available');
    });

    it('should throw error when password is null/undefined', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        ...validConfig,
        matrixPassword: undefined as any
      });

      expect(() => authManager.getCredentials())
        .toThrow('Authentication credentials not available');
    });

    it('should call configuration manager getConfig method', () => {
      authManager.getCredentials();

      expect(mockConfigManager.getConfig).toHaveBeenCalledOnce();
    });

    it('should handle configuration manager errors', () => {
      mockConfigManager.getConfig = vi.fn().mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => authManager.getCredentials())
        .toThrow('Configuration error');
    });

    it('should not persist credentials between calls', () => {
      const credentials1 = authManager.getCredentials();
      const credentials2 = authManager.getCredentials();

      expect(credentials1).toEqual(credentials2);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('encodeCredentials', () => {
    it('should encode valid username and password correctly', () => {
      const encoded = authManager.encodeCredentials('user', 'pass');
      const expected = Buffer.from('user:pass', 'utf-8').toString('base64');

      expect(encoded).toBe(expected);
    });

    it('should handle special characters in credentials', () => {
      const username = 'user@domain.com';
      const password = 'testpass123';
      
      const encoded = authManager.encodeCredentials(username, password);
      const expected = Buffer.from(`${username}:${password}`, 'utf-8').toString('base64');

      expect(encoded).toBe(expected);
    });

    it('should handle empty username', () => {
      expect(() => authManager.encodeCredentials('', 'password'))
        .toThrow('Username and password are required');
    });

    it('should handle empty password', () => {
      expect(() => authManager.encodeCredentials('username', ''))
        .toThrow('Username and password are required');
    });

    it('should handle null username', () => {
      expect(() => authManager.encodeCredentials(null as any, 'password'))
        .toThrow('Username and password are required');
    });

    it('should handle null password', () => {
      expect(() => authManager.encodeCredentials('username', null as any))
        .toThrow('Username and password are required');
    });

    it('should handle undefined username', () => {
      expect(() => authManager.encodeCredentials(undefined as any, 'password'))
        .toThrow('Username and password are required');
    });

    it('should handle undefined password', () => {
      expect(() => authManager.encodeCredentials('username', undefined as any))
        .toThrow('Username and password are required');
    });

    it('should produce same output for same input', () => {
      const encoded1 = authManager.encodeCredentials('user', 'pass');
      const encoded2 = authManager.encodeCredentials('user', 'pass');

      expect(encoded1).toBe(encoded2);
    });

    it('should produce different output for different inputs', () => {
      const encoded1 = authManager.encodeCredentials('user1', 'pass');
      const encoded2 = authManager.encodeCredentials('user2', 'pass');

      expect(encoded1).not.toBe(encoded2);
    });

    it('should handle UTF-8 characters correctly', () => {
      const username = 'üser';
      const password = 'pássword';
      
      const encoded = authManager.encodeCredentials(username, password);
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      expect(decoded).toBe(`${username}:${password}`);
    });
  });

  describe('createAuthHeader', () => {
    const username = 'testuser';
    const password = 'testpass';
    const validCredentials: ICredentials = {
      username,
      password,
      encodedCredentials: Buffer.from(`${username}:${password}`).toString('base64')
    };

    it('should create correct authorization header with valid credentials', () => {
      const headers = authManager.createAuthHeader(validCredentials);

      expect(headers).toEqual({
        'Authorization': `Basic ${validCredentials.encodedCredentials}`,
        'Content-Type': 'application/json;charset=UTF-8',
        'x-matrix-source': 'WEB',
        'x-time-zone': 'Europe/London'
      });
    });

    it('should include all required Matrix API headers', () => {
      const headers = authManager.createAuthHeader(validCredentials);

      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('Content-Type', 'application/json;charset=UTF-8');
      expect(headers).toHaveProperty('x-matrix-source', 'WEB');
      expect(headers).toHaveProperty('x-time-zone', 'Europe/London');
    });

    it('should throw error when encoded credentials are empty', () => {
      const invalidCredentials: ICredentials = {
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: ''
      };

      expect(() => authManager.createAuthHeader(invalidCredentials))
        .toThrow('Encoded credentials are required');
    });

    it('should throw error when encoded credentials are null', () => {
      const invalidCredentials: ICredentials = {
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: null as any
      };

      expect(() => authManager.createAuthHeader(invalidCredentials))
        .toThrow('Encoded credentials are required');
    });

    it('should throw error when encoded credentials are undefined', () => {
      const invalidCredentials: ICredentials = {
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: undefined as any
      };

      expect(() => authManager.createAuthHeader(invalidCredentials))
        .toThrow('Encoded credentials are required');
    });

    it('should handle long encoded credentials', () => {
      const longCredentials: ICredentials = {
        username: 'verylongusername@domain.com',
        password: 'verylongpasswordwithspecialcharacters!@#$%^&*()',
        encodedCredentials: Buffer.from('verylongusername@domain.com:verylongpasswordwithspecialcharacters!@#$%^&*()', 'utf-8').toString('base64')
      };

      const headers = authManager.createAuthHeader(longCredentials);

      expect(headers['Authorization']).toContain('Basic ');
      expect(headers['Authorization']).toContain(longCredentials.encodedCredentials);
    });

    it('should create immutable header object', () => {
      const headers = authManager.createAuthHeader(validCredentials);
      const originalHeaders = { ...headers };

      headers['Authorization'] = 'Modified';

      const newHeaders = authManager.createAuthHeader(validCredentials);
      expect(newHeaders).toEqual(originalHeaders);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication flow', () => {
      // Get credentials
      const credentials = authManager.getCredentials();
      expect(credentials.username).toBe('testuser');
      expect(credentials.password).toBe('testpass123');
      expect(credentials.encodedCredentials).toBeTruthy();

      // Create auth headers
      const headers = authManager.createAuthHeader(credentials);
      expect(headers['Authorization']).toContain('Basic ');
      expect(headers['Content-Type']).toBe('application/json;charset=UTF-8');
    });

    it('should handle credential encoding and header creation together', () => {
      const username = 'integrationuser';
      const password = 'integrationpass';
      
      // Encode credentials manually
      const encoded = authManager.encodeCredentials(username, password);
      
      // Create credentials object
      const credentials: ICredentials = {
        username,
        password,
        encodedCredentials: encoded
      };

      // Create headers
      const headers = authManager.createAuthHeader(credentials);
      
      // Verify the Authorization header contains the encoded credentials
      expect(headers['Authorization']).toBe(`Basic ${encoded}`);
    });

    it('should work with realistic production-like scenarios', () => {
      // Mock a production-like config
      const productionConfig: IServerConfig = {
        matrixUsername: 'prod.user@company.com',
        matrixPassword: 'prodpassword123',
        matrixPreferredLocation: 'PROD_LOC_001',
        apiTimeout: 5000,
        apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
        cacheEnabled: true
      };

      mockConfigManager.getConfig = vi.fn().mockReturnValue(productionConfig);

      const credentials = authManager.getCredentials();
      const headers = authManager.createAuthHeader(credentials);

      expect(credentials.username).toBe('prod.user@company.com');
      expect(headers['Authorization']).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
      expect(headers['x-matrix-source']).toBe('WEB');
    });
  });

  describe('security and performance', () => {
    it('should not log sensitive credential data', () => {
      // This test ensures no sensitive data leaks in console logs
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const credentials = authManager.getCredentials();
        authManager.createAuthHeader(credentials);

        // Verify no sensitive data was logged
        expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('testpass123'));
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('testpass123'));
      } finally {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    it('should not cache credentials in instance variables', () => {
      // Change the underlying config
      const newConfig = {
        ...validConfig,
        matrixUsername: 'newuser',
        matrixPassword: 'newpass'
      };

      const credentials1 = authManager.getCredentials();
      
      mockConfigManager.getConfig = vi.fn().mockReturnValue(newConfig);
      
      const credentials2 = authManager.getCredentials();

      expect(credentials1.username).toBe('testuser');
      expect(credentials2.username).toBe('newuser');
    });

    it('should handle multiple concurrent credential requests', () => {
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(authManager.getCredentials())
      );

      return Promise.all(promises).then(results => {
        results.forEach(credentials => {
          expect(credentials.username).toBe('testuser');
          expect(credentials.password).toBe('testpass123');
          expect(credentials.encodedCredentials).toBeTruthy();
        });
      });
    });

    it('should validate base64 encoding correctness', () => {
      const username = 'testuser';
      const password = 'testpass';
      
      const encoded = authManager.encodeCredentials(username, password);
      
      // Verify it's valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
      
      // Verify it decodes correctly
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      expect(decoded).toBe(`${username}:${password}`);
    });
  });
});