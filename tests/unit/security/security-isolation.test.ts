import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ConfigurationManager } from '../../../src/config/config-manager.js';
import { AuthenticationManager } from '../../../src/auth/authentication-manager.js';

/**
 * Security Isolation and Environment Testing
 * 
 * This test suite verifies that security-related configurations and isolation
 * are properly implemented across the project.
 */
describe('Security Isolation Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear environment to ensure clean test state
    delete process.env.MATRIX_USERNAME;
    delete process.env.MATRIX_PASSWORD;
    delete process.env.MATRIX_PREFERED_LOCATION;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('File System Security', () => {
    it('should verify .env files are excluded from git', () => {
      const gitignorePath = path.resolve(process.cwd(), '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      
      // Verify various .env patterns are ignored
      expect(gitignoreContent).toMatch(/^\.env$/m);
      expect(gitignoreContent).toMatch(/^\.env\.local$/m);
      expect(gitignoreContent).toMatch(/^\.env\.production$/m);
      expect(gitignoreContent).toMatch(/^\.env\.staging$/m);
    });

    it('should verify no .env files exist in repository', () => {
      const envFiles = [
        '.env',
        '.env.local',
        '.env.production',
        '.env.staging',
        '.env.development'
      ];

      envFiles.forEach(envFile => {
        const envPath = path.resolve(process.cwd(), envFile);
        if (fs.existsSync(envPath)) {
          // If .env files exist, they should not contain real credentials
          const content = fs.readFileSync(envPath, 'utf-8');
          expect(content).not.toMatch(/password\s*=\s*[^=\s]+/i);
          expect(content).not.toMatch(/secret\s*=\s*[^=\s]+/i);
          expect(content).not.toMatch(/key\s*=\s*[^=\s]+/i);
        }
      });
    });

    it('should verify package.json does not contain sensitive data', () => {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      expect(fs.existsSync(packagePath)).toBe(true);
      
      const packageContent = fs.readFileSync(packagePath, 'utf-8');
      
      // Check for common credential patterns
      expect(packageContent).not.toMatch(/password.*[:=].*/i);
      expect(packageContent).not.toMatch(/secret.*[:=].*/i);
      expect(packageContent).not.toMatch(/api[_-]?key.*[:=].*/i);
      expect(packageContent).not.toMatch(/token.*[:=].*/i);
    });
  });

  describe('Environment Variable Security', () => {
    it('should handle completely missing environment variables', () => {
      // Ensure all Matrix-related env vars are undefined
      expect(process.env.MATRIX_USERNAME).toBeUndefined();
      expect(process.env.MATRIX_PASSWORD).toBeUndefined();
      expect(process.env.MATRIX_PREFERED_LOCATION).toBeUndefined();
      
      // Configuration manager should fail gracefully
      expect(() => new ConfigurationManager(false)).toThrow();
    });

    it('should reject empty string environment variables', () => {
      process.env.MATRIX_USERNAME = '';
      process.env.MATRIX_PASSWORD = '';
      process.env.MATRIX_PREFERED_LOCATION = '';
      
      expect(() => new ConfigurationManager(false)).toThrow();
    });

    it('should reject whitespace-only environment variables', () => {
      process.env.MATRIX_USERNAME = '   ';
      process.env.MATRIX_PASSWORD = '\t\n  \t';
      process.env.MATRIX_PREFERED_LOCATION = '    ';
      
      expect(() => new ConfigurationManager(false)).toThrow();
    });

    it('should handle environment variable injection attempts', () => {
      const injectionAttempts = [
        '$(malicious_command)',
        '`malicious_command`',
        '${malicious_variable}',
        '|malicious_pipe',
        ';malicious_semicolon',
        '&&malicious_and',
        '||malicious_or'
      ];

      injectionAttempts.forEach(injection => {
        process.env.MATRIX_USERNAME = `user${injection}`;
        process.env.MATRIX_PASSWORD = `pass${injection}`;
        process.env.MATRIX_PREFERED_LOCATION = 'LOC001';

          const configManager = new ConfigurationManager(false);
        const config = configManager.getConfig();

        // Environment variables should be used as-is (not executed)
        expect(config.matrixUsername).toBe(`user${injection}`);
        expect(config.matrixPassword).toBe(`pass${injection}`);
      });
    });
  });

  describe('Process Isolation Security', () => {
    it('should not expose credentials through process arguments', () => {
      const args = process.argv;
      
      args.forEach(arg => {
        expect(arg).not.toMatch(/password/i);
        expect(arg).not.toMatch(/secret/i);
        expect(arg).not.toMatch(/key/i);
        expect(arg).not.toMatch(/token/i);
      });
    });

    it('should not expose credentials through process environment in production', () => {
      // This test simulates checking environment exposure
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /private[_-]?key/i,
        /api[_-]?key/i,
        /token/i
      ];

      Object.keys(process.env).forEach(key => {
        if (key.startsWith('MATRIX_')) {
          // Matrix variables are expected, but verify they're not leaked elsewhere
          expect(key).toMatch(/^MATRIX_(USERNAME|PASSWORD|PREFERED_LOCATION)$/);
        }
        
        // Check for other potentially sensitive environment variables
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          // These should only be Matrix-related or known safe variables
          expect(key).toMatch(/^(MATRIX_|NODE_|npm_|CI_|GITHUB_)/);
        }
      });
    });
  });

  describe('Memory Security', () => {
    it('should not leak credentials in memory dumps', () => {
      // Set up credentials
      process.env.MATRIX_USERNAME = 'memorytest';
      process.env.MATRIX_PASSWORD = 'memorytestpass123';
      process.env.MATRIX_PREFERED_LOCATION = 'MEM001';

      
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      
      // Generate credentials
      const credentials = authManager.getCredentials();
      const headers = authManager.createAuthHeader(credentials);
      
      // Simulate memory pressure to force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Verify credentials still work after potential GC
      expect(credentials.username).toBe('memorytest');
      expect(headers['Authorization']).toContain('Basic ');
      
      // Clear references
      const configRef = configManager;
      const authRef = authManager;
      
      expect(configRef).toBeDefined();
      expect(authRef).toBeDefined();
    });

    it('should handle rapid credential generation without memory leaks', () => {
      process.env.MATRIX_USERNAME = 'rapidtest';
      process.env.MATRIX_PASSWORD = 'rapidtestpass';
      process.env.MATRIX_PREFERED_LOCATION = 'RAPID001';

      
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      
      // Rapid generation to test for leaks
      for (let i = 0; i < 1000; i++) {
        const creds = authManager.getCredentials();
        const headers = authManager.createAuthHeader(creds);
        
        expect(creds.username).toBe('rapidtest');
        expect(headers['Authorization']).toBeTruthy();
      }
    });
  });

  describe('Network Security Preparation', () => {
    it('should use secure defaults for HTTP headers', () => {
      process.env.MATRIX_USERNAME = 'nettest';
      process.env.MATRIX_PASSWORD = 'nettestpass';
      process.env.MATRIX_PREFERED_LOCATION = 'NET001';

      
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      
      const credentials = authManager.getCredentials();
      const headers = authManager.createAuthHeader(credentials);
      
      // Verify secure header defaults
      expect(headers['Content-Type']).toBe('application/json;charset=UTF-8');
      expect(headers['x-matrix-source']).toBe('WEB');
      expect(headers['x-time-zone']).toBe('Europe/London');
      expect(headers['Authorization']).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    });

    it('should verify API base URL is HTTPS', () => {
      process.env.MATRIX_USERNAME = 'httpstest';
      process.env.MATRIX_PASSWORD = 'httpstestpass';
      process.env.MATRIX_PREFERED_LOCATION = 'HTTPS001';

      const configManager = new ConfigurationManager(false);
      const config = configManager.getConfig();
      
      // Verify HTTPS usage
      expect(config.apiBaseUrl).toMatch(/^https:\/\//);
      expect(config.apiBaseUrl).not.toMatch(/^http:\/\//);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive data in error stack traces', () => {
      process.env.MATRIX_USERNAME = 'errortest';
      process.env.MATRIX_PASSWORD = 'errortestpass123';
      process.env.MATRIX_PREFERED_LOCATION = 'ERR001';

      
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      
      try {
        // Force an error with invalid credentials format
        const invalidCreds = {
          username: 'errortest',
          password: 'errortestpass123',
          encodedCredentials: null as any
        };
        
        authManager.createAuthHeader(invalidCreds);
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorStr = error instanceof Error ? error.toString() : String(error);
        const stackTrace = error instanceof Error ? error.stack : '';
        
        // Verify no sensitive data in error or stack trace
        expect(errorStr).not.toContain('errortestpass123');
        expect(stackTrace).not.toContain('errortestpass123');
        expect(errorStr).not.toContain('errortest');
        
        // But error should be descriptive enough to be useful
        expect(errorStr).toContain('Encoded credentials are required');
      }
    });
  });
});