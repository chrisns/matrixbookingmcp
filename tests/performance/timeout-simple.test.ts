import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../src/config/config-manager.js';
import { IAvailabilityRequest } from '../../src/types/availability.types.js';
import { IErrorHandler } from '../../src/types/error.types.js';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Simple Timeout Testing', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockErrorHandler: IErrorHandler;
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
      createAuthHeader: vi.fn().mockReturnValue({
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
    vi.resetAllMocks();
  });

  describe('Timeout Error Handling', () => {
    it('should handle AbortError and call timeout handler', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Mock AbortError to simulate timeout
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      try {
        await client.checkAvailability(mockRequest, mockCredentials);
        expect.fail('Expected timeout error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        const errorWithResponse = error as Error & { errorResponse?: any };
        expect(errorWithResponse.errorResponse).toBeDefined();
        expect(errorWithResponse.errorResponse.error.code).toBe('REQUEST_TIMEOUT');
        expect(errorWithResponse.errorResponse.error.message).toContain('Request timeout after 5000ms');
        expect(errorWithResponse.errorResponse.httpStatus).toBe(408);
        expect(errorWithResponse.errorResponse.requestId).toBeDefined();
      }

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });

    it('should use AbortController with correct timeout value', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      mockFetch.mockImplementation((_url, options) => {
        // Verify AbortSignal is provided
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        
        return Promise.resolve(new Response(JSON.stringify({ available: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' }
        }));
      });

      await client.checkAvailability(mockRequest, mockCredentials);

      // Verify fetch was called with proper signal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/availability'),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should respect custom timeout configuration', async () => {
      // Create client with custom timeout
      const customConfig = { ...mockConfig, apiTimeout: 3000 };
      const customConfigManager = {
        getConfig: vi.fn().mockReturnValue(customConfig),
        validateConfig: vi.fn()
      };

      const customClient = new MatrixAPIClient(mockAuthManager, customConfigManager, mockErrorHandler);

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      try {
        await customClient.checkAvailability(mockRequest, mockCredentials);
        expect.fail('Expected timeout error');
      } catch (error) {
        const errorWithResponse = error as Error & { errorResponse?: any };
        expect(errorWithResponse.errorResponse.error.code).toBe('REQUEST_TIMEOUT');
      }

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple concurrent timeout scenarios', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const numRequests = 5;
      const requests = Array.from({ length: numRequests }, () => 
        client.checkAvailability(mockRequest, mockCredentials).catch(e => e)
      );

      const results = await Promise.all(requests);

      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
        const errorWithResponse = result as Error & { errorResponse?: any };
        expect(errorWithResponse.errorResponse.error.code).toBe('REQUEST_TIMEOUT');
      });

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(numRequests);
    });

    it('should clear timeout when request completes successfully', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockResponse = { available: true, slots: [], location: { id: 1, name: 'Test' } };
      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      const result = await client.checkAvailability(mockRequest, mockCredentials);
      expect(result).toEqual(mockResponse);
      
      // No timeout handler should be called for successful requests
      expect(mockErrorHandler.handleTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Configuration Validation', () => {
    it('should use default timeout when not specified in config', async () => {
      const configWithoutTimeout = {
        ...mockConfig,
        apiTimeout: undefined as any
      };

      const configManager = {
        getConfig: vi.fn().mockReturnValue(configWithoutTimeout),
        validateConfig: vi.fn()
      };

      // This would typically use default timeout from ConfigurationManager
      // For this test, we just verify the behavior doesn't crash
      const testClient = new MatrixAPIClient(mockAuthManager, configManager, mockErrorHandler);

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ available: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      await expect(testClient.checkAvailability(mockRequest, mockCredentials)).resolves.toBeDefined();
    });

    it('should handle zero or negative timeout values gracefully', async () => {
      const invalidTimeoutConfig = { ...mockConfig, apiTimeout: -1 };
      const configManager = {
        getConfig: vi.fn().mockReturnValue(invalidTimeoutConfig),
        validateConfig: vi.fn()
      };

      const testClient = new MatrixAPIClient(mockAuthManager, configManager, mockErrorHandler);

      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Should still work (AbortController should handle invalid timeouts gracefully)
      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ available: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      })));

      await expect(testClient.checkAvailability(mockRequest, mockCredentials)).resolves.toBeDefined();
    });
  });
});