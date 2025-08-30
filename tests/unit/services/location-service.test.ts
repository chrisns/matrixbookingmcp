import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from '../../../src/services/location-service';

describe('LocationService', () => {
  let service: LocationService;
  let mockApiClient: any;
  let mockConfigManager: any;
  let mockAuthManager: any;

  beforeEach(() => {
    mockApiClient = {
      getLocation: vi.fn(),
      getLocationHierarchy: vi.fn()
    };

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        matrixPreferredLocation: '1000001',
        apiBaseUrl: 'https://api.example.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password'
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

    service = new LocationService(mockApiClient, mockConfigManager, mockAuthManager);
  });

  describe('getLocation', () => {
    it('should get location by ID', async () => {
      const mockLocation = {
        id: 123,
        name: 'Test Room',
        kind: 'ROOM',
        facilities: []
      };

      mockApiClient.getLocation.mockResolvedValue(mockLocation);

      const result = await service.getLocation(123);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.getLocation).toHaveBeenCalledWith(123, {
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockLocation);
    });

    it('should handle location not found', async () => {
      mockApiClient.getLocation.mockRejectedValue(new Error('Location not found'));

      await expect(service.getLocation(999)).rejects.toThrow('Location not found');
    });
  });

  describe('getLocationHierarchy', () => {
    it('should get location hierarchy with options', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Building 1',
            kind: 'BUILDING',
            children: [
              { id: 2, name: 'Floor 1', kind: 'FLOOR' }
            ]
          }
        ]
      };

      mockApiClient.getLocationHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getLocationHierarchy({
        locationId: 123,
        includeChildren: true,
        includeFacilities: true
      });

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {
          locationId: 123,
          includeChildren: true,
          includeFacilities: true
        },
        {
          username: 'test@example.com',
          password: 'password'
        }
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should get location hierarchy without parameters', async () => {
      const mockHierarchy = {
        locations: []
      };

      mockApiClient.getLocationHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getLocationHierarchy();

      expect(mockApiClient.getLocationHierarchy).toHaveBeenCalledWith(
        {},
        {
          username: 'test@example.com',
          password: 'password'
        }
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should handle API errors', async () => {
      mockApiClient.getLocationHierarchy.mockRejectedValue(new Error('API Error'));

      await expect(service.getLocationHierarchy({})).rejects.toThrow('API Error');
    });
  });

  describe('getPreferredLocation', () => {
    it('should get preferred location from config', async () => {
      const mockLocation = {
        id: 1000001,
        name: 'Main Building',
        kind: 'BUILDING'
      };

      mockApiClient.getLocation.mockResolvedValue(mockLocation);

      const result = await service.getPreferredLocation();

      expect(mockApiClient.getLocation).toHaveBeenCalledWith(1000001, {
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockLocation);
    });

    it('should throw error when no preferred location configured', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        apiBaseUrl: 'https://api.example.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password',
        matrixPreferredLocation: undefined
      });

      await expect(service.getPreferredLocation()).rejects.toThrow('Invalid MATRIX_PREFERED_LOCATION');
    });
  });

  describe('getLocationsByKind', () => {
    it('should get locations by kind', async () => {
      const mockHierarchy = {
        locations: [
          { id: 1, name: 'Room 1', kind: 'ROOM' },
          { id: 2, name: 'Room 2', kind: 'ROOM' },
          { id: 3, name: 'Desk 1', kind: 'DESK' }
        ]
      };

      mockApiClient.getLocationHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getLocationsByKind('ROOM');

      expect(result).toEqual([
        { id: 1, name: 'Room 1', kind: 'ROOM' },
        { id: 2, name: 'Room 2', kind: 'ROOM' }
      ]);
    });

    it('should return empty array when no locations match', async () => {
      const mockHierarchy = {
        locations: [
          { id: 1, name: 'Desk 1', kind: 'DESK' }
        ]
      };

      mockApiClient.getLocationHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getLocationsByKind('ROOM');

      expect(result).toEqual([]);
    });
  });
});