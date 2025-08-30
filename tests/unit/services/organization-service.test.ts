import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from '../../../src/services/organization-service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockApiClient: any;
  let mockConfigManager: any;
  let mockAuthManager: any;

  beforeEach(() => {
    mockApiClient = {
      getOrganization: vi.fn(),
      getCurrentUser: vi.fn()
    };

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        cacheEnabled: false,
        apiBaseUrl: 'https://api.example.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password',
        matrixPreferredLocation: '123'
      }),
      validateConfig: vi.fn()
    };

    mockAuthManager = {
      getCredentials: vi.fn().mockResolvedValue({
        username: 'test@example.com',
        password: 'password'
      }),
      createAuthHeader: vi.fn(),
      getCurrentUser: vi.fn(),
      isAuthenticated: vi.fn()
    };

    service = new OrganizationService(mockApiClient, mockConfigManager, mockAuthManager);
  });

  describe('getOrganization', () => {
    it('should get organization by ID', async () => {
      const mockOrg = {
        id: 123,
        name: 'Test Organization',
        settings: {
          defaultBookingDuration: 60,
          maxBookingDuration: 240
        }
      };

      mockApiClient.getOrganization.mockResolvedValue(mockOrg);

      const result = await service.getOrganization(123);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.getOrganization).toHaveBeenCalledWith(123, {
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockOrg);
    });

    it('should handle organization not found', async () => {
      mockApiClient.getOrganization.mockRejectedValue(new Error('Organization not found'));

      await expect(service.getOrganization(999)).rejects.toThrow('Organization not found');
    });

    it('should handle non-Error objects', async () => {
      mockApiClient.getOrganization.mockRejectedValue('String error');

      await expect(service.getOrganization(123)).rejects.toThrow('String error');
    });
  });

  describe('getBookingCategories', () => {
    it('should get booking categories', async () => {
      const mockOrg = {
        id: 123,
        name: 'Test Organization',
        categories: [
          { id: 1, nameSingle: 'Desk', locationKind: 'DESK' },
          { id: 2, nameSingle: 'Room', locationKind: 'ROOM' }
        ]
      };

      mockApiClient.getOrganization.mockResolvedValue(mockOrg);

      const result = await service.getBookingCategories(123);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 1, name: 'Desk' });
      expect(result[1]).toMatchObject({ id: 2, name: 'Room' });
    });

    it('should return empty array when no categories', async () => {
      const mockOrg = {
        id: 123,
        name: 'Test Organization',
        categories: []
      };

      mockApiClient.getOrganization.mockResolvedValue(mockOrg);

      const result = await service.getBookingCategories(123);

      expect(result).toEqual([]);
    });
  });

  describe('getLocationKinds', () => {
    it('should get location kinds', async () => {
      const mockOrg = {
        id: 123,
        name: 'Test Organization',
        locationKinds: [
          { value: 'DESK', label: 'Desk' },
          { value: 'ROOM', label: 'Room' }
        ]
      };

      mockApiClient.getOrganization.mockResolvedValue(mockOrg);

      const result = await service.getLocationKinds(123);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        expect.objectContaining({
          value: 'DESK'
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          value: 'ROOM'
        })
      );
    });
  });

  describe('validateOrganizationId', () => {
    it('should validate positive organization ID', () => {
      const result = (service as any).validateOrganizationId(123);
      expect(result).toBe(true);
    });

    it('should reject negative organization ID', () => {
      const result = (service as any).validateOrganizationId(-1);
      expect(result).toBe(false);
    });

    it('should reject zero organization ID', () => {
      const result = (service as any).validateOrganizationId(0);
      expect(result).toBe(false);
    });

    it('should reject non-integer organization ID', () => {
      const result = (service as any).validateOrganizationId(123.45);
      expect(result).toBe(false);
    });
  });
});