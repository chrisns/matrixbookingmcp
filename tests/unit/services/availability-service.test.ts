import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvailabilityService } from '../../../src/services/availability-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { IAvailabilityRequest, IAvailabilityResponse } from '../../../src/types/availability.types.js';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let mockApiClient: IMatrixAPIClient;
  let mockConfigManager: IConfigurationManager;
  let mockAuthManager: IAuthenticationManager;
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
      matrixPreferredLocation: '42',
      apiTimeout: 5000,
      apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
      cacheEnabled: true
    };

    // Setup mock auth manager
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

    // Setup mock API client
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getLocation: vi.fn(),
      makeRequest: vi.fn(),
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getAllBookings: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn(),
      cancelBooking: vi.fn()
    };

    // Create service instance
    service = new AvailabilityService(
      mockApiClient,
      mockConfigManager,
      mockAuthManager,
      mockErrorHandler
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with all dependencies', () => {
      const newService = new AvailabilityService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager,
        mockErrorHandler
      );
      expect(newService).toBeInstanceOf(AvailabilityService);
    });

    it('should create instance with default error handler when not provided', () => {
      const newService = new AvailabilityService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );
      expect(newService).toBeInstanceOf(AvailabilityService);
    });
  });

  describe('checkAvailability', () => {
    it('should successfully check availability with complete request', async () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1,
        bookingCategory: 123
      };

      const mockResponse: IAvailabilityResponse = {
        available: true,
        slots: [
          {
            from: '2024-01-01T09:00:00.000Z',
            to: '2024-01-01T17:00:00.000Z',
            available: true,
            locationId: 1
          }
        ],
        location: {
          id: 1,
          name: 'Test Location',
          capacity: 10,
          features: ['WiFi', 'Projector']
        }
      };

      mockApiClient.checkAvailability = vi.fn().mockResolvedValue(mockResponse);

      const result = await service.checkAvailability(request);

      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(request, mockCredentials);
      expect(result).toEqual(mockResponse);
    });

    it('should format partial request before checking availability', async () => {
      const partialRequest: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z'
      };

      const mockResponse: IAvailabilityResponse = {
        available: true,
        slots: [],
        location: { id: 42, name: 'Default Location' }
      };

      mockApiClient.checkAvailability = vi.fn().mockResolvedValue(mockResponse);

      const result = await service.checkAvailability(partialRequest as IAvailabilityRequest);

      // Should have called with formatted request including default locationId
      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-01-01T09:00:00.000Z',
          dateTo: '2024-01-01T17:00:00.000Z',
          locationId: 42
        }),
        mockCredentials
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API client errors and re-throw them', async () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const apiError = new Error('Matrix API error: 401 Unauthorized');
      mockApiClient.checkAvailability = vi.fn().mockRejectedValue(apiError);

      await expect(service.checkAvailability(request)).rejects.toThrow('Matrix API error: 401 Unauthorized');
      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'AVAILABILITY_ERROR',
          message: 'Service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.checkAvailability = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.checkAvailability(request)).rejects.toThrow('Service error occurred');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'AVAILABILITY_ERROR');
    });

    it('should get credentials from auth manager', async () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1
      };

      const mockResponse: IAvailabilityResponse = {
        available: true,
        slots: [],
        location: { id: 1, name: 'Test Location' }
      };

      mockApiClient.checkAvailability = vi.fn().mockResolvedValue(mockResponse);

      await service.checkAvailability(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(request, mockCredentials);
    });
  });

  describe('formatAvailabilityRequest', () => {
    beforeEach(() => {
      // Mock the current date to be predictable
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return request as-is when all fields are provided', () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00.000Z',
        locationId: 1,
        bookingCategory: 123
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result).toEqual(request);
    });

    it('should default dateFrom to current time when not provided', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateTo: '2024-01-15T17:00:00.000Z',
        locationId: 1
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result.dateFrom).toBe('2024-01-15T10:30:00.000Z');
      expect(result.dateTo).toBe('2024-01-15T17:00:00.000Z');
      expect(result.locationId).toBe(1);
    });

    it('should default dateTo to end of current day when not provided', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        locationId: 1
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result.dateFrom).toBe('2024-01-15T09:00:00.000Z');
      expect(result.dateTo).toBe('2024-01-15T23:59:59.999Z');
      expect(result.locationId).toBe(1);
    });

    it('should default locationId to preferred location from config when not provided', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T17:00:00.000Z'
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result.dateFrom).toBe('2024-01-15T09:00:00.000Z');
      expect(result.dateTo).toBe('2024-01-15T17:00:00.000Z');
      expect(result.locationId).toBe(42); // From mockConfig.matrixPreferredLocation
    });

    it('should use all defaults when request is empty', () => {
      const request: Partial<IAvailabilityRequest> = {};

      const result = service.formatAvailabilityRequest(request);

      expect(result.dateFrom).toBe('2024-01-15T10:30:00.000Z');
      expect(result.dateTo).toBe('2024-01-15T23:59:59.999Z');
      expect(result.locationId).toBe(42);
      expect(result.bookingCategory).toBeUndefined();
    });

    it('should preserve booking category when provided', () => {
      const request: Partial<IAvailabilityRequest> = {
        bookingCategory: 90
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result.bookingCategory).toBe(90);
    });

    it('should throw error for invalid preferred location configuration', () => {
      // Mock config with invalid location
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: 'invalid-number'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T17:00:00.000Z'
      };

      expect(() => service.formatAvailabilityRequest(request))
        .toThrow("Invalid MATRIX_PREFERED_LOCATION: 'invalid-number' is not a valid number");
    });

    it('should throw error when dateFrom is after dateTo', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T18:00:00.000Z',
        dateTo: '2024-01-15T09:00:00.000Z',
        locationId: 1
      };

      expect(() => service.formatAvailabilityRequest(request))
        .toThrow('End time must be after start time');
    });

    it('should throw error when dateFrom equals dateTo', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T09:00:00.000Z',
        locationId: 1
      };

      expect(() => service.formatAvailabilityRequest(request))
        .toThrow('End time must be after start time');
    });

    it('should get configuration from config manager', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T17:00:00.000Z'
      };

      service.formatAvailabilityRequest(request);

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
    });

    it('should handle edge case with minimal time difference', () => {
      const request: Partial<IAvailabilityRequest> = {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T09:00:00.001Z',
        locationId: 1
      };

      const result = service.formatAvailabilityRequest(request);

      expect(result.dateFrom).toBe('2024-01-15T09:00:00.000Z');
      expect(result.dateTo).toBe('2024-01-15T09:00:00.001Z');
      expect(result.locationId).toBe(1);
    });
  });
});