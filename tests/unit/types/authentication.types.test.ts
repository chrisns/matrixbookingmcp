import { describe, it, expect } from 'vitest';
import type { ICredentials, IAuthenticationManager } from '../../../src/types/authentication.types.js';

describe('Authentication Types', () => {
  describe('ICredentials interface', () => {
    it('should define correct credential structure', () => {
      const username = 'testuser';
      const password = 'testpass';
      const credentials: ICredentials = {
        username,
        password,
        encodedCredentials: Buffer.from(`${username}:${password}`).toString('base64')
      };

      expect(credentials).toHaveProperty('username');
      expect(credentials).toHaveProperty('password');
      expect(credentials).toHaveProperty('encodedCredentials');
      expect(typeof credentials.username).toBe('string');
      expect(typeof credentials.password).toBe('string');
      expect(typeof credentials.encodedCredentials).toBe('string');
    });

    it('should enforce required string properties', () => {
      // TypeScript compilation test - these should cause type errors if uncommented
      // const invalid1: ICredentials = { username: 'test', password: 'pass' }; // missing encodedCredentials
      // const invalid2: ICredentials = { username: 123, password: 'pass', encodedCredentials: 'encoded' }; // wrong type
      
      const valid: ICredentials = {
        username: '',
        password: '',
        encodedCredentials: ''
      };
      
      expect(valid).toBeDefined();
    });
  });

  describe('IAuthenticationManager interface', () => {
    it('should define all required authentication methods', () => {
      class MockAuthManager implements IAuthenticationManager {
        getCredentials(): ICredentials {
          return {
            username: 'test',
            password: 'pass',
            encodedCredentials: 'encoded'
          };
        }

        encodeCredentials(username: string, password: string): string {
          return Buffer.from(`${username}:${password}`).toString('base64');
        }

        createAuthHeader(credentials: ICredentials): Record<string, string> {
          return {
            'Authorization': `Basic ${credentials.encodedCredentials}`
          };
        }
      }

      const authManager = new MockAuthManager();
      
      expect(typeof authManager.getCredentials).toBe('function');
      expect(typeof authManager.encodeCredentials).toBe('function');
      expect(typeof authManager.createAuthHeader).toBe('function');
    });

    it('should return correct types from methods', () => {
      class TestAuthManager implements IAuthenticationManager {
        getCredentials(): ICredentials {
          const username = 'testuser';
          const password = 'testpass';
          return {
            username,
            password,
            encodedCredentials: Buffer.from(`${username}:${password}`).toString('base64')
          };
        }

        encodeCredentials(username: string, password: string): string {
          return Buffer.from(`${username}:${password}`).toString('base64');
        }

        createAuthHeader(credentials: ICredentials): Record<string, string> {
          return {
            'Authorization': `Basic ${credentials.encodedCredentials}`,
            'Content-Type': 'application/json'
          };
        }
      }

      const authManager = new TestAuthManager();
      const credentials = authManager.getCredentials();
      const encoded = authManager.encodeCredentials('user', 'pass');
      const headers = authManager.createAuthHeader(credentials);

      expect(credentials).toHaveProperty('username');
      expect(credentials).toHaveProperty('password');
      expect(credentials).toHaveProperty('encodedCredentials');
      expect(typeof encoded).toBe('string');
      expect(headers).toHaveProperty('Authorization');
      expect(typeof headers).toBe('object');
    });

    it('should handle base64 encoding correctly', () => {
      class AuthManager implements IAuthenticationManager {
        getCredentials(): ICredentials {
          return {
            username: 'user',
            password: 'pass',
            encodedCredentials: this.encodeCredentials('user', 'pass')
          };
        }

        encodeCredentials(username: string, password: string): string {
          return Buffer.from(`${username}:${password}`).toString('base64');
        }

        createAuthHeader(credentials: ICredentials): Record<string, string> {
          return {
            'Authorization': `Basic ${credentials.encodedCredentials}`
          };
        }
      }

      const authManager = new AuthManager();
      const encoded = authManager.encodeCredentials('testuser', 'testpass');
      
      expect(encoded).toBe(Buffer.from('testuser:testpass').toString('base64'));
      
      const decoded = Buffer.from(encoded, 'base64').toString('ascii');
      expect(decoded).toBe('testuser:testpass');
    });
  });
});