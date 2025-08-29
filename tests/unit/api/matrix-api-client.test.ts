import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { MatrixAPIClient } from '../../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAvailabilityRequest, IAvailabilityResponse } from '../../../src/types/availability.types.js';
import { IBookingRequest, ICancelBookingRequest, ICancelBookingResponse } from '../../../src/types/booking.types.js';
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

    // Create client instance
    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkAvailability', () => {
    it('should make a GET request to availability endpoint with query parameters', async () => {
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

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/availability?' +
        'l=1&' +
        'f=2024-01-01T09%3A00%3A00.000&' +
        't=2024-01-01T17%3A00%3A00.000&' +
        'include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
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

      expect(result).toEqual(mockAvailabilityResponse);
    });

    it('should include booking category when provided', async () => {
      const mockAvailabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000',
        dateTo: '2024-01-01T17:00:00.000',
        locationId: 1,
        bookingCategory: 123
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

      await client.checkAvailability(mockAvailabilityRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/availability?' +
        'l=1&' +
        'f=2024-01-01T09%3A00%3A00.000&' +
        't=2024-01-01T17%3A00%3A00.000&' +
        'include=locations&include=facilities&include=layouts&include=bookingSettings&include=timeslots&' +
        'bc=123';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'GET'
        })
      );
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

      const mockBookingResponse = {
        id: 123,
        status: 'CONFIRMED',
        timeFrom: '2024-01-01T09:00:00.000',
        timeTo: '2024-01-01T17:00:00.000',
        organisation: { id: 2147924904, name: 'Test Organization' },
        locationId: 1,
        locationKind: 'DESK',
        owner: { id: 1, email: 'test@example.com', name: 'Test User' },
        bookedBy: { id: 1, email: 'test@example.com', name: 'Test User' },
        attendeeCount: 1,
        ownerIsAttendee: true,
        source: 'WEB',
        version: 1,
        hasExternalNotes: false,
        isPrivate: false,
        duration: { millis: 28800000 },
        possibleActions: {
          edit: true,
          cancel: true,
          approve: false,
          confirm: false,
          endEarly: false,
          changeOwner: false,
          start: false,
          viewHistory: true
        },
        checkInStatus: 'ALLOWED_LATER',
        checkInStartTime: '2024-01-01T08:45:00.000',
        checkInEndTime: '2024-01-01T09:15:00.000',
        hasStarted: false,
        hasEnded: false
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockBookingResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.createBooking(mockBookingRequest, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/booking?notifyScope=ALL_ATTENDEES',
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

  describe('cancelBooking', () => {
    it('should make a DELETE request to booking endpoint with default parameters', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 123
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 123,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/123?notifyScope=ALL_ATTENDEES&sendNotifications=true';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          })
        })
      );

      expect(result).toEqual(mockCancelResponse);
    });

    it('should include all parameters when provided', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: '456',
        notifyScope: 'OWNER_ONLY',
        sendNotifications: false,
        reason: 'Meeting cancelled due to schedule conflict'
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 456,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: false,
        notifyScope: 'OWNER_ONLY',
        reason: 'Meeting cancelled due to schedule conflict',
        originalBooking: {
          locationId: 1,
          locationName: 'Meeting Room A',
          timeFrom: '2024-01-01T09:00:00.000Z',
          timeTo: '2024-01-01T17:00:00.000Z',
          attendeeCount: 5,
          owner: 'John Doe'
        }
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/456?notifyScope=OWNER_ONLY&sendNotifications=false&reason=Meeting+cancelled+due+to+schedule+conflict';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          })
        })
      );

      expect(result).toEqual(mockCancelResponse);
    });

    it('should handle NONE notify scope', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 789,
        notifyScope: 'NONE',
        sendNotifications: true
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 789,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/789?notifyScope=NONE&sendNotifications=true';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should handle string booking ID correctly', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: '999',
        reason: 'Emergency cancellation'
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 999,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        reason: 'Emergency cancellation'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/999?notifyScope=ALL_ATTENDEES&sendNotifications=true&reason=Emergency+cancellation';

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
      expect(result).toEqual(mockCancelResponse);
    });

    it('should handle numeric booking ID correctly', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 1001
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 1001,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/1001?notifyScope=ALL_ATTENDEES&sendNotifications=true';

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should handle API error responses through ErrorHandler', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 404
      };

      const errorResponse = {
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Booking with ID 404 not found',
          timestamp: '2024-01-01T12:00:00.000Z'
        },
        httpStatus: 404,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleAPIError = vi.fn().mockReturnValue(errorResponse);

      mockFetch.mockResolvedValueOnce(new Response('Not Found', {
        status: 404,
        statusText: 'Not Found'
      }));

      await expect(client.cancelBooking(mockCancelRequest, mockCredentials)).rejects.toThrow('Booking with ID 404 not found');
      expect(mockErrorHandler.handleAPIError).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors through ErrorHandler', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 123
      };

      const networkErrorResponse = {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network connection failed',
          timestamp: '2024-01-01T12:00:00.000Z'
        },
        httpStatus: 503,
        requestId: 'test-request-id'
      };

      mockErrorHandler.handleNetworkError = vi.fn().mockReturnValue(networkErrorResponse);

      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(client.cancelBooking(mockCancelRequest, mockCredentials)).rejects.toThrow('Network connection failed');
      expect(mockErrorHandler.handleNetworkError).toHaveBeenCalledWith(networkError);
    });

    it('should default sendNotifications to true when not explicitly set to false', async () => {
      const mockCancelRequest: ICancelBookingRequest = {
        bookingId: 123
        // sendNotifications omitted to test default behavior
      };

      const mockCancelResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 123,
        status: 'CANCELLED',
        cancellationTime: '2024-01-01T12:00:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockCancelResponse), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      }));

      await client.cancelBooking(mockCancelRequest, mockCredentials);

      const expectedUrl = 'https://app.matrixbooking.com/api/v1/booking/123?notifyScope=ALL_ATTENDEES&sendNotifications=true';

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
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