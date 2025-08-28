import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocationService } from '../../../src/services/location-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { ILocation, ILocationHierarchyResponse, ILocationQueryRequest } from '../../../src/types/location.types.js';

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
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getAllBookings: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn(),
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

  describe('getLocationHierarchy', () => {
    const mockHierarchy: ILocationHierarchyResponse = {
      locations: [
        {
          id: 100,
          name: 'Main Building',
          kind: 'Building',
          ancestors: []
        },
        {
          id: 101,
          name: 'Floor 1',
          kind: 'Floor',
          ancestors: [{ id: 100, name: 'Main Building', kind: 'Building' }]
        },
        {
          id: 102,
          name: 'Conference Room A',
          kind: 'Room',
          capacity: 12,
          isBookable: true,
          ancestors: [
            { id: 100, name: 'Main Building', kind: 'Building' },
            { id: 101, name: 'Floor 1', kind: 'Floor' }
          ]
        }
      ],
      total: 3,
      hierarchy: {
        100: [101],
        101: [102],
        102: []
      }
    };

    it('should successfully get location hierarchy with no request parameters', async () => {
      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(mockHierarchy);

      const result = await service.getLocationHierarchy();

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith({}, mockCredentials);
      expect(result).toEqual(mockHierarchy);
      expect(result.locations).toHaveLength(3);
    });

    it('should successfully get location hierarchy with request parameters', async () => {
      const request: ILocationQueryRequest = {
        parentId: 100,
        kind: 'Room',
        includeAncestors: true,
        includeFacilities: true,
        includeChildren: false,
        isBookable: true
      };

      const filteredHierarchy: ILocationHierarchyResponse = {
        locations: [
          {
            id: 102,
            name: 'Conference Room A',
            kind: 'Room',
            capacity: 12,
            isBookable: true,
            ancestors: [
              { id: 100, name: 'Main Building', kind: 'Building' },
              { id: 101, name: 'Floor 1', kind: 'Floor' }
            ]
          }
        ],
        total: 1,
        hierarchy: {
          102: []
        }
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(filteredHierarchy);

      const result = await service.getLocationHierarchy(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(request, mockCredentials);
      expect(result).toEqual(filteredHierarchy);
      expect(result.locations).toHaveLength(1);
      expect(result.locations?.[0]?.kind).toBe('Room');
      expect(result.locations?.[0]?.isBookable).toBe(true);
    });

    it('should handle empty hierarchy response', async () => {
      const emptyHierarchy: ILocationHierarchyResponse = {
        locations: [],
        total: 0,
        hierarchy: {}
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(emptyHierarchy);

      const result = await service.getLocationHierarchy();

      expect(result.locations).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(Object.keys(result.hierarchy)).toHaveLength(0);
    });

    it('should handle API client errors and re-throw them', async () => {
      const apiError = new Error('Matrix API error: 403 Forbidden');
      mockApiClient.getLocationHierarchy = vi.fn().mockRejectedValue(apiError);

      await expect(service.getLocationHierarchy())
        .rejects.toThrow('Matrix API error: 403 Forbidden');
      
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith({}, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'LOCATION_ERROR',
          message: 'Location hierarchy service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getLocationHierarchy())
        .rejects.toThrow('Location hierarchy service error occurred');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'LOCATION_ERROR');
    });

    it('should handle hierarchy with nested relationships', async () => {
      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(mockHierarchy);

      const result = await service.getLocationHierarchy();

      // Verify hierarchy structure
      expect(result.hierarchy[100]).toEqual([101]);
      expect(result.hierarchy[101]).toEqual([102]);
      expect(result.hierarchy[102]).toEqual([]);

      // Verify ancestor relationships
      const conferenceRoom = result.locations.find(loc => loc.id === 102);
      expect(conferenceRoom?.ancestors).toHaveLength(2);
      expect(conferenceRoom?.ancestors?.[0]?.name).toBe('Main Building');
      expect(conferenceRoom?.ancestors?.[1]?.name).toBe('Floor 1');
    });
  });

  describe('getLocationsByKind', () => {
    const mockRoomLocations: ILocation[] = [
      {
        id: 102,
        name: 'Conference Room A',
        kind: 'Room',
        capacity: 12,
        isBookable: true,
        features: ['Projector', 'Whiteboard']
      },
      {
        id: 103,
        name: 'Conference Room B',
        kind: 'Room',
        capacity: 8,
        isBookable: true,
        features: ['TV', 'Video Conference']
      }
    ];

    const mockHierarchyWithRooms: ILocationHierarchyResponse = {
      locations: mockRoomLocations,
      total: 2,
      hierarchy: {
        102: [],
        103: []
      }
    };

    it('should successfully get locations by kind', async () => {
      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(mockHierarchyWithRooms);

      const result = await service.getLocationsByKind('Room');

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {
          kind: 'Room',
          includeFacilities: true,
          includeChildren: true
        },
        mockCredentials
      );
      expect(result).toEqual(mockRoomLocations);
      expect(result).toHaveLength(2);
      expect(result.every(loc => loc.kind === 'Room')).toBe(true);
    });

    it('should validate kind parameter is non-empty string', async () => {
      await expect(service.getLocationsByKind(''))
        .rejects.toThrow('Invalid kind parameter: must be a non-empty string');

      await expect(service.getLocationsByKind('   '))
        .rejects.toThrow('Invalid kind parameter: must be a non-empty string');

      expect(mockApiClient.getLocationHierarchy).not.toHaveBeenCalled();
    });

    it('should validate kind parameter is a string', async () => {
      await expect(service.getLocationsByKind(null as any))
        .rejects.toThrow('Invalid kind parameter: must be a non-empty string');

      await expect(service.getLocationsByKind(undefined as any))
        .rejects.toThrow('Invalid kind parameter: must be a non-empty string');

      await expect(service.getLocationsByKind(123 as any))
        .rejects.toThrow('Invalid kind parameter: must be a non-empty string');

      expect(mockApiClient.getLocationHierarchy).not.toHaveBeenCalled();
    });

    it('should trim whitespace from kind parameter', async () => {
      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(mockHierarchyWithRooms);

      const result = await service.getLocationsByKind('  Room  ');

      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {
          kind: 'Room',
          includeFacilities: true,
          includeChildren: true
        },
        mockCredentials
      );
      expect(result).toEqual(mockRoomLocations);
    });

    it('should handle empty locations response for kind', async () => {
      const emptyResponse: ILocationHierarchyResponse = {
        locations: [],
        total: 0,
        hierarchy: {}
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(emptyResponse);

      const result = await service.getLocationsByKind('NonExistentKind');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different location kinds', async () => {
      const buildingLocations: ILocation[] = [
        {
          id: 100,
          name: 'Main Building',
          kind: 'Building',
          isBookable: false
        },
        {
          id: 200,
          name: 'Annex Building',
          kind: 'Building',
          isBookable: false
        }
      ];

      const buildingHierarchy: ILocationHierarchyResponse = {
        locations: buildingLocations,
        total: 2,
        hierarchy: {
          100: [101, 102],
          200: [201, 202]
        }
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(buildingHierarchy);

      const result = await service.getLocationsByKind('Building');

      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {
          kind: 'Building',
          includeFacilities: true,
          includeChildren: true
        },
        mockCredentials
      );
      expect(result).toEqual(buildingLocations);
      expect(result).toHaveLength(2);
      expect(result.every(loc => loc.kind === 'Building')).toBe(true);
      expect(result.every(loc => loc.isBookable === false)).toBe(true);
    });

    it('should handle API client errors and re-throw them', async () => {
      const apiError = new Error('Matrix API error: 404 Kind not found');
      mockApiClient.getLocationHierarchy = vi.fn().mockRejectedValue(apiError);

      await expect(service.getLocationsByKind('Room'))
        .rejects.toThrow('Matrix API error: 404 Kind not found');
      
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {
          kind: 'Room',
          includeFacilities: true,
          includeChildren: true
        },
        mockCredentials
      );
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'LOCATION_ERROR',
          message: 'Location by kind service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getLocationsByKind('Room'))
        .rejects.toThrow('Location by kind service error occurred');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'LOCATION_ERROR');
    });

    it('should handle locations with facilities and features', async () => {
      const roomsWithFacilities: ILocation[] = [
        {
          id: 102,
          name: 'Executive Boardroom',
          kind: 'Room',
          capacity: 20,
          isBookable: true,
          features: ['4K TV', 'Wireless Presentation', 'Audio System'],
          facilities: [
            { id: '1', name: 'Video Conferencing', category: 'AV' },
            { id: '2', name: 'Catering Setup', category: 'Service' }
          ]
        }
      ];

      const hierarchyWithFacilities: ILocationHierarchyResponse = {
        locations: roomsWithFacilities,
        total: 1,
        hierarchy: { 102: [] }
      };

      mockApiClient.getLocationHierarchy = vi.fn().mockResolvedValue(hierarchyWithFacilities);

      const result = await service.getLocationsByKind('Room');

      expect(result).toHaveLength(1);
      expect(result[0]?.features).toHaveLength(3);
      expect(result[0]?.facilities).toHaveLength(2);
      expect(result[0]?.facilities?.[0]?.name).toBe('Video Conferencing');
    });
  });
});