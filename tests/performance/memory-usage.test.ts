import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../src/config/config-manager.js';
import { IAvailabilityRequest } from '../../src/types/availability.types.js';
import { IBookingRequest } from '../../src/types/booking.types.js';
import { ErrorHandler } from '../../src/error/error-handler.js';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Memory Usage Performance Testing', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockCredentials: ICredentials;
  let mockConfig: IServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    const username = 'testuser';
    const password = 'testpass';
    const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    mockCredentials = {
      username,
      password,
      encodedCredentials
    };

    mockConfig = {
      matrixUsername: 'testuser',
      matrixPassword: 'testpass',
      matrixPreferredLocation: 'London',
      apiTimeout: 5000,
      apiBaseUrl: 'https://app.matrixbooking.com/api/v1'
    };

    mockAuthManager = {
      getCredentials: vi.fn().mockReturnValue(mockCredentials),
      encodeCredentials: vi.fn().mockReturnValue(encodedCredentials),
      createAuthHeader: vi.fn(),
      getCurrentUser: vi.fn().mockReturnValue({
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/json;charset=UTF-8',
        'x-matrix-source': 'WEB',
        'x-time-zone': 'Europe/London'
      })
    };

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue(mockConfig),
      validateConfig: vi.fn()
    };

    // Use real ErrorHandler to test memory usage patterns
    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, new ErrorHandler());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Memory Usage During Extended Operation', () => {
    it('should maintain stable memory usage during repeated successful requests', async () => {
      const mockAvailabilityResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockAvailabilityResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      const initialMemory = process.memoryUsage();
      const memorySnapshots: NodeJS.MemoryUsage[] = [initialMemory];

      const numRequests = 100;
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Perform repeated requests
      for (let i = 0; i < numRequests; i++) {
        await client.checkAvailability(mockRequest, mockCredentials);
        
        // Take memory snapshots every 10 requests
        if (i % 10 === 9) {
          // Force garbage collection if available (V8 specific)
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push(process.memoryUsage());
        }
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      expect(finalMemory).toBeDefined();
      const memoryIncrease = finalMemory!.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB for 100 requests)
      const maxAllowedIncrease = 10 * 1024 * 1024; // 10MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      
      // Verify requests were made
      expect(mockFetch).toHaveBeenCalledTimes(numRequests);

      console.error(`Memory usage test results:`);
      console.error(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Final heap: ${(finalMemory!.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should not leak memory during error scenarios', async () => {
      // Mock error responses
      mockFetch.mockResolvedValue(new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error'
      }));

      const initialMemory = process.memoryUsage();
      const numRequests = 50;
      
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Perform repeated requests that will error
      for (let i = 0; i < numRequests; i++) {
        try {
          await client.checkAvailability(mockRequest, mockCredentials);
        } catch (error) {
          // Expected errors, continue
        }
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal even with errors
      const maxAllowedIncrease = 5 * 1024 * 1024; // 5MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      
      expect(mockFetch).toHaveBeenCalledTimes(numRequests);

      console.error(`Error scenario memory test results:`);
      console.error(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle concurrent requests without excessive memory consumption', async () => {
      const mockResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      // Mock with slight delay to simulate real network conditions
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          })), 10)
        )
      );

      const initialMemory = process.memoryUsage();
      const numConcurrentRequests = 50;
      
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Create concurrent requests
      const requestPromises = Array.from({ length: numConcurrentRequests }, (_, _i) => 
        client.checkAvailability(mockRequest, mockCredentials)
      );

      // Wait for all requests to complete
      const results = await Promise.all(requestPromises);

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable for concurrent requests
      const maxAllowedIncrease = 8 * 1024 * 1024; // 8MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      
      // All requests should complete successfully
      expect(results).toHaveLength(numConcurrentRequests);
      results.forEach(result => {
        expect(result).toEqual(mockResponse);
      });

      expect(mockFetch).toHaveBeenCalledTimes(numConcurrentRequests);

      console.error(`Concurrent requests memory test results:`);
      console.error(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should maintain stable memory during mixed operation types', async () => {
      const mockAvailabilityResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      const mockBookingResponse = {
        id: 123,
        status: 'CONFIRMED',
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockLocationResponse = {
        id: 1,
        name: 'Test Location',
        capacity: 10,
        features: ['WiFi', 'Projector']
      };

      // Mock different responses for different endpoints
      mockFetch.mockImplementation((url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/availability')) {
          return Promise.resolve(new Response(JSON.stringify(mockAvailabilityResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        } else if (urlStr.includes('/booking')) {
          return Promise.resolve(new Response(JSON.stringify(mockBookingResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        } else if (urlStr.includes('/location')) {
          return Promise.resolve(new Response(JSON.stringify(mockLocationResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const initialMemory = process.memoryUsage();
      const numIterations = 30;

      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockBookingRequest: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        locationId: 1,
        attendees: [],
        extraRequests: [],
        bookingGroup: { repeatEndDate: '2024-01-01' },
        owner: { id: 1, email: 'test@example.com', name: 'Test User' },
        ownerIsAttendee: true,
        source: 'WEB'
      };

      // Perform mixed operations
      for (let i = 0; i < numIterations; i++) {
        await client.checkAvailability(mockAvailabilityRequest, mockCredentials);
        await client.createBooking(mockBookingRequest, mockCredentials);
        await client.getLocation(1, mockCredentials);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable for mixed operations
      const maxAllowedIncrease = 12 * 1024 * 1024; // 12MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      
      // Verify all operations were performed
      expect(mockFetch).toHaveBeenCalledTimes(numIterations * 3);

      console.error(`Mixed operations memory test results:`);
      console.error(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Garbage Collection and Resource Cleanup', () => {
    it('should properly clean up AbortController and timeout resources', async () => {
      const mockResponse = { success: true };
      
      // Mock successful responses that resolve immediately for faster test
      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',  
        headers: { 'content-type': 'application/json' }
      })));

      const initialMemory = process.memoryUsage();
      const numRequests = 100;

      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Perform requests that complete before timeout
      for (let i = 0; i < numRequests; i++) {
        await client.checkAvailability(mockAvailabilityRequest, mockCredentials);
        
        // Periodic garbage collection
        if (i % 20 === 19 && global.gc) {
          global.gc();
        }
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Resources should be cleaned up properly
      const maxAllowedIncrease = 5 * 1024 * 1024; // 5MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      
      expect(mockFetch).toHaveBeenCalledTimes(numRequests);

      console.error(`Resource cleanup memory test results:`);
      console.error(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.error(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Memory Profiling Utilities', () => {
    it('should provide memory usage reporting helper', () => {
      const getMemoryReport = () => {
        const usage = process.memoryUsage();
        return {
          heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
          externalMB: Math.round(usage.external / 1024 / 1024 * 100) / 100,
          rssUsedMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100
        };
      };

      const report = getMemoryReport();
      
      expect(typeof report.heapUsedMB).toBe('number');
      expect(typeof report.heapTotalMB).toBe('number');
      expect(typeof report.externalMB).toBe('number');
      expect(typeof report.rssUsedMB).toBe('number');
      
      expect(report.heapUsedMB).toBeGreaterThan(0);
      expect(report.heapTotalMB).toBeGreaterThan(0);
      
      console.error('Memory report:', report);
    });
  });
});