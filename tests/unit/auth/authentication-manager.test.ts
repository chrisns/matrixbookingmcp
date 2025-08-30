import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationManager } from '../../../src/auth/authentication-manager';

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockConfigManager: any;

  beforeEach(() => {
    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        matrixUsername: 'test@example.com',
        matrixPassword: 'password123'
      }),
      validateConfig: vi.fn()
    };

    authManager = new AuthenticationManager(mockConfigManager);
  });

  describe('getCredentials', () => {
    it('should return credentials from config', async () => {
      const credentials = await authManager.getCredentials();

      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(credentials).toEqual({
        username: 'test@example.com',
        password: 'password123',
        encodedCredentials: Buffer.from('test@example.com:password123').toString('base64')
      });
    });

    it('should handle missing username', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        matrixPassword: 'password123'
      });

      await expect(authManager.getCredentials()).rejects.toThrow('Authentication credentials not available');
    });

    it('should handle missing password', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        matrixUsername: 'test@example.com'
      });

      await expect(authManager.getCredentials()).rejects.toThrow('Authentication credentials not available');
    });

    it('should handle missing credentials', async () => {
      mockConfigManager.getConfig.mockReturnValue({});

      await expect(authManager.getCredentials()).rejects.toThrow('Authentication credentials not available');
    });
  });

  describe('encodeCredentials', () => {
    it('should encode credentials to base64', () => {
      const encoded = authManager.encodeCredentials('user@test.com', 'pass123');

      const expectedEncoded = Buffer.from('user@test.com:pass123').toString('base64');
      expect(encoded).toBe(expectedEncoded);
    });

    it('should handle special characters in credentials', () => {
      const encoded = authManager.encodeCredentials('user@test.com', 'p@ss:word!');

      const expectedEncoded = Buffer.from('user@test.com:p@ss:word!').toString('base64');
      expect(encoded).toBe(expectedEncoded);
    });

    it('should handle empty password', () => {
      expect(() => authManager.encodeCredentials('user@test.com', '')).toThrow('Username and password are required');
    });
  });

  describe('createAuthHeader', () => {
    it('should create auth headers with encoded credentials', () => {
      const credentials = {
        username: 'user@test.com',
        password: 'pass123',
        encodedCredentials: Buffer.from('user@test.com:pass123').toString('base64')
      };

      const headers = authManager.createAuthHeader(credentials);

      expect(headers).toHaveProperty('Authorization');
      expect(headers['Authorization']).toContain('Basic ');
      expect(headers).toHaveProperty('Content-Type', 'application/json;charset=UTF-8');
      expect(headers).toHaveProperty('x-matrix-source', 'WEB');
      expect(headers).toHaveProperty('x-time-zone', 'Europe/London');
    });

    it('should throw error when encoded credentials are missing', () => {
      const credentials = {
        username: 'user@test.com',
        password: 'pass123'
      } as any; // Missing encodedCredentials

      expect(() => authManager.createAuthHeader(credentials)).toThrow('Encoded credentials are required');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user with valid credentials', async () => {
      const credentials = {
        username: 'user@test.com',
        password: 'pass123',
        encodedCredentials: Buffer.from('user@test.com:pass123').toString('base64')
      };

      const mockUser = {
        personId: 123,
        email: 'user@test.com',
        name: 'Test User',
        organizationId: 456
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUser
      });

      mockConfigManager.getConfig.mockReturnValue({
        apiBaseUrl: 'https://api.test.com',
        apiTimeout: 30000
      });

      const result = await authManager.getCurrentUser(credentials);

      expect(result).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/user/current',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic ')
          })
        })
      );
    });

    it('should handle API errors', async () => {
      const credentials = {
        username: 'user@test.com',
        password: 'pass123',
        encodedCredentials: Buffer.from('user@test.com:pass123').toString('base64')
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      mockConfigManager.getConfig.mockReturnValue({
        apiBaseUrl: 'https://api.test.com',
        apiTimeout: 30000
      });

      await expect(authManager.getCurrentUser(credentials)).rejects.toThrow('Failed to get current user: 401 Unauthorized');
    });

    it('should handle invalid user profile response', async () => {
      const credentials = {
        username: 'user@test.com',
        password: 'pass123',
        encodedCredentials: Buffer.from('user@test.com:pass123').toString('base64')
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1 }) // Missing required fields
      });

      mockConfigManager.getConfig.mockReturnValue({
        apiBaseUrl: 'https://api.test.com',
        apiTimeout: 30000
      });

      await expect(authManager.getCurrentUser(credentials)).rejects.toThrow('Invalid user profile response: missing required fields');
    });
  });
});