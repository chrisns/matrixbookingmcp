import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationService } from '../../../src/services/organization-service.js';
import { IOrganizationResponse } from '../../../src/types/organization.types.js';

describe('OrganizationService Cache Configuration', () => {
  let organizationService: OrganizationService;
  let mockApiClient: any;
  let mockConfigManager: any;
  let mockAuthManager: any;

  const mockOrganizationData: IOrganizationResponse = {
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
      }
    ],
    locationKinds: [
      {
        id: 1,
        name: 'Building',
        description: 'Main building structure',
        allowsBooking: false
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

  beforeEach(() => {
    mockApiClient = {
      getOrganization: vi.fn(),
    } as any;

    mockAuthManager = {
      getCredentials: vi.fn().mockReturnValue({
        username: 'testuser',
        password: 'testpass',
        encodedCredentials: 'dGVzdDp0ZXN0'
      }),
    } as any;

    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('when caching is enabled (CACHE_ENABLED=true)', () => {
    beforeEach(() => {
      mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          matrixUsername: 'testuser',
          matrixPassword: 'testpass',
          matrixPreferredLocation: '1',
          apiTimeout: 5000,
          apiBaseUrl: 'https://test.api.com',
          cacheEnabled: true
        }),
        validateConfig: vi.fn()
      } as any;

      organizationService = new OrganizationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );

      mockApiClient.getOrganization.mockResolvedValue(mockOrganizationData);
    });

    it('should cache data and return cached data on subsequent calls', async () => {
      // First call should hit API and cache the result
      const result1 = await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockOrganizationData);

      // Second call should return cached data without hitting API
      const result2 = await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result2).toEqual(mockOrganizationData);
    });

    it('should cache booking categories separately', async () => {
      // First call to getBookingCategories should call getOrganization (which hits API)
      const categories1 = await organizationService.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(categories1).toEqual(mockOrganizationData.categories);

      // Second call should use cached categories
      const categories2 = await organizationService.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1); // Still 1
      expect(categories2).toEqual(mockOrganizationData.categories);
    });
  });

  describe('when caching is disabled (CACHE_ENABLED=false)', () => {
    beforeEach(() => {
      mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          matrixUsername: 'testuser',
          matrixPassword: 'testpass',
          matrixPreferredLocation: '1',
          apiTimeout: 5000,
          apiBaseUrl: 'https://test.api.com',
          cacheEnabled: false
        }),
        validateConfig: vi.fn()
      } as any;

      organizationService = new OrganizationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );

      mockApiClient.getOrganization.mockResolvedValue(mockOrganizationData);
    });

    it('should not cache data and hit API on every call', async () => {
      // First call should hit API
      const result1 = await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockOrganizationData);

      // Second call should hit API again (no caching)
      const result2 = await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
      expect(result2).toEqual(mockOrganizationData);
    });

    it('should not cache booking categories', async () => {
      // First call to getBookingCategories should call getOrganization
      const categories1 = await organizationService.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(categories1).toEqual(mockOrganizationData.categories);

      // Second call should hit API again for fresh organization data
      const categories2 = await organizationService.getBookingCategories(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
      expect(categories2).toEqual(mockOrganizationData.categories);
    });

    it('should not cache location kinds', async () => {
      // First call to getLocationKinds should call getOrganization
      const locationKinds1 = await organizationService.getLocationKinds(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);
      expect(locationKinds1).toEqual(mockOrganizationData.locationKinds);

      // Second call should hit API again for fresh organization data
      const locationKinds2 = await organizationService.getLocationKinds(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
      expect(locationKinds2).toEqual(mockOrganizationData.locationKinds);
    });
  });

  describe('cache configuration switching', () => {
    it('should respect configuration changes during runtime', async () => {
      // Start with caching enabled
      let cacheEnabled = true;
      mockConfigManager = {
        getConfig: vi.fn().mockImplementation(() => ({
          matrixUsername: 'testuser',
          matrixPassword: 'testpass',
          matrixPreferredLocation: '1',
          apiTimeout: 5000,
          apiBaseUrl: 'https://test.api.com',
          cacheEnabled
        })),
        validateConfig: vi.fn()
      } as any;

      organizationService = new OrganizationService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );

      mockApiClient.getOrganization.mockResolvedValue(mockOrganizationData);

      // First call with caching enabled - should cache
      await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);

      // Second call with caching enabled - should use cache
      await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(1);

      // Simulate configuration change to disable caching
      cacheEnabled = false;

      // Third call with caching disabled - should hit API
      await organizationService.getOrganization(789);
      expect(mockApiClient.getOrganization).toHaveBeenCalledTimes(2);
    });
  });
});