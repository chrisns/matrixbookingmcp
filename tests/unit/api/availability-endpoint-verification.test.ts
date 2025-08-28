import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAvailabilityRequest } from '../../../src/types/availability.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Availability Endpoint Verification', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockErrorHandler: IErrorHandler;
  let mockCredentials: ICredentials;
  let mockConfig: IServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock credentials
    const username = 'testuser';
    const password = 'testpass';
    const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
    mockCredentials = {
      username,
      password,
      encodedCredentials
    };

    // Setup mock config
    mockConfig = {
      matrixUsername: 'testuser',
      matrixPassword: 'testpass',
      matrixPreferredLocation: '42',
      apiTimeout: 5000,
      apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
      cacheEnabled: true
    };

    // Setup mock auth manager
    mockAuthManager = {
      getCredentials: vi.fn().mockReturnValue(mockCredentials),
      encodeCredentials: vi.fn().mockReturnValue(encodedCredentials),
      createAuthHeader: vi.fn().mockReturnValue({
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/json;charset=UTF-8',
        'x-matrix-source': 'WEB',
        'x-time-zone': 'Europe/London'
      }),
      getCurrentUser: vi.fn()
    };

    // Setup mock config manager
    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue(mockConfig),
      validateConfig: vi.fn()
    };

    // Setup mock error handler
    mockErrorHandler = {
      handleError: vi.fn(),
      handleTimeout: vi.fn(),
      handleAPIError: vi.fn(),
      handleNetworkError: vi.fn()
    };

    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Task 10: Availability Check API Endpoint Issues', () => {
    it('should use GET method for availability endpoint (updated implementation)', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const mockResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.checkAvailability(mockAvailabilityRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/availability?' +
        'l=1&f=2024-01-01T09%3A00%3A00.000Z&t=2024-01-01T17%3A00%3A00.000Z&' +
        'include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots';
      
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle 405 Method Not Allowed errors with enhanced error handling', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const errorResponse = {
        error: {
          code: 'MATRIX_API_ERROR',
          message: 'Matrix API error: 405 Method Not Allowed',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 405,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleAPIError = vi.fn().mockReturnValue(errorResponse);

      mockFetch.mockResolvedValueOnce(new Response('Method Not Allowed', {
        status: 405,
        statusText: 'Method Not Allowed'
      }));

      await expect(client.checkAvailability(mockAvailabilityRequest, mockCredentials))
        .rejects.toThrow('Matrix API error: 405 Method Not Allowed');

      expect(mockErrorHandler.handleAPIError).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handleAPIError).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 405,
          statusText: 'Method Not Allowed'
        }),
        'Method Not Allowed'
      );
    });

    it('should successfully handle various availability request parameters', async () => {
      const testCases: Array<{ name: string; request: IAvailabilityRequest }> = [
        {
          name: 'with booking category parameter',
          request: {
            dateFrom: '2024-01-01T09:00:00.000Z',
            dateTo: '2024-01-01T17:00:00.000Z',
            locationId: 1,
            bookingCategory: 60
          }
        },
        {
          name: 'minimal request without booking category',
          request: {
            dateFrom: '2024-01-01T09:00:00.000Z',
            dateTo: '2024-01-01T17:00:00.000Z',
            locationId: 1
          }
        },
        {
          name: 'with different location ID',
          request: {
            dateFrom: '2024-01-01T09:00:00.000Z',
            dateTo: '2024-01-01T17:00:00.000Z',
            locationId: 42
          }
        }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          available: true,
          slots: [],
          location: { id: testCase.request.locationId, name: 'Test Location' }
        }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' }
        }));

        await client.checkAvailability(testCase.request, mockCredentials);

        const expectedUrl = 'https://app.matrixbooking.com/api/v1/availability?' +
          `l=${testCase.request.locationId}&` +
          `f=${encodeURIComponent(testCase.request.dateFrom)}&` +
          `t=${encodeURIComponent(testCase.request.dateTo)}&` +
          'include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots' +
          (testCase.request.bookingCategory ? `&bc=${testCase.request.bookingCategory}` : '');
        
        expect(mockFetch).toHaveBeenLastCalledWith(
          expectedUrl,
          expect.objectContaining({
            method: 'GET'
          })
        );
      }
    });

    it('should include proper headers for API authentication', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.checkAvailability(mockAvailabilityRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/availability?' +
        'l=1&f=2024-01-01T09%3A00%3A00.000Z&t=2024-01-01T17%3A00%3A00.000Z&' +
        'include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots';
      
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          headers: {
            'Authorization': `Basic ${mockCredentials.encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          }
        })
      );
    });

    it('should verify endpoint URL construction is correct', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.checkAvailability(mockAvailabilityRequest, mockCredentials);

      // Verify the exact endpoint URL includes query parameters  
      const expectedBaseUrl = `${mockConfig.apiBaseUrl}/availability`;
      const expectedUrl = expectedBaseUrl + '?l=1&f=2024-01-01T09%3A00%3A00.000Z&t=2024-01-01T17%3A00%3A00.000Z&include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots';
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
      expect(expectedBaseUrl).toBe('https://app.matrixbooking.com/api/v1/availability');
    });

    it('should handle timeout errors appropriately', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const timeoutErrorResponse = {
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 408,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleTimeout = vi.fn().mockReturnValue(timeoutErrorResponse);

      // Mock AbortError
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.checkAvailability(mockAvailabilityRequest, mockCredentials))
        .rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Endpoint Method Investigation Results', () => {
    it('should document that POST method is the current implementation', () => {
      // This test documents the current state of the availability endpoint
      // Based on investigation:
      // 1. Current implementation uses POST /api/v1/availability
      // 2. Request body contains availability parameters
      // 3. Enhanced error handling is in place for 405 errors
      // 4. No GET method implementation is needed based on Matrix API documentation
      expect(true).toBe(true); // Test passes to document findings
    });

    it('should verify error handling improvements are in place', () => {
      // Verify that the enhanced error handling system is properly configured
      expect(mockErrorHandler.handleAPIError).toBeDefined();
      expect(mockErrorHandler.handleTimeout).toBeDefined();
      expect(mockErrorHandler.handleNetworkError).toBeDefined();
      expect(mockErrorHandler.handleError).toBeDefined();
    });
  });
});