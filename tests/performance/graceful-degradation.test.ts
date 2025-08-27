import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../src/config/config-manager.js';
import { IAvailabilityRequest } from '../../src/types/availability.types.js';
import { IBookingRequest } from '../../src/types/booking.types.js';
import { IErrorHandler } from '../../src/types/error.types.js';
import { ErrorHandler } from '../../src/error/error-handler.js';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Graceful Degradation and Error Handling Performance', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let realErrorHandler: IErrorHandler;
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

    // Use real ErrorHandler to test actual graceful degradation behavior
    realErrorHandler = new ErrorHandler();
    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, realErrorHandler);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Timeout Error Handling and Graceful Degradation', () => {
    it('should provide meaningful timeout error messages', async () => {
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
        expect(errorWithResponse.errorResponse.error.message).toContain('Matrix Booking API did not respond');
        expect(errorWithResponse.errorResponse.httpStatus).toBe(408);
        expect(errorWithResponse.errorResponse.requestId).toBeDefined();
      }
    });

    it('should handle multiple concurrent timeouts gracefully', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const numConcurrentRequests = 20;
      const requestPromises = Array.from({ length: numConcurrentRequests }, () => 
        client.checkAvailability(mockRequest, mockCredentials).catch(error => error)
      );

      const results = await Promise.all(requestPromises);

      // All requests should result in timeout errors
      results.forEach((result, _index) => {
        expect(result).toBeInstanceOf(Error);
        
        const errorWithResponse = result as Error & { errorResponse?: any };
        expect(errorWithResponse.errorResponse).toBeDefined();
        expect(errorWithResponse.errorResponse.error.code).toBe('REQUEST_TIMEOUT');
        expect(errorWithResponse.errorResponse.httpStatus).toBe(408);
        
        // Each error should have a unique request ID
        expect(errorWithResponse.errorResponse.requestId).toBeDefined();
        expect(typeof errorWithResponse.errorResponse.requestId).toBe('string');
      });

      // Verify all errors have unique request IDs
      const requestIds = results.map(result => {
        const errorWithResponse = result as Error & { errorResponse?: any };
        return errorWithResponse.errorResponse.requestId;
      });
      
      const uniqueRequestIds = new Set(requestIds);
      expect(uniqueRequestIds.size).toBe(numConcurrentRequests);
    });

    it('should maintain service availability after timeout events', async () => {
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

      // First request times out
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      try {
        await client.checkAvailability(mockRequest, mockCredentials);
        expect.fail('Expected timeout error');
      } catch (error) {
        const errorWithResponse = error as Error & { errorResponse?: any };
        expect(errorWithResponse.errorResponse.error.code).toBe('REQUEST_TIMEOUT');
      }

      // Subsequent request should work normally (service recovery)
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.checkAvailability(mockRequest, mockCredentials);
      expect(result).toEqual(mockResponse);
    });

    it('should handle timeout during different operation types consistently', async () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

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

      // Test availability timeout
      const availabilityError = await client.checkAvailability(mockAvailabilityRequest, mockCredentials).catch(e => e);
      const availabilityErrorResponse = (availabilityError as Error & { errorResponse?: any }).errorResponse;

      // Test booking timeout
      const bookingError = await client.createBooking(mockBookingRequest, mockCredentials).catch(e => e);
      const bookingErrorResponse = (bookingError as Error & { errorResponse?: any }).errorResponse;

      // Test location timeout
      const locationError = await client.getLocation(1, mockCredentials).catch(e => e);
      const locationErrorResponse = (locationError as Error & { errorResponse?: any }).errorResponse;

      // All should have consistent timeout error structure
      [availabilityErrorResponse, bookingErrorResponse, locationErrorResponse].forEach(errorResponse => {
        expect(errorResponse.error.code).toBe('REQUEST_TIMEOUT');
        expect(errorResponse.error.message).toContain('Request timeout after 5000ms');
        expect(errorResponse.httpStatus).toBe(408);
        expect(errorResponse.requestId).toBeDefined();
        expect(errorResponse.error.timestamp).toBeDefined();
      });

      // Each should have unique request ID
      const requestIds = [availabilityErrorResponse, bookingErrorResponse, locationErrorResponse]
        .map(response => response.requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Network Error Graceful Degradation', () => {
    it('should handle network failures gracefully after timeouts', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // First - timeout error
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const timeoutError = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const timeoutErrorResponse = (timeoutError as Error & { errorResponse?: any }).errorResponse;
      expect(timeoutErrorResponse.error.code).toBe('REQUEST_TIMEOUT');

      // Second - network error
      const networkError = new Error('ECONNREFUSED');
      mockFetch.mockRejectedValueOnce(networkError);

      const connError = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const connErrorResponse = (connError as Error & { errorResponse?: any }).errorResponse;
      expect(connErrorResponse.error.code).toBe('CONNECTION_REFUSED');

      // Third - DNS error
      const dnsError = new Error('ENOTFOUND api.example.com');
      mockFetch.mockRejectedValueOnce(dnsError);

      const dnsErrResult = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const dnsErrorResponse = (dnsErrResult as Error & { errorResponse?: any }).errorResponse;
      expect(dnsErrorResponse.error.code).toBe('DNS_ERROR');

      // All errors should have proper structure and unique IDs
      const allRequestIds = [
        timeoutErrorResponse.requestId,
        connErrorResponse.requestId, 
        dnsErrorResponse.requestId
      ];
      
      const uniqueIds = new Set(allRequestIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should provide appropriate error codes for different network conditions', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const testCases = [
        { error: new Error('ECONNREFUSED'), expectedCode: 'CONNECTION_REFUSED' },
        { error: new Error('ENOTFOUND'), expectedCode: 'DNS_ERROR' },
        { error: new Error('ETIMEDOUT'), expectedCode: 'CONNECTION_TIMEOUT' },
        { error: (() => { const e = new Error(); e.name = 'AbortError'; return e; })(), expectedCode: 'REQUEST_TIMEOUT' },
        { error: new Error('Some other network error'), expectedCode: 'NETWORK_ERROR' }
      ];

      for (const testCase of testCases) {
        mockFetch.mockRejectedValueOnce(testCase.error);
        
        const error = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
        const errorResponse = (error as Error & { errorResponse?: any }).errorResponse;
        
        expect(errorResponse.error.code).toBe(testCase.expectedCode);
        expect(errorResponse.requestId).toBeDefined();
        expect(errorResponse.error.timestamp).toBeDefined();
      }
    });
  });

  describe('API Error Response Handling', () => {
    it('should handle Matrix API errors gracefully after timeout scenarios', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // First - timeout
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const timeoutError = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const timeoutErrorResponse = (timeoutError as Error & { errorResponse?: any }).errorResponse;
      expect(timeoutErrorResponse.error.code).toBe('REQUEST_TIMEOUT');

      // Second - API error (should still work properly)
      const apiErrorBody = {
        message: 'Location not found',
        code: 'LOCATION_NOT_FOUND'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(apiErrorBody), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' }
      }));

      const apiError = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const apiErrorResponse = (apiError as Error & { errorResponse?: any }).errorResponse;
      
      expect(apiErrorResponse.error.code).toBe('LOCATION_NOT_FOUND');
      expect(apiErrorResponse.error.message).toBe('Location not found');
      expect(apiErrorResponse.httpStatus).toBe(404);

      // Request IDs should be different
      expect(timeoutErrorResponse.requestId).not.toBe(apiErrorResponse.requestId);
    });

    it('should preserve original Matrix API error details during degradation', async () => {
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const originalMatrixError = {
        message: 'Invalid date range provided',
        code: 'INVALID_DATE_RANGE',
        details: {
          dateFrom: '2024-01-01T09:00:00.000',
          dateTo: '2024-01-01T17:00:00.000',
          issue: 'Date range exceeds maximum allowed duration'
        }
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(originalMatrixError), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' }
      }));

      const error = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
      const errorResponse = (error as Error & { errorResponse?: any }).errorResponse;

      // Original error details should be preserved
      expect(errorResponse.error.code).toBe('INVALID_DATE_RANGE');
      expect(errorResponse.error.message).toBe('Invalid date range provided');
      expect(errorResponse.error.details).toEqual(originalMatrixError); // Full original error preserved
      expect(errorResponse.httpStatus).toBe(400);
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should handle rapid succession of timeout/error scenarios efficiently', async () => {
      const startTime = Date.now();
      const numRequests = 50;
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // Mix of error types
      const errors = [
        (() => { const e = new Error(); e.name = 'AbortError'; return e; })(), // Timeout
        new Error('ECONNREFUSED'), // Connection refused
        new Error('ENOTFOUND'), // DNS error
      ];

      const results = [];
      for (let i = 0; i < numRequests; i++) {
        const errorToUse = errors[i % errors.length];
        mockFetch.mockRejectedValueOnce(errorToUse);
        
        const result = await client.checkAvailability(mockRequest, mockCredentials).catch(e => e);
        results.push(result);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (not more than 2 seconds for 50 error responses)
      expect(duration).toBeLessThan(2000);

      // All should be error responses
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
        const errorResponse = (result as Error & { errorResponse?: any }).errorResponse;
        expect(errorResponse).toBeDefined();
        expect(errorResponse.requestId).toBeDefined();
      });

      console.error(`Processed ${numRequests} error responses in ${duration}ms (${(duration / numRequests).toFixed(2)}ms per error)`);
    });

    it('should maintain consistent error response structure under load', async () => {
      const numConcurrentRequests = 25;
      const mockRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      // All requests will timeout
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const requestPromises = Array.from({ length: numConcurrentRequests }, () => 
        client.checkAvailability(mockRequest, mockCredentials).catch(e => e)
      );

      const results = await Promise.all(requestPromises);

      // Verify all errors have consistent structure
      const errorStructures = results.map(result => {
        const errorResponse = (result as Error & { errorResponse?: any }).errorResponse;
        return {
          hasErrorObject: !!errorResponse?.error,
          hasErrorCode: !!errorResponse?.error?.code,
          hasErrorMessage: !!errorResponse?.error?.message,
          hasHttpStatus: typeof errorResponse?.httpStatus === 'number',
          hasRequestId: !!errorResponse?.requestId,
          hasTimestamp: !!errorResponse?.error?.timestamp
        };
      });

      // All error structures should be identical
      const firstStructure = errorStructures[0];
      expect(firstStructure).toBeDefined();
      if (firstStructure) {
        errorStructures.forEach(structure => {
          expect(structure).toEqual(firstStructure);
        });

        // All should have required fields
        expect(firstStructure.hasErrorObject).toBe(true);
        expect(firstStructure.hasErrorCode).toBe(true);
        expect(firstStructure.hasErrorMessage).toBe(true);
        expect(firstStructure.hasHttpStatus).toBe(true);
        expect(firstStructure.hasRequestId).toBe(true);
        expect(firstStructure.hasTimestamp).toBe(true);
      }
    });
  });
});