import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocationService } from '../../../src/services/location-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { ILocation } from '../../../src/types/location.types.js';

describe('LocationService', () => {
  let service: LocationService;
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

    // Setup mock API client
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getLocation: vi.fn(),
      makeRequest: vi.fn()
    };

    // Create service instance
    service = new LocationService(
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
      const newService = new LocationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager,
        mockErrorHandler
      );
      expect(newService).toBeInstanceOf(LocationService);
    });

    it('should create instance with default error handler when not provided', () => {
      const newService = new LocationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );
      expect(newService).toBeInstanceOf(LocationService);
    });
  });

  describe('getLocation', () => {
    it('should successfully get location with valid ID', async () => {
      const locationId = 1;
      const mockLocation: ILocation = {
        id: 1,
        name: 'Test Location',
        capacity: 10,
        features: ['WiFi', 'Projector']
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      const result = await service.getLocation(locationId);

      expect(mockApiClient.getLocation).toHaveBeenCalledWith(locationId, mockCredentials);
      expect(result).toEqual(mockLocation);
    });

    it('should validate location ID before API call', async () => {
      const invalidLocationId = -1;

      await expect(service.getLocation(invalidLocationId))
        .rejects.toThrow('Invalid location ID: -1. Location ID must be a positive integer.');

      expect(mockApiClient.getLocation).not.toHaveBeenCalled();
    });

    it('should handle API client errors and re-throw them', async () => {
      const locationId = 1;
      const apiError = new Error('Matrix API error: 404 Not Found');
      
      mockApiClient.getLocation = vi.fn().mockRejectedValue(apiError);

      await expect(service.getLocation(locationId)).rejects.toThrow('Matrix API error: 404 Not Found');
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(locationId, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const locationId = 1;
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'LOCATION_ERROR',
          message: 'Location service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getLocation = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getLocation(locationId)).rejects.toThrow('Location service error occurred');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'LOCATION_ERROR');
    });

    it('should get credentials from auth manager', async () => {
      const locationId = 1;
      const mockLocation: ILocation = {
        id: 1,
        name: 'Test Location'
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      await service.getLocation(locationId);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(locationId, mockCredentials);
    });

    it('should handle location with minimal data', async () => {
      const locationId = 1;
      const mockLocation: ILocation = {
        id: 1,
        name: 'Minimal Location'
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      const result = await service.getLocation(locationId);

      expect(result).toEqual(mockLocation);
      expect(result.capacity).toBeUndefined();
      expect(result.features).toBeUndefined();
    });

    it('should handle location with full data', async () => {
      const locationId = 1;
      const mockLocation: ILocation = {
        id: 1,
        name: 'Full Location',
        capacity: 25,
        features: ['WiFi', 'Projector', 'Whiteboard', 'Video Conferencing']
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      const result = await service.getLocation(locationId);

      expect(result).toEqual(mockLocation);
      expect(result.capacity).toBe(25);
      expect(result.features).toHaveLength(4);
    });
  });

  describe('getPreferredLocation', () => {
    it('should successfully get preferred location from configuration', async () => {
      const mockLocation: ILocation = {
        id: 42,
        name: 'Preferred Location',
        capacity: 15,
        features: ['WiFi']
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      const result = await service.getPreferredLocation();

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(42, mockCredentials);
      expect(result).toEqual(mockLocation);
    });

    it('should throw error for invalid preferred location configuration', async () => {
      // Mock config with invalid location
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: 'invalid-number'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      await expect(service.getPreferredLocation())
        .rejects.toThrow("Invalid MATRIX_PREFERED_LOCATION: 'invalid-number' is not a valid number");

      expect(mockApiClient.getLocation).not.toHaveBeenCalled();
    });

    it('should handle empty string preferred location configuration', async () => {
      // Mock config with empty string location
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: ''
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      await expect(service.getPreferredLocation())
        .rejects.toThrow("Invalid MATRIX_PREFERED_LOCATION: '' is not a valid number");

      expect(mockApiClient.getLocation).not.toHaveBeenCalled();
    });

    it('should handle negative preferred location configuration', async () => {
      // Mock config with negative location
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: '-5'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      await expect(service.getPreferredLocation())
        .rejects.toThrow('Invalid location ID: -5. Location ID must be a positive integer.');

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
    });

    it('should handle zero preferred location configuration', async () => {
      // Mock config with zero location
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: '0'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      await expect(service.getPreferredLocation())
        .rejects.toThrow('Invalid location ID: 0. Location ID must be a positive integer.');

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors when getting preferred location', async () => {
      const apiError = new Error('Matrix API error: 404 Location Not Found');
      mockApiClient.getLocation = vi.fn().mockRejectedValue(apiError);

      await expect(service.getPreferredLocation()).rejects.toThrow('Matrix API error: 404 Location Not Found');
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(42, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'PREFERRED_LOCATION_ERROR',
          message: 'Preferred location service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getLocation = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getPreferredLocation()).rejects.toThrow('Preferred location service error occurred');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'LOCATION_ERROR');
    });

    it('should handle floating point preferred location configuration', async () => {
      // Mock config with floating point location (should parse to integer)
      const floatConfig = {
        ...mockConfig,
        matrixPreferredLocation: '42.5'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(floatConfig);

      // parseInt('42.5') returns 42, which is valid, but validation should catch that 42 is an integer
      const mockLocation: ILocation = {
        id: 42,
        name: 'Float Location'
      };

      mockApiClient.getLocation = vi.fn().mockResolvedValue(mockLocation);

      const result = await service.getPreferredLocation();
      expect(result).toEqual(mockLocation);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(42, mockCredentials);
    });
  });

  describe('validateLocationId', () => {
    it('should return true for valid positive integer', () => {
      expect(service.validateLocationId(1)).toBe(true);
      expect(service.validateLocationId(42)).toBe(true);
      expect(service.validateLocationId(1000)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(service.validateLocationId(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(service.validateLocationId(-1)).toBe(false);
      expect(service.validateLocationId(-42)).toBe(false);
    });

    it('should return false for floating point numbers', () => {
      expect(service.validateLocationId(1.5)).toBe(false);
      expect(service.validateLocationId(42.1)).toBe(false);
      expect(service.validateLocationId(3.14159)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(service.validateLocationId(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(service.validateLocationId(Infinity)).toBe(false);
      expect(service.validateLocationId(-Infinity)).toBe(false);
    });

    it('should return false for non-number types', () => {
      // TypeScript should catch these, but testing runtime behavior
      expect(service.validateLocationId('1' as any)).toBe(false);
      expect(service.validateLocationId(null as any)).toBe(false);
      expect(service.validateLocationId(undefined as any)).toBe(false);
      expect(service.validateLocationId(true as any)).toBe(false);
      expect(service.validateLocationId({} as any)).toBe(false);
      expect(service.validateLocationId([] as any)).toBe(false);
    });

    it('should handle edge cases with very large integers', () => {
      expect(service.validateLocationId(Number.MAX_SAFE_INTEGER)).toBe(true);
      // Test with proper floating point numbers that maintain precision
      expect(service.validateLocationId(1000000.5)).toBe(false); // Definitely floating point
      expect(service.validateLocationId(123.456)).toBe(false); // Another floating point
    });

    it('should return true for small positive integers', () => {
      expect(service.validateLocationId(1)).toBe(true);
      expect(service.validateLocationId(2)).toBe(true);
      expect(service.validateLocationId(3)).toBe(true);
    });
  });

  describe('error handling integration', () => {
    it('should maintain error chain when validation fails in getLocation', async () => {
      const invalidId = -1;

      try {
        await service.getLocation(invalidId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid location ID: -1');
      }
    });

    it('should maintain error chain when configuration is invalid in getPreferredLocation', async () => {
      const invalidConfig = {
        ...mockConfig,
        matrixPreferredLocation: 'not-a-number'
      };
      mockConfigManager.getConfig = vi.fn().mockReturnValue(invalidConfig);

      try {
        await service.getPreferredLocation();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Invalid MATRIX_PREFERED_LOCATION: 'not-a-number'");
      }
    });

    it('should preserve API error details in error chain', async () => {
      const locationId = 1;
      const apiError = new Error('Matrix API error: 401 Unauthorized') as Error & { 
        errorResponse?: { httpStatus: number } 
      };
      apiError.errorResponse = { httpStatus: 401 };
      
      mockApiClient.getLocation = vi.fn().mockRejectedValue(apiError);

      try {
        await service.getLocation(locationId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(apiError); // Should be the same error object
        expect((error as typeof apiError).errorResponse?.httpStatus).toBe(401);
      }
    });
  });
});