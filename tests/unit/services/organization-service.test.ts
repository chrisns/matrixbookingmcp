import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrganizationService } from '../../../src/services/organization-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { IOrganizationResponse, IBookingCategory, ILocationKind } from '../../../src/types/organization.types.js';

describe('OrganizationService', () => {
  let service: OrganizationService;
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
    vi.useFakeTimers();

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

    // Setup mock API client
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getLocation: vi.fn(),
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getAllBookings: vi.fn(),
      getAvailability: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn(),
      makeRequest: vi.fn()
    };

    // Create service instance
    service = new OrganizationService(
      mockApiClient,
      mockConfigManager,
      mockAuthManager,
      mockErrorHandler
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with all dependencies', () => {
      const newService = new OrganizationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager,
        mockErrorHandler
      );
      expect(newService).toBeInstanceOf(OrganizationService);
    });

    it('should create instance with default error handler when not provided', () => {
      const newService = new OrganizationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );
      expect(newService).toBeInstanceOf(OrganizationService);
    });
  });

  describe('getOrganization', () => {
    const mockOrganization: IOrganizationResponse = {
      id: 789,
      name: 'Test Organization',
      description: 'A test organization',
      categories: [
        {
          id: 1,
          name: 'Meeting Rooms',
          description: 'Standard meeting rooms',
          color: '#3498db',
          isActive: true
        },
        {
          id: 2,
          name: 'Hot Desks',
          description: 'Flexible workspace desks',
          color: '#2ecc71',
          isActive: true
        }
      ],
      locationKinds: [
        {
          id: 1,
          name: 'Building',
          description: 'Main building structure',
          allowsBooking: false
        },
        {
          id: 2,
          name: 'Room',
          description: 'Individual bookable rooms',
          allowsBooking: true,
          capacity: { min: 1, max: 50 }
        }
      ],
      rootLocation: {
        id: 100,
        name: 'Main Campus',
        kind: 'Campus'
      },
      settings: {
        timezone: 'Europe/London',
        businessHours: {
          start: '09:00',
          end: '18:00'
        },
        advanceBookingDays: 30
      }
    };

    it('should successfully get organization data', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getOrganization(789);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getOrganization).toHaveBeenCalledWith(789, mockCredentials);
      expect(result).toEqual(mockOrganization);
    });

    it('should validate organization ID is positive integer', async () => {
      await expect(service.getOrganization(-1))
        .rejects.toThrow('Invalid organization ID: -1. Organization ID must be a positive integer.');

      await expect(service.getOrganization(0))
        .rejects.toThrow('Invalid organization ID: 0. Organization ID must be a positive integer.');

      expect(mockApiClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should validate organization ID is integer', async () => {
      await expect(service.getOrganization(1.5))
        .rejects.toThrow('Invalid organization ID: 1.5. Organization ID must be a positive integer.');

      expect(mockApiClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should cache organization data for 24 hours', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      // First call
      const result1 = await service.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockOrganization);

      // Second call - should use cache
      const result2 = await service.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result2).toEqual(mockOrganization);

      // Advance time by 24 hours + 1 minute
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 60 * 1000);

      // Third call - cache expired, should make new API call
      const result3 = await service.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
      expect(result3).toEqual(mockOrganization);
    });

    it('should handle API client errors and re-throw them', async () => {
      const apiError = new Error('Matrix API error: 404 Organization not found');
      mockApiClient.getOrganization = vi.fn().mockRejectedValue(apiError);

      await expect(service.getOrganization(789))
        .rejects.toThrow('Matrix API error: 404 Organization not found');
      
      expect(mockApiClient.getOrganization).toHaveBeenCalledWith(789, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'ORGANIZATION_ERROR',
          message: 'Organization service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getOrganization = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getOrganization(789))
        .rejects.toThrow('Organization service error occurred');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'ORGANIZATION_ERROR');
    });

    it('should handle organization with minimal data', async () => {
      const minimalOrg: IOrganizationResponse = {
        id: 789,
        name: 'Minimal Org',
        categories: [],
        locationKinds: [],
        rootLocation: {
          id: 100,
          name: 'Root'
        }
      };

      mockApiClient.getOrganization = vi.fn().mockResolvedValue(minimalOrg);

      const result = await service.getOrganization(789);
      expect(result).toEqual(minimalOrg);
      expect(result.categories).toHaveLength(0);
      expect(result.locationKinds).toHaveLength(0);
    });
  });

  describe('getBookingCategories', () => {
    const mockCategories: IBookingCategory[] = [
      {
        id: 1,
        name: 'Meeting Rooms',
        description: 'Standard meeting rooms',
        color: '#3498db',
        isActive: true
      },
      {
        id: 2,
        name: 'Hot Desks',
        description: 'Flexible workspace desks',
        color: '#2ecc71',
        isActive: true
      },
      {
        id: 3,
        name: 'Training Rooms',
        description: 'Large training spaces',
        color: '#e74c3c',
        isActive: false
      }
    ];

    const mockOrganization: IOrganizationResponse = {
      id: 789,
      name: 'Test Organization',
      categories: mockCategories,
      locationKinds: [],
      rootLocation: { id: 100, name: 'Root' }
    };

    it('should successfully get booking categories', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getBookingCategories(789);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCategories);
      expect(result).toHaveLength(3);
    });

    it('should cache booking categories separately', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      // First call to getBookingCategories
      await service.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);

      // Second call to getBookingCategories - should use category cache
      await service.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);

      // Call to getOrganization - should use org cache
      await service.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
    });

    it('should handle empty categories array', async () => {
      const orgWithNoCategories: IOrganizationResponse = {
        id: 789,
        name: 'Test Organization',
        categories: [],
        locationKinds: [],
        rootLocation: { id: 100, name: 'Root' }
      };

      mockApiClient.getOrganization = vi.fn().mockResolvedValue(orgWithNoCategories);

      const result = await service.getBookingCategories(789);
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle API errors when getting organization for categories', async () => {
      const apiError = new Error('Matrix API error: 403 Forbidden');
      mockApiClient.getOrganization = vi.fn().mockRejectedValue(apiError);

      await expect(service.getBookingCategories(789))
        .rejects.toThrow('Matrix API error: 403 Forbidden');
    });

    it('should filter only active categories if needed', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getBookingCategories(789);
      const activeCategories = result.filter(cat => cat.isActive);
      
      expect(result).toHaveLength(3);
      expect(activeCategories).toHaveLength(2);
      expect(activeCategories.every(cat => cat.isActive)).toBe(true);
    });
  });

  describe('getLocationKinds', () => {
    const mockLocationKinds: ILocationKind[] = [
      {
        id: 1,
        name: 'Building',
        description: 'Main building structure',
        allowsBooking: false
      },
      {
        id: 2,
        name: 'Floor',
        description: 'Building floors',
        allowsBooking: false
      },
      {
        id: 3,
        name: 'Room',
        description: 'Individual bookable rooms',
        allowsBooking: true,
        capacity: { min: 1, max: 50 }
      }
    ];

    const mockOrganization: IOrganizationResponse = {
      id: 789,
      name: 'Test Organization',
      categories: [],
      locationKinds: mockLocationKinds,
      rootLocation: { id: 100, name: 'Root' }
    };

    it('should successfully get location kinds', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getLocationKinds(789);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockLocationKinds);
      expect(result).toHaveLength(3);
    });

    it('should cache location kinds separately', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      // First call to getLocationKinds
      await service.getLocationKinds(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);

      // Second call to getLocationKinds - should use cache
      await service.getLocationKinds(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
    });

    it('should handle empty location kinds array', async () => {
      const orgWithNoKinds: IOrganizationResponse = {
        id: 789,
        name: 'Test Organization',
        categories: [],
        locationKinds: [],
        rootLocation: { id: 100, name: 'Root' }
      };

      mockApiClient.getOrganization = vi.fn().mockResolvedValue(orgWithNoKinds);

      const result = await service.getLocationKinds(789);
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should differentiate between bookable and non-bookable location kinds', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getLocationKinds(789);
      const bookableKinds = result.filter(kind => kind.allowsBooking);
      const nonBookableKinds = result.filter(kind => !kind.allowsBooking);

      expect(bookableKinds).toHaveLength(1);
      expect(nonBookableKinds).toHaveLength(2);
      expect(bookableKinds[0]?.name).toBe('Room');
    });

    it('should handle location kinds with capacity constraints', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      const result = await service.getLocationKinds(789);
      const roomKind = result.find(kind => kind.name === 'Room');

      expect(roomKind?.capacity).toBeDefined();
      expect(roomKind?.capacity?.min).toBe(1);
      expect(roomKind?.capacity?.max).toBe(50);
    });
  });

  describe('cache management', () => {
    const mockOrganization: IOrganizationResponse = {
      id: 789,
      name: 'Test Organization',
      categories: [{ id: 1, name: 'Meeting Rooms', isActive: true }],
      locationKinds: [{ id: 1, name: 'Room', allowsBooking: true }],
      rootLocation: { id: 100, name: 'Root' }
    };

    it('should clear all cache entries', async () => {
      mockApiClient.getOrganization = vi.fn().mockResolvedValue(mockOrganization);

      // Populate cache
      await service.getOrganization(789);
      await service.getBookingCategories(789);
      await service.getLocationKinds(789);
      
      // Clear cache
      service.clearCache();

      // Next calls should hit API again
      await service.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
    });

    it('should clear cache for specific organization', async () => {
      const org1 = { ...mockOrganization, id: 789 };
      const org2 = { ...mockOrganization, id: 456 };

      mockApiClient.getOrganization = vi.fn()
        .mockResolvedValueOnce(org1)
        .mockResolvedValueOnce(org2)
        .mockResolvedValueOnce(org1);

      // Populate cache for both organizations
      await service.getOrganization(789);
      await service.getOrganization(456);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);

      // Clear cache only for org 789
      service.clearCacheForOrganization(789);

      // Next call to org 789 should hit API, but org 456 should use cache
      await service.getOrganization(456); // Should use cache
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);

      await service.getOrganization(789); // Should hit API
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple organization cache properly', async () => {
      const org1 = { ...mockOrganization, id: 789, name: 'Org 1' };
      const org2 = { ...mockOrganization, id: 456, name: 'Org 2' };

      mockApiClient.getOrganization = vi.fn()
        .mockResolvedValueOnce(org1)
        .mockResolvedValueOnce(org2);

      // Cache both organizations
      const result1 = await service.getOrganization(789);
      const result2 = await service.getOrganization(456);

      expect(result1.name).toBe('Org 1');
      expect(result2.name).toBe('Org 2');
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);

      // Subsequent calls should use cache
      await service.getOrganization(789);
      await service.getOrganization(456);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling integration', () => {
    it('should maintain error chain when API call fails', async () => {
      const apiError = new Error('Matrix API error: 500 Internal Server Error') as Error & { 
        errorResponse?: { httpStatus: number } 
      };
      apiError.errorResponse = { httpStatus: 500 };
      
      mockApiClient.getOrganization = vi.fn().mockRejectedValue(apiError);

      try {
        await service.getOrganization(789);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(apiError);
        expect((error as typeof apiError).errorResponse?.httpStatus).toBe(500);
      }
    });

    it('should handle auth manager credential errors', async () => {
      const authError = new Error('Authentication credentials not available');
      mockAuthManager.getCredentials = vi.fn().mockImplementation(() => {
        throw authError;
      });

      await expect(service.getOrganization(789))
        .rejects.toThrow('Authentication credentials not available');
      
      expect(mockApiClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should handle validation errors before making API calls', async () => {
      // Test with invalid organization ID
      await expect(service.getOrganization(-1)).rejects.toThrow();
      await expect(service.getBookingCategories(0)).rejects.toThrow();
      await expect(service.getLocationKinds(1.5)).rejects.toThrow();

      // API should never be called
      expect(mockApiClient.getOrganization).not.toHaveBeenCalled();
    });
  });
});