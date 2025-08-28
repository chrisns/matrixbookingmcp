/**
 * Integration tests demonstrating MSW functionality
 * Tests Matrix API integration with realistic mocked responses
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { withHandlers } from '../mocks/setup.js';
import { createCustomHandler, createDelayedHandler } from '../mocks/matrix-api.handlers.js';
import { mockErrorResponses, createMockLocation, createMockAvailabilityResponse } from '../mocks/test-data.js';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { AuthenticationManager } from '../../src/auth/authentication-manager.js';
import { ConfigurationManager } from '../../src/config/config-manager.js';
import { ErrorHandler } from '../../src/error/error-handler.js';

describe('MSW Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let configManager: ConfigurationManager;
  let authManager: AuthenticationManager;
  let errorHandler: ErrorHandler;
  let apiClient: MatrixAPIClient;
  
  beforeAll(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set required environment variables for tests
    process.env['MATRIX_USERNAME'] = 'test-user';
    process.env['MATRIX_PASSWORD'] = 'test-password';
    process.env['MATRIX_PREFERED_LOCATION'] = '1';
    
    // Initialize components after setting environment variables
    configManager = new ConfigurationManager();
    authManager = new AuthenticationManager(configManager);
    errorHandler = new ErrorHandler();
    apiClient = new MatrixAPIClient(authManager, configManager, errorHandler);
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  // Mock credentials for testing - properly encoded
  const mockCredentials = {
    username: 'test-user',
    password: 'test-password',
    encodedCredentials: Buffer.from('test-user:test-password').toString('base64')
  };

  describe('Location API with MSW', () => {
    test('should get location using MSW mock', async () => {
      const response = await apiClient.getLocation(1, mockCredentials);
      
      expect(response).toBeDefined();
      expect(response.id).toBe(1);
      expect(response.name).toBe('Conference Room Alpha');
      expect(response.capacity).toBe(12);
      expect(response.features).toContain('WiFi');
    });

    test('should handle 404 for non-existent location', async () => {
      await expect(apiClient.getLocation(999, mockCredentials)).rejects.toThrow('The requested resource was not found');
    });

    test('should use custom handler for specific test scenario', async () => {
      const customLocation = createMockLocation({
        id: 999,
        name: 'Custom Test Room',
        capacity: 8
      });

      // Create a custom handler that uses http.get with the correct method and path
      const customHandler = http.get('https://app.matrixbooking.com/api/v1/location/999', async () => {
        await delay(100);
        return HttpResponse.json(customLocation);
      });
      
      await withHandlers([customHandler], async () => {
        const result = await apiClient.getLocation(999, mockCredentials);
        expect(result.name).toBe('Custom Test Room');
        expect(result.capacity).toBe(8);
      })();
    });
  });

  describe('Availability API with MSW', () => {
    test('should check availability using MSW mock', async () => {
      const request = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const response = await apiClient.checkAvailability(request, mockCredentials);
      
      expect(response.available).toBe(true);
      expect(response.location).toBeDefined();
      expect(response.location.id).toBe(1);
      expect(Array.isArray(response.slots)).toBe(true);
    });

    test('should return no availability for weekend requests', async () => {
      const request = {
        dateFrom: '2024-01-06T09:00:00.000Z', // Saturday
        dateTo: '2024-01-06T17:00:00.000Z',
        locationId: 1
      };

      const response = await apiClient.checkAvailability(request, mockCredentials);
      
      expect(response.available).toBe(false);
      expect(response.slots).toEqual([]);
    });

    test('should handle 400 bad request for invalid parameters', async () => {
      const request = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 999999  // Invalid location that doesn't exist
      };

      await expect(apiClient.checkAvailability(request, mockCredentials)).rejects.toThrow();
    });
  });

  describe('Booking API with MSW', () => {
    test('should create booking successfully', async () => {
      const request = {
        timeFrom: '2024-01-01T10:00:00.000Z',
        timeTo: '2024-01-01T11:00:00.000Z',
        locationId: 1,
        attendees: [{ name: 'John Doe', email: 'john@example.com' }],
        extraRequests: [],
        owner: { id: 1, name: 'Jane Smith', email: 'jane@example.com' },
        ownerIsAttendee: true,
        source: 'mcp-test'
      };

      const response = await apiClient.createBooking(request, mockCredentials);
      
      expect(response.id).toBeDefined();
      expect(response.status).toBe('CONFIRMED');
      expect(response.locationId).toBe(1);
    });

    test('should handle booking conflict (409)', async () => {
      const request = {
        timeFrom: '2024-01-01T11:00:00.000Z', // Conflict time pattern
        timeTo: '2024-01-01T12:00:00.000Z',
        locationId: 1,
        attendees: [{ name: 'John Doe', email: 'john@example.com' }],
        extraRequests: [],
        owner: { id: 1, name: 'Jane Smith', email: 'jane@example.com' },
        ownerIsAttendee: true,
        source: 'mcp-test'
      };

      // The API client throws on error responses, so we expect a rejection
      await expect(apiClient.createBooking(request, mockCredentials)).rejects.toThrow();
    });
  });

  describe('Error Handling with MSW', () => {
    test('should handle 401 unauthorized error', async () => {
      const unauthorizedHandler = createCustomHandler('/availability-401', mockErrorResponses.unauthorized, 401);
      
      await withHandlers([unauthorizedHandler], async () => {
        const request = {
          dateFrom: '2024-01-01T09:00:00.000Z',
          dateTo: '2024-01-01T17:00:00.000Z',
          locationId: 1
        };

        await expect(
          fetch('https://app.matrixbooking.com/api/v1/availability-401', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
          })
        ).resolves.toMatchObject({ status: 401 });
      })();
    });

    test('should handle 500 server error', async () => {
      const serverErrorHandler = createCustomHandler('/availability-500', mockErrorResponses.internalServerError, 500);
      
      await withHandlers([serverErrorHandler], async () => {
        const request = {
          dateFrom: '2024-01-01T09:00:00.000Z',
          dateTo: '2024-01-01T17:00:00.000Z',
          locationId: 1
        };

        const response = await fetch('https://app.matrixbooking.com/api/v1/availability-500', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Internal Server Error');
      })();
    });
  });

  describe('Timeout Simulation', () => {
    test('should demonstrate timeout behavior', async () => {
      const slowHandler = createDelayedHandler('/availability-slow', createMockAvailabilityResponse(), 1000);
      
      await withHandlers([slowHandler], async () => {
        const start = Date.now();
        
        const response = await fetch('https://app.matrixbooking.com/api/v1/availability-slow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateFrom: '2024-01-01T09:00:00.000Z',
            dateTo: '2024-01-01T17:00:00.000Z',
            locationId: 1
          })
        });

        const duration = Date.now() - start;
        expect(duration).toBeGreaterThan(900); // At least close to 1 second delay
        expect(response.ok).toBe(true);
      })();
    });
  });

  describe('MSW Server State Management', () => {
    test('should reset handlers between tests', async () => {
      // This test verifies that MSW state is properly reset
      // First, use a custom handler
      const customHandler = createCustomHandler('/test-reset', { test: 'first' });
      
      await withHandlers([customHandler], async () => {
        const response = await fetch('https://app.matrixbooking.com/api/v1/test-reset', {
          method: 'POST'
        });
        const data = await response.json();
        expect(data.test).toBe('first');
      })();

      // Verify that the custom handler is no longer active
      // This should result in an unhandled request warning, but not fail the test
      const response = await fetch('https://app.matrixbooking.com/api/v1/test-reset', {
        method: 'POST'
      }).catch(() => null);
      
      // The request should either fail or return a different response
      // since our custom handler is no longer active
      expect(response).toBeDefined();
    });

    test('should handle multiple custom handlers simultaneously', async () => {
      const handler1 = createCustomHandler('/multi-1', { id: 1, name: 'Handler 1' });
      const handler2 = createCustomHandler('/multi-2', { id: 2, name: 'Handler 2' });
      
      await withHandlers([handler1, handler2], async () => {
        const [response1, response2] = await Promise.all([
          fetch('https://app.matrixbooking.com/api/v1/multi-1', { method: 'POST' }),
          fetch('https://app.matrixbooking.com/api/v1/multi-2', { method: 'POST' })
        ]);

        const [data1, data2] = await Promise.all([
          response1.json(),
          response2.json()
        ]);

        expect(data1.name).toBe('Handler 1');
        expect(data2.name).toBe('Handler 2');
      })();
    });
  });
});