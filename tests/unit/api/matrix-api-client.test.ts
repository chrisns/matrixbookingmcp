import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAvailabilityRequest, IAvailabilityResponse } from '../../../src/types/availability.types.js';
import { IBookingRequest, IBookingResponse } from '../../../src/types/booking.types.js';
import { ILocation } from '../../../src/types/location.types.js';
import { IAPIRequest } from '../../../src/types/api.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('MatrixAPIClient', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockErrorHandler: IErrorHandler;
  let mockCredentials: ICredentials;
  let mockConfig: IServerConfig;
  let encodedCredentials: string;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock credentials
    const username = 'testuser';
    const password = 'testpass';
    encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
    mockCredentials = {
      username,
      password,
      encodedCredentials
    };

    // Setup mock config
    mockConfig = {
      matrixUsername: 'testuser',
      matrixPassword: 'testpass',
      matrixPreferredLocation: 'London',
      apiTimeout: 5000,
      apiBaseUrl: 'https://app.matrixbooking.com/api/v1'
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
      })
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

    // Create client instance
    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkAvailability', () => {
    it('should make a POST request to availability endpoint', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1
      };

      const mockAvailabilityResponse: IAvailabilityResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockAvailabilityResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.checkAvailability(mockAvailabilityRequest, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/availability',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          }),
          body: JSON.stringify(mockAvailabilityRequest)
        })
      );

      expect(result).toEqual(mockAvailabilityResponse);
    });
  });

  describe('createBooking', () => {
    it('should make a POST request to booking endpoint', async () => {
      const mockBookingRequest: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        locationId: 1,
        attendees: [],
        extraRequests: [],
        owner: { id: 1, email: 'test@example.com', name: 'Test User' },
        ownerIsAttendee: true,
        source: 'API'
      };

      const mockBookingResponse: IBookingResponse = {
        id: 123,
        status: 'CONFIRMED',
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        location: { id: 1, name: 'Test Location' },
        owner: { id: 1, email: 'test@example.com', name: 'Test User' },
        attendees: []
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockBookingResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.createBooking(mockBookingRequest, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/booking',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          }),
          body: JSON.stringify(mockBookingRequest)
        })
      );

      expect(result).toEqual(mockBookingResponse);
    });
  });

  describe('getLocation', () => {
    it('should make a GET request to location endpoint', async () => {
      const locationId = 1;
      const mockLocation: ILocation = {
        id: 1,
        name: 'Test Location',
        capacity: 10,
        features: ['WiFi', 'Projector']
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockLocation), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.getLocation(locationId, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/location/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          })
        })
      );

      expect(result).toEqual(mockLocation);
    });
  });

  describe('makeRequest', () => {
    it('should handle successful JSON responses', async () => {
      const mockData = { success: true };
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.makeRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.data).toEqual(mockData);
    });

    it('should handle successful text responses', async () => {
      const mockData = 'Success';
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      mockFetch.mockResolvedValueOnce(new Response(mockData, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' }
      }));

      const result = await client.makeRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.data).toBe(mockData);
    });

    it('should include request body for POST requests', async () => {
      const mockData = { success: true };
      const requestBody = { test: 'data' };
      const mockRequest: IAPIRequest = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.makeRequest(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      );
    });

    it('should handle HTTP error responses using ErrorHandler', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const errorResponse = {
        error: {
          code: 'MATRIX_API_ERROR',
          message: 'Matrix API error: 404 Not Found',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 404,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleAPIError = vi.fn().mockReturnValue(errorResponse);

      mockFetch.mockResolvedValueOnce(new Response('Not Found', {
        status: 404,
        statusText: 'Not Found'
      }));

      await expect(client.makeRequest(mockRequest)).rejects.toThrow('Matrix API error: 404 Not Found');
      expect(mockErrorHandler.handleAPIError).toHaveBeenCalledTimes(1);
    });

    it('should handle request timeout using ErrorHandler', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
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

      await expect(client.makeRequest(mockRequest)).rejects.toThrow('Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit');
      expect(mockErrorHandler.handleTimeout).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors using ErrorHandler', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const networkErrorResponse = {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 503,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleNetworkError = vi.fn().mockReturnValue(networkErrorResponse);

      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(client.makeRequest(mockRequest)).rejects.toThrow('Network error');
      expect(mockErrorHandler.handleNetworkError).toHaveBeenCalledWith(networkError);
    });

    it('should handle unknown errors using ErrorHandler', async () => {
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const systemErrorResponse = {
        error: {
          code: 'SYSTEM_ERROR',
          message: 'Internal system error',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleError = vi.fn().mockReturnValue(systemErrorResponse);

      // Mock non-Error object being thrown
      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(client.makeRequest(mockRequest)).rejects.toThrow('Internal system error');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith('Unknown error', 'SYSTEM_ERROR');
    });

    it('should preserve response headers', async () => {
      const mockData = { success: true };
      const mockRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' }
      };

      const mockResponse = new Response(JSON.stringify(mockData), {
        status: 200,
        statusText: 'OK',
        headers: { 
          'content-type': 'application/json',
          'x-custom-header': 'custom-value'
        }
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await client.makeRequest(mockRequest);

      expect(result.headers).toEqual({
        'content-type': 'application/json',
        'x-custom-header': 'custom-value'
      });
    });
  });

  describe('constructor', () => {
    it('should create instance with auth and config managers', () => {
      const newClient = new MatrixAPIClient(mockAuthManager, mockConfigManager);
      expect(newClient).toBeInstanceOf(MatrixAPIClient);
    });

    it('should create instance with custom error handler', () => {
      const newClient = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
      expect(newClient).toBeInstanceOf(MatrixAPIClient);
    });

    it('should create instance with default error handler when not provided', () => {
      const newClient = new MatrixAPIClient(mockAuthManager, mockConfigManager);
      expect(newClient).toBeInstanceOf(MatrixAPIClient);
    });
  });
});