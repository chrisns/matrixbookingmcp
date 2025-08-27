import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../src/config/config-manager.js';
import { IAvailabilityRequest } from '../../src/types/availability.types.js';
import { IBookingRequest } from '../../src/types/booking.types.js';
import { IAPIRequest } from '../../src/types/api.types.js';
import { IErrorHandler } from '../../src/types/error.types.js';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe.skip('Performance and Timeout Testing', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockErrorHandler: IErrorHandler;
  let mockCredentials: ICredentials;
  let mockConfig: IServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use real timers for timeout tests since fake timers don't work well with AbortController
    vi.useRealTimers();

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
      apiTimeout: 5000, // 5 second timeout
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

    mockErrorHandler = {
      handleError: vi.fn(),
      handleTimeout: vi.fn().mockReturnValue({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 408,
        requestId: 'test-request-id'
      }),
      handleAPIError: vi.fn(),
      handleNetworkError: vi.fn()
    };

    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('5-Second Timeout Enforcement', () => {
    it('should timeout checkAvailability requests after exactly 5 seconds', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Mock fetch to simulate a hanging request
      mockFetch.mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          // Use real timers to simulate timeout behavior
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 5000);
        });
      });

      const startTime = Date.now();
      await expect(client.checkAvailability(mockRequest, mockCredentials))
        .rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(4800); // Allow some variance
      expect(duration).toBeLessThan(5500);    // But not too much
    }, 15000); // Increase test timeout to allow for actual timeout

    it('should timeout createBooking requests after exactly 5 seconds', async () => {
      const mockRequest: IBookingRequest = {
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

      mockFetch.mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 5000);
        });
      });

      const startTime = Date.now();
      await expect(client.createBooking(mockRequest, mockCredentials))
        .rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(4800);
      expect(duration).toBeLessThan(5500);
    }, 15000);

    it('should timeout getLocation requests after exactly 5 seconds', async () => {
      const locationId = 1;

      mockFetch.mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 5000);
        });
      });

      const startTime = Date.now();
      await expect(client.getLocation(locationId, mockCredentials))
        .rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(4800);
      expect(duration).toBeLessThan(5500);
    }, 15000);

    it('should NOT timeout requests that complete before 5 seconds', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      // Create a promise that resolves after 3 seconds (before timeout)
      const fastPromise = new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        }, 3000);
      });

      mockFetch.mockReturnValue(fastPromise as any);

      const requestPromise = client.checkAvailability(mockRequest, mockCredentials);

      // Fast-forward time by 3 seconds (before timeout)
      vi.advanceTimersByTime(3000);

      const result = await requestPromise;

      expect(result).toEqual(mockResponse);
      expect(mockErrorHandler.handleTimeout).not.toHaveBeenCalled();
    });

    it('should timeout requests that take exactly 5001ms', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const hangingPromise = new Promise(() => {});
      mockFetch.mockReturnValue(hangingPromise as any);

      const requestPromise = client.makeRequest(mockRequest);

      // Fast-forward time by 5001ms (just over timeout)
      vi.advanceTimersByTime(5001);

      await expect(requestPromise).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Timeout Configuration', () => {
    it('should respect custom timeout values from configuration', async () => {
      // Create client with custom 3-second timeout
      const customConfig: IServerConfig = {
        ...mockConfig,
        apiTimeout: 3000 // 3 second timeout
      };

      const customConfigManager = {
        getConfig: vi.fn().mockReturnValue(customConfig),
        validateConfig: vi.fn()
      };

      const customClient = new MatrixAPIClient(mockAuthManager, customConfigManager, mockErrorHandler);

      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const hangingPromise = new Promise(() => {});
      mockFetch.mockReturnValue(hangingPromise as any);

      const requestPromise = customClient.makeRequest(mockRequest);

      // Should timeout at 3 seconds, not 5
      vi.advanceTimersByTime(3000);

      await expect(requestPromise).rejects.toThrow();
      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });

    it('should not timeout before custom timeout period', async () => {
      const customConfig: IServerConfig = {
        ...mockConfig,
        apiTimeout: 7000 // 7 second timeout
      };

      const customConfigManager = {
        getConfig: vi.fn().mockReturnValue(customConfig),
        validateConfig: vi.fn()
      };

      const customClient = new MatrixAPIClient(mockAuthManager, customConfigManager, mockErrorHandler);

      const mockResponse = { success: true };
      // Create a promise that resolves after 6 seconds
      const slowPromise = new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify(mockResponse), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        }, 6000);
      });

      mockFetch.mockReturnValue(slowPromise as any);

      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const requestPromise = customClient.makeRequest(mockRequest);

      // Advance to 6 seconds (before 7 second timeout)
      vi.advanceTimersByTime(6000);

      const result = await requestPromise;
      expect(result.data).toEqual(mockResponse);
      expect(mockErrorHandler.handleTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Request Timeout Behavior', () => {
    it('should handle multiple concurrent requests timing out independently', async () => {
      const mockRequest1: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test1',
        headers: { 'Authorization': 'Bearer token' }
      };

      const mockRequest2: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test2',
        headers: { 'Authorization': 'Bearer token' }
      };

      const hangingPromise1 = new Promise(() => {});
      const hangingPromise2 = new Promise(() => {});

      // Mock different hanging promises for concurrent requests
      mockFetch
        .mockReturnValueOnce(hangingPromise1 as any)
        .mockReturnValueOnce(hangingPromise2 as any);

      const requestPromise1 = client.makeRequest(mockRequest1);
      const requestPromise2 = client.makeRequest(mockRequest2);

      // Fast-forward time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Both requests should timeout independently
      await expect(requestPromise1).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      await expect(requestPromise2).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      // Timeout handler should be called twice (once for each request)
      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed scenario where some requests timeout and others complete', async () => {
      const mockRequest1: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/slow',
        headers: { 'Authorization': 'Bearer token' }
      };

      const mockRequest2: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/fast',
        headers: { 'Authorization': 'Bearer token' }
      };

      const hangingPromise = new Promise(() => {});
      const fastPromise = new Promise(resolve => {
        setTimeout(() => {
          resolve(new Response(JSON.stringify({ success: true }), {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' }
          }));
        }, 2000);
      });

      mockFetch
        .mockReturnValueOnce(hangingPromise as any)  // First request hangs
        .mockReturnValueOnce(fastPromise as any);    // Second request completes quickly

      const slowRequestPromise = client.makeRequest(mockRequest1);
      const fastRequestPromise = client.makeRequest(mockRequest2);

      // Advance time by 2 seconds - fast request should complete
      vi.advanceTimersByTime(2000);

      const fastResult = await fastRequestPromise;
      expect(fastResult.data).toEqual({ success: true });

      // Advance time to 5 seconds total - slow request should timeout
      vi.advanceTimersByTime(3000); // 2000 + 3000 = 5000ms total

      await expect(slowRequestPromise).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      // Only one timeout should occur
      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('AbortController Signal Behavior', () => {
    it('should properly abort fetch requests using AbortController signal', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      // Mock fetch to return a promise that can be aborted
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      
      mockFetch.mockImplementation((_url, options) => {
        // Simulate the AbortController signal behavior
        if (options?.signal) {
          return new Promise((_resolve, reject) => {
            const signal = options.signal as AbortSignal;
            if (signal.aborted) {
              reject(abortError);
            } else {
              signal.addEventListener('abort', () => reject(abortError));
            }
          });
        }
        return Promise.resolve(new Response());
      });

      const requestPromise = client.makeRequest(mockRequest);

      // Fast-forward time by 5 seconds to trigger timeout
      vi.advanceTimersByTime(5000);

      await expect(requestPromise).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      
      // Verify that fetch was called with an AbortSignal
      expect(mockFetch).toHaveBeenCalledWith(
        mockRequest.url,
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });

    it('should clear timeout when request completes successfully', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const mockResponse = { success: true };
      const successPromise = Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      mockFetch.mockReturnValue(successPromise as any);

      const result = await client.makeRequest(mockRequest);

      expect(result.data).toEqual(mockResponse);
      
      // Even if we advance time after success, no timeout should occur
      vi.advanceTimersByTime(10000);
      
      expect(mockErrorHandler.handleTimeout).not.toHaveBeenCalled();
    });
  });
});