import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { ConfigurationManager } from '../../src/config/config-manager.js';
import { AuthenticationManager } from '../../src/auth/authentication-manager.js';
import { ErrorHandler } from '../../src/error/error-handler.js';
import { IAvailabilityRequest } from '../../src/types/availability.types.js';
import { IBookingRequest } from '../../src/types/booking.types.js';
// import { ICredentials } from '../../src/types/authentication.types.js';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Stateless Architecture Performance Testing', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env['MATRIX_USERNAME'] = 'testuser';
    process.env['MATRIX_PASSWORD'] = 'testpass';
    process.env['MATRIX_PREFERED_LOCATION'] = 'London';
    process.env['MATRIX_API_TIMEOUT'] = '5000';
    process.env['MATRIX_API_BASE_URL'] = 'https://app.matrixbooking.com/api/v1';
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Stateless Client Instance Behavior', () => {
    it('should create multiple independent client instances without interference', async () => {
      const mockResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      // Create multiple independent client instances
      const numClients = 10;
      const clients = Array.from({ length: numClients }, () => {
        const configManager = new ConfigurationManager(false); // Don't reload .env
        const authManager = new AuthenticationManager(configManager);
        const errorHandler = new ErrorHandler();
        return new MatrixAPIClient(authManager, configManager, errorHandler);
      });

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Each client should be able to make requests independently
      const results = await Promise.all(
        clients.map(async (client, _index) => {
          const authManager = (client as any).authManager;
          const credentials = authManager.getCredentials();
          return client.checkAvailability(mockRequest, credentials);
        })
      );

      // All requests should succeed with the same response
      results.forEach(result => {
        expect(result).toEqual(mockResponse);
      });

      // Each client should have made exactly one request
      expect(mockFetch).toHaveBeenCalledTimes(numClients);
    });

    it('should handle concurrent requests across multiple client instances', async () => {
      const mockResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      // Mock with slight delay to test concurrency
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          })), 10)
        )
      );

      const numClients = 5;
      const requestsPerClient = 3;
      const clients = Array.from({ length: numClients }, () => {
        const configManager = new ConfigurationManager(false);
        const authManager = new AuthenticationManager(configManager);
        const errorHandler = new ErrorHandler();
        return new MatrixAPIClient(authManager, configManager, errorHandler);
      });

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Create concurrent requests across all clients
      const allRequestPromises = clients.flatMap(client => {
        const authManager = (client as any).authManager;
        const credentials = authManager.getCredentials();
        
        return Array.from({ length: requestsPerClient }, () =>
          client.checkAvailability(mockRequest, credentials)
        );
      });

      const startTime = Date.now();
      const results = await Promise.all(allRequestPromises);
      const duration = Date.now() - startTime;

      // All requests should complete successfully
      expect(results).toHaveLength(numClients * requestsPerClient);
      results.forEach(result => {
        expect(result).toEqual(mockResponse);
      });

      // Should complete in reasonable time (concurrency, not sequential)
      // With 10ms delay per request and proper concurrency, should be much faster than sequential
      const maxSequentialTime = (numClients * requestsPerClient * 10) * 0.8; // 80% of sequential time
      expect(duration).toBeLessThan(maxSequentialTime);

      console.error(`${numClients * requestsPerClient} concurrent requests across ${numClients} clients completed in ${duration}ms`);
    });

    it('should maintain independent state across client instances with different configurations', async () => {
      // Create clients with different timeout configurations
      const client1Config = { ...process.env, MATRIX_API_TIMEOUT: '3000' };
      const client2Config = { ...process.env, MATRIX_API_TIMEOUT: '7000' };

      // Temporarily override env for each client
      process.env = client1Config;
      const configManager1 = new ConfigurationManager(false);
      const authManager1 = new AuthenticationManager(configManager1);
      const client1 = new MatrixAPIClient(authManager1, configManager1);

      process.env = client2Config;
      const configManager2 = new ConfigurationManager(false);
      const authManager2 = new AuthenticationManager(configManager2);
      const client2 = new MatrixAPIClient(authManager2, configManager2);

      // Restore original env
      process.env = originalEnv;

      // Verify different timeout configurations
      const config1 = configManager1.getConfig();
      const config2 = configManager2.getConfig();
      
      expect(config1.apiTimeout).toBe(3000);
      expect(config2.apiTimeout).toBe(7000);

      // Both clients should work independently with their own configurations
      const mockResponse = { success: true };
      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const credentials1 = authManager1.getCredentials();
      const credentials2 = authManager2.getCredentials();

      const [result1, result2] = await Promise.all([
        client1.checkAvailability(mockRequest, credentials1),
        client2.checkAvailability(mockRequest, credentials2)
      ]);

      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
    });
  });

  describe('No Shared State Between Requests', () => {
    it('should not leak request state between sequential requests', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();

      // First request - success
      const successResponse = { available: true, slots: [], location: { id: 1, name: 'Location 1' } };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(successResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const request1: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const result1 = await client.checkAvailability(request1, credentials);
      expect(result1).toEqual(successResponse);

      // Second request - different data, should not be affected by first request
      const differentResponse = { available: false, slots: [], location: { id: 2, name: 'Location 2' } };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(differentResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const request2: IAvailabilityRequest = {
        dateFrom: '2024-01-02T09:00:00.000',
        dateTo: '2024-01-02T17:00:00.000',
        locationId: 2
      };

      const result2 = await client.checkAvailability(request2, credentials);
      expect(result2).toEqual(differentResponse);

      // Third request - error, should not affect subsequent requests
      mockFetch.mockResolvedValueOnce(new Response('Server Error', {
        status: 500,
        statusText: 'Internal Server Error'
      }));

      const request3: IAvailabilityRequest = {
        dateFrom: '2024-01-03T09:00:00.000',
        dateTo: '2024-01-03T17:00:00.000',
        locationId: 3
      };

      try {
        await client.checkAvailability(request3, credentials);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Fourth request - should work normally again (no state pollution)
      const finalResponse = { available: true, slots: [], location: { id: 4, name: 'Location 4' } };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(finalResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const request4: IAvailabilityRequest = {
        dateFrom: '2024-01-04T09:00:00.000',
        dateTo: '2024-01-04T17:00:00.000',
        locationId: 4
      };

      const result4 = await client.checkAvailability(request4, credentials);
      expect(result4).toEqual(finalResponse);
    });

    it('should handle mixed operation types without state interference', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();

      // Setup different responses for different operations
      const availabilityResponse = { available: true, slots: [], location: { id: 1, name: 'Test Location' } };
      const bookingResponse = { id: 123, status: 'CONFIRMED', locationId: 1 };
      const locationResponse = { id: 1, name: 'Test Location', capacity: 10 };

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(availabilityResponse), {
          status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(bookingResponse), {
          status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(locationResponse), {
          status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }
        }));

      // Mix different operation types
      const availabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const bookingRequest: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        locationId: 1,
        attendees: [],
        extraRequests: [],
        bookingGroup: {
          id: 1,
          type: 'REPEAT',
          repeatKind: 'WORK_DAILY',
          repeatStartDate: '2023-12-01T00:00:00.000',
          repeatEndDate: '2024-01-01',
          repeatText: 'Repeats every weekday until Jan 1, 2024',
          status: 'BOOKED',
          firstBookingStatus: 'CONFIRMED'
        },
        owner: { id: 1, email: 'test@example.com', name: 'Test User' },
        ownerIsAttendee: true,
        source: 'WEB'
      };

      // Execute operations in sequence - each should be independent
      const result1 = await client.checkAvailability(availabilityRequest, credentials);
      const result2 = await client.createBooking(bookingRequest, credentials);
      const result3 = await client.getLocation(1, credentials);

      expect(result1).toEqual(availabilityResponse);
      expect(result2).toEqual(bookingResponse);
      expect(result3).toEqual(locationResponse);

      // Verify no cross-contamination by repeating first operation
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(availabilityResponse), {
        status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }
      }));

      const result4 = await client.checkAvailability(availabilityRequest, credentials);
      expect(result4).toEqual(availabilityResponse);
    });
  });

  describe('Independent Error Handling Per Request', () => {
    it('should handle errors independently without affecting subsequent requests', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Series of different error types
      const errors = [
        // Timeout error
        (() => { const e = new Error(); e.name = 'AbortError'; return e; })(),
        // Network error
        new Error('ECONNREFUSED'),
        // API error (HTTP 404)
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
        // API error (HTTP 500)
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      ];

      const errorResults = [];

      // Test each error type
      for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        
        if (error instanceof Response) {
          mockFetch.mockResolvedValueOnce(error);
        } else {
          mockFetch.mockRejectedValueOnce(error);
        }

        try {
          await client.checkAvailability(mockRequest, credentials);
          expect.fail(`Expected error for case ${i}`);
        } catch (caughtError) {
          errorResults.push(caughtError);
        }
      }

      // Each error should be independent with unique request IDs
      const requestIds = errorResults.map(error => {
        const errorWithResponse = error as Error & { errorResponse?: any };
        return errorWithResponse.errorResponse?.requestId;
      });

      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(errors.length);

      // After errors, normal requests should work fine
      const successResponse = { available: true, slots: [], location: { id: 1, name: 'Test Location' } };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(successResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const successResult = await client.checkAvailability(mockRequest, credentials);
      expect(successResult).toEqual(successResponse);
    });

    it('should generate unique request IDs for all requests', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const numRequests = 50;
      const requestIds: string[] = [];

      // Generate errors to capture request IDs
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      for (let i = 0; i < numRequests; i++) {
        try {
          await client.checkAvailability(mockRequest, credentials);
          expect.fail('Expected timeout error');
        } catch (error) {
          const errorWithResponse = error as Error & { errorResponse?: any };
          const requestId = errorWithResponse.errorResponse?.requestId;
          expect(requestId).toBeDefined();
          requestIds.push(requestId);
        }
      }

      // All request IDs should be unique
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(numRequests);
    });
  });

  describe('Performance Characteristics of Stateless Design', () => {
    it.skip('should maintain consistent performance regardless of request history', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockResponse = { available: true, slots: [], location: { id: 1, name: 'Test Location' } };

      // Measure performance of first batch of requests
      const firstBatchSize = 20;
      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      const firstBatchStart = Date.now();
      for (let i = 0; i < firstBatchSize; i++) {
        await client.checkAvailability(mockRequest, credentials);
      }
      const firstBatchDuration = Date.now() - firstBatchStart;
      const firstBatchAverage = firstBatchDuration / firstBatchSize;

      // Measure performance after many requests (state should not accumulate)
      const secondBatchSize = 20;
      const secondBatchStart = Date.now();
      for (let i = 0; i < secondBatchSize; i++) {
        await client.checkAvailability(mockRequest, credentials);
      }
      const secondBatchDuration = Date.now() - secondBatchStart;
      const secondBatchAverage = secondBatchDuration / secondBatchSize;

      // Performance should be consistent (within reasonable variance for test environments)
      const performanceRatio = Math.max(firstBatchAverage, secondBatchAverage) / Math.min(firstBatchAverage, secondBatchAverage);
      expect(performanceRatio).toBeLessThan(5.0); // Generous threshold for various CI/test environments

      console.error(`First batch average: ${firstBatchAverage.toFixed(2)}ms per request`);
      console.error(`Second batch average: ${secondBatchAverage.toFixed(2)}ms per request`);
      console.error(`Performance ratio: ${performanceRatio.toFixed(2)}`);
    });

    it('should scale linearly with concurrent requests', async () => {
      const configManager = new ConfigurationManager(false);
      const authManager = new AuthenticationManager(configManager);
      const errorHandler = new ErrorHandler();
      const client = new MatrixAPIClient(authManager, configManager, errorHandler);

      const credentials = authManager.getCredentials();
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockResponse = { available: true, slots: [], location: { id: 1, name: 'Test Location' } };

      // Mock with small delay to measure concurrency benefits
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          })), 20)
        )
      );

      const testCases = [5, 10, 20]; // Different concurrency levels
      const results: { concurrency: number; duration: number; avgPerRequest: number }[] = [];

      for (const concurrency of testCases) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: concurrency }, () => 
          client.checkAvailability(mockRequest, credentials)
        );
        
        await Promise.all(promises);
        
        const duration = Date.now() - startTime;
        const avgPerRequest = duration / concurrency;
        
        results.push({ concurrency, duration, avgPerRequest });
      }

      // Log results for analysis
      results.forEach(result => {
        console.error(`Concurrency ${result.concurrency}: ${result.duration}ms total, ${result.avgPerRequest.toFixed(2)}ms average per request`);
      });

      // With proper stateless design, higher concurrency should not significantly degrade per-request performance
      // The last test (highest concurrency) should not be more than 2x slower per request than the first
      const firstAvg = results[0]?.avgPerRequest;
      const lastAvg = results[results.length - 1]?.avgPerRequest;
      const scalingRatio = (lastAvg && firstAvg) ? lastAvg / firstAvg : 0;
      
      expect(scalingRatio).toBeLessThan(2.0);
      console.error(`Scaling ratio (highest/lowest concurrency): ${scalingRatio.toFixed(2)}`);
    });
  });
});