import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatrixBookingMCPServer } from '../../../src/mcp/mcp-server.js';
import { AvailabilityService } from '../../../src/services/availability-service.js';
import { BookingService } from '../../../src/services/booking-service.js';
import { LocationService } from '../../../src/services/location-service.js';
import { ConfigurationManager } from '../../../src/config/config-manager.js';
import { AuthenticationManager } from '../../../src/auth/authentication-manager.js';
import { MatrixAPIClient } from '../../../src/api/matrix-api-client.js';
import { ErrorHandler } from '../../../src/error/error-handler.js';

describe('Stateless Architecture Validation', () => {
  
  describe('Service Classes State Independence', () => {
    let configManager: ConfigurationManager;
    let authManager: AuthenticationManager;
    let apiClient: MatrixAPIClient;

    beforeEach(() => {
      // Mock environment variables for consistent testing
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');
      vi.stubEnv('MATRIX_API_TIMEOUT', '5000');
      vi.stubEnv('MATRIX_API_BASE_URL', 'https://test.api.com');

      configManager = new ConfigurationManager(false);
      authManager = new AuthenticationManager(configManager);
      apiClient = new MatrixAPIClient(authManager, configManager);
    });

    it('should create multiple service instances without shared state', () => {
      const service1 = new AvailabilityService(apiClient, configManager, authManager);
      const service2 = new AvailabilityService(apiClient, configManager, authManager);
      
      // Services should be independent instances
      expect(service1).not.toBe(service2);
      
      // Each service should have its own dependency references (constructor injection only)
      expect(service1).toHaveProperty('apiClient');
      expect(service1).toHaveProperty('configManager');
      expect(service1).toHaveProperty('authManager');
      expect(service2).toHaveProperty('apiClient');
      expect(service2).toHaveProperty('configManager');
      expect(service2).toHaveProperty('authManager');
    });

    it('should not maintain request state between method calls', async () => {
      const service = new AvailabilityService(apiClient, configManager, authManager);
      
      // Mock the API client to avoid actual network calls
      const mockCheckAvailability = vi.fn().mockResolvedValue({
        success: true,
        availableSlots: [],
        message: 'Mock response'
      });
      vi.spyOn(apiClient, 'checkAvailability').mockImplementation(mockCheckAvailability);
      vi.spyOn(authManager, 'getCredentials').mockResolvedValue({
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: Buffer.from('testuser:testpass').toString('base64')
      });

      // First request
      const request1 = { dateFrom: '2024-01-01T09:00:00.000Z', dateTo: '2024-01-01T17:00:00.000Z', locationId: 1 };
      await service.checkAvailability(request1);
      
      // Second request with different parameters
      const request2 = { dateFrom: '2024-01-02T09:00:00.000Z', dateTo: '2024-01-02T17:00:00.000Z', locationId: 2 };
      await service.checkAvailability(request2);
      
      // Verify both calls were independent - each call should pass through its own parameters
      expect(mockCheckAvailability).toHaveBeenCalledTimes(2);
      expect(mockCheckAvailability).toHaveBeenNthCalledWith(1, request1, `Basic ${Buffer.from('testuser:testpass').toString('base64')}`);
      expect(mockCheckAvailability).toHaveBeenNthCalledWith(2, request2, `Basic ${Buffer.from('testuser:testpass').toString('base64')}`);
    });

    it('should not cache credentials between requests', () => {
      const authManager1 = new AuthenticationManager(configManager);
      const authManager2 = new AuthenticationManager(configManager);
      
      const creds1 = authManager1.getCredentials();
      const creds2 = authManager2.getCredentials();
      
      // Credentials should be generated fresh each time (no caching) and be equal for same config
      expect(creds1).toStrictEqual(creds2); // Same config should produce same credentials
      
      // But verify they're generated, not cached, by checking the generation happens each call
      const bufferSpy = vi.spyOn(Buffer, 'from');
      authManager1.getCredentials();
      authManager2.getCredentials();
      
      // Buffer.from should be called for Base64 encoding each time, indicating fresh generation
      expect(bufferSpy).toHaveBeenCalled();
    });

    it('should not store any session data in service instances', () => {
      const services = [
        new AvailabilityService(apiClient, configManager, authManager),
        new BookingService(apiClient, authManager, configManager),
        new LocationService(apiClient, configManager, authManager)
      ];

      services.forEach((service, _index) => {
        const serviceKeys = Object.keys(service);
        
        // Should only have dependency injection properties, no state properties
        const expectedProps = ['apiClient', 'configManager', 'authManager', 'errorHandler', 'validator', 'sanitizer'];
        serviceKeys.forEach(key => {
          expect(expectedProps.some(prop => key.includes(prop))).toBe(true);
        });
        
        // Should not have properties that indicate state storage
        const statefulProps = ['cache', 'session', 'store', 'memory', 'buffer', 'queue', 'history'];
        serviceKeys.forEach(key => {
          statefulProps.forEach(stateProp => {
            expect(key.toLowerCase()).not.toContain(stateProp);
          });
        });
      });
    });
  });

  describe('Request Independence', () => {
    let mcpServer: MatrixBookingMCPServer;

    beforeEach(() => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      mcpServer = new MatrixBookingMCPServer();
    });

    it('should process multiple concurrent requests independently', async () => {
      // Mock the service methods to avoid actual API calls
      const mockAvailabilityResponse = { 
        available: true, 
        slots: [], 
        location: { id: 1, name: 'Test Location', capacity: 10, features: [] }
      };
      const mockLocationResponse = { 
        id: 1, 
        name: 'Test Location', 
        capacity: 10, 
        features: []
      };
      
      vi.spyOn(mcpServer['availabilityService'], 'checkAvailability').mockResolvedValue(mockAvailabilityResponse);
      vi.spyOn(mcpServer['locationService'], 'getPreferredLocation').mockResolvedValue(mockLocationResponse);
      vi.spyOn(mcpServer['locationService'], 'getLocation').mockResolvedValue(mockLocationResponse);

      // Simulate concurrent requests
      const requests = [
        mcpServer['handleCheckAvailability']({ dateFrom: '2024-01-01T09:00:00.000Z' }),
        mcpServer['handleCheckAvailability']({ dateFrom: '2024-01-02T09:00:00.000Z' }),
        mcpServer['handleGetLocation']({}),
        mcpServer['handleGetLocation']({ locationId: 2 })
      ];

      const responses = await Promise.all(requests);

      // All requests should complete successfully and independently
      expect(responses).toHaveLength(4);
      responses.forEach(response => {
        expect(response).toHaveProperty('content');
        expect(response.content).toHaveLength(1);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0]).toHaveProperty('text');
        expect(() => JSON.parse(response.content[0]?.text || '')).not.toThrow();
      });

      // Verify each service method was called with correct parameters
      expect(mcpServer['availabilityService'].checkAvailability).toHaveBeenCalledTimes(2);
      expect(mcpServer['locationService'].getPreferredLocation).toHaveBeenCalledTimes(1);
      expect(mcpServer['locationService'].getLocation).toHaveBeenCalledTimes(1);
    });

    it('should generate unique request IDs without persistence', () => {
      const errorHandler = new ErrorHandler();
      
      // Generate multiple errors to verify unique request IDs
      const error1 = errorHandler.handleError(new Error('Test error 1'), 'API_ERROR');
      const error2 = errorHandler.handleError(new Error('Test error 2'), 'API_ERROR');
      const error3 = errorHandler.handleError(new Error('Test error 3'), 'VALIDATION_ERROR');
      
      // Request IDs should be unique
      expect(error1.requestId).toBeDefined();
      expect(error2.requestId).toBeDefined();
      expect(error3.requestId).toBeDefined();
      expect(error1.requestId).not.toBe(error2.requestId);
      expect(error2.requestId).not.toBe(error3.requestId);
      expect(error1.requestId).not.toBe(error3.requestId);
      
      // Request IDs should be UUIDs (36 characters with hyphens)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(error1.requestId).toMatch(uuidPattern);
      expect(error2.requestId).toMatch(uuidPattern);
      expect(error3.requestId).toMatch(uuidPattern);
    });
  });

  describe('Configuration Immutability', () => {
    it('should load configuration once and not modify it during requests', () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      const configManager1 = new ConfigurationManager(false);
      const configManager2 = new ConfigurationManager(false);
      
      const config1 = configManager1.getConfig();
      const config2 = configManager2.getConfig();
      
      // Configurations should be identical (immutable)
      expect(config1).toEqual(config2);
      expect(config1.matrixUsername).toBe('testuser');
      expect(config1.matrixPassword).toBe('testpass');
      expect(config1.matrixPreferredLocation).toBe('1');
      
      // Configuration objects should be independent instances
      expect(config1).not.toBe(config2);
    });

    it('should return same configuration object for consistency', () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      const configManager = new ConfigurationManager(false);
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();
      
      // Configuration manager should return the same object for consistency
      // This is acceptable for stateless architecture as it's immutable configuration data
      expect(config1).toBe(config2);
      expect(config1.matrixUsername).toBe('testuser');
    });
  });

  describe('Horizontal Scaling Compatibility', () => {
    it('should support multiple server instances without coordination', () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      // Create multiple server instances (simulating horizontal scaling)
      const server1 = new MatrixBookingMCPServer();
      const server2 = new MatrixBookingMCPServer();
      const server3 = new MatrixBookingMCPServer();
      
      // All servers should be independent instances
      expect(server1).not.toBe(server2);
      expect(server2).not.toBe(server3);
      expect(server1).not.toBe(server3);
      
      // Each should have its own service instances
      expect(server1['availabilityService']).not.toBe(server2['availabilityService']);
      expect(server1['bookingService']).not.toBe(server2['bookingService']);
      expect(server1['locationService']).not.toBe(server2['locationService']);
    });

    it('should maintain consistency across instances with same configuration', () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');
      vi.stubEnv('MATRIX_API_TIMEOUT', '5000');

      const configManager1 = new ConfigurationManager(false);
      const configManager2 = new ConfigurationManager(false);
      
      const config1 = configManager1.getConfig();
      const config2 = configManager2.getConfig();
      
      // Configurations should be consistent across instances
      expect(config1.matrixUsername).toBe(config2.matrixUsername);
      expect(config1.matrixPassword).toBe(config2.matrixPassword);
      expect(config1.matrixPreferredLocation).toBe(config2.matrixPreferredLocation);
      expect(config1.apiTimeout).toBe(config2.apiTimeout);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not accumulate state or memory over multiple requests', async () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const apiClient = new MatrixAPIClient(authManager, configManager);
      const service = new AvailabilityService(apiClient, configManager, authManager);

      // Mock API response to avoid network calls
      vi.spyOn(apiClient, 'checkAvailability').mockResolvedValue({
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location', capacity: 10, features: [] }
      });
      vi.spyOn(authManager, 'getCredentials').mockResolvedValue({
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: 'dGVzdA=='
      });

      // Get initial object property count
      const initialPropCount = Object.keys(service).length;

      // Simulate multiple requests
      for (let i = 0; i < 10; i++) {
        await service.checkAvailability({
          dateFrom: `2024-01-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
          dateTo: `2024-01-${String(i + 1).padStart(2, '0')}T17:00:00.000Z`,
          locationId: i + 1
        });
      }

      // Service should not accumulate properties after multiple requests
      const finalPropCount = Object.keys(service).length;
      expect(finalPropCount).toBe(initialPropCount);
    });

    it('should create fresh instances for each MCP server without shared references', () => {
      vi.stubEnv('MATRIX_USERNAME', 'testuser');
      vi.stubEnv('MATRIX_PASSWORD', 'testpass');
      vi.stubEnv('MATRIX_PREFERED_LOCATION', '1');

      const server1 = new MatrixBookingMCPServer();
      const server2 = new MatrixBookingMCPServer();
      
      // Services should be independent instances, not shared references
      expect(server1['availabilityService']).not.toBe(server2['availabilityService']);
      expect(server1['bookingService']).not.toBe(server2['bookingService']);
      expect(server1['locationService']).not.toBe(server2['locationService']);
      
      // But dependency injection should use same types of objects (different instances)
      expect(server1['availabilityService'].constructor.name).toBe('AvailabilityService');
      expect(server2['availabilityService'].constructor.name).toBe('AvailabilityService');
    });
  });
});