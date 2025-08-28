import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../../src/services/booking-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IAuthenticationManager, ICredentials, IUserProfile } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { ILocationService, ILocationHierarchyResponse } from '../../../src/types/location.types.js';

describe('BookingService - Location Resolution', () => {
  let bookingService: BookingService;
  let mockApiClient: IMatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockLocationService: ILocationService;

  const mockConfig: IServerConfig = {
    matrixUsername: 'test@example.com',
    matrixPassword: 'password',
    matrixPreferredLocation: '100001', // Building ID
    apiTimeout: 5000,
    apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
    cacheEnabled: true
  };

  const mockCredentials: ICredentials = {
    username: 'test@example.com',
    password: 'password',
    encodedCredentials: Buffer.from('test@example.com:password').toString('base64')
  };

  const mockUserProfile: IUserProfile = {
    id: 4112469005,
    personId: 4112469006,
    organisationId: 2147924904,
    firstName: 'Test',
    lastName: 'User',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['USER']
  };

  // Mock hierarchy data
  const mockPreferredBuildingHierarchy: ILocationHierarchyResponse = {
    locations: [
      { id: 100002, name: 'Conference Room A', kind: 'ROOM' },
      { id: 100003, name: 'Room 701', kind: 'ROOM' },
      { id: 100004, name: 'Meeting Room 105', kind: 'ROOM' },
      { id: 100005, name: 'Workshop Space', kind: 'ROOM' }
    ],
    total: 4,
    hierarchy: {}
  };

  const mockGlobalHierarchy: ILocationHierarchyResponse = {
    locations: [
      // Building A rooms
      { id: 100002, name: 'Conference Room A', kind: 'ROOM' },
      { id: 100003, name: 'Room 701', kind: 'ROOM' },
      { id: 100004, name: 'Meeting Room 105', kind: 'ROOM' },
      // Building B rooms (not in preferred building)
      { id: 200001, name: 'Conference Room A', kind: 'ROOM' }, // Duplicate name
      { id: 200002, name: 'Room 701', kind: 'ROOM' }, // Duplicate name
      { id: 200003, name: 'Executive Boardroom', kind: 'ROOM' }
    ],
    total: 6,
    hierarchy: {}
  };

  beforeEach(() => {
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getLocation: vi.fn(),
      makeRequest: vi.fn(),
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getAllBookings: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn()
    };

    mockAuthManager = {
      getCredentials: vi.fn(),
      createAuthHeader: vi.fn(),
      encodeCredentials: vi.fn(),
      getCurrentUser: vi.fn()
    };

    mockConfigManager = {
      getConfig: vi.fn(),
      validateConfig: vi.fn()
    };

    mockLocationService = {
      getLocation: vi.fn(),
      getPreferredLocation: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getLocationsByKind: vi.fn(),
      validateLocationId: vi.fn()
    };

    vi.mocked(mockConfigManager.getConfig).mockReturnValue(mockConfig);
    vi.mocked(mockAuthManager.getCredentials).mockResolvedValue(mockCredentials);
    vi.mocked(mockAuthManager.getCurrentUser).mockResolvedValue(mockUserProfile);

    bookingService = new BookingService(mockApiClient, mockAuthManager, mockConfigManager, mockLocationService);
  });

  describe('resolveLocationId', () => {
    describe('Direct Location ID (≥100000)', () => {
      it('should accept valid location ID ≥100000', async () => {
        const locationId = 123456;
        const mockLocation = { id: locationId, name: 'Test Room', kind: 'ROOM' };
        
        vi.mocked(mockLocationService.getLocation).mockResolvedValue(mockLocation);

        const result = await bookingService.resolveLocationId(locationId);

        expect(result).toBe(locationId);
        expect(mockLocationService.getLocation).toHaveBeenCalledWith(locationId);
      });

      it('should reject invalid location ID ≥100000', async () => {
        const locationId = 999999;
        
        vi.mocked(mockLocationService.getLocation).mockRejectedValue(new Error('Location not found'));

        await expect(bookingService.resolveLocationId(locationId))
          .rejects.toThrow('Location ID 999999 not found');
      });
    });

    describe('Room Number/Name Search (<100000)', () => {
      it('should find room in preferred building first', async () => {
        const roomNumber = 701;
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy) // Preferred building call
          .mockResolvedValueOnce(mockGlobalHierarchy); // Should not be called

        const result = await bookingService.resolveLocationId(roomNumber);

        expect(result).toBe(100003); // Room 701 from preferred building
        expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledWith({
          parentId: 100001,
          includeChildren: true,
          includeFacilities: false
        });
      });

      it('should find room by exact name match', async () => {
        const roomName = 'Conference Room A';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(100002);
      });

      it('should find room by partial name match', async () => {
        const partialName = 'workshop';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(partialName);

        expect(result).toBe(100005); // Workshop Space
      });

      it('should fall back to global search if not found in preferred building', async () => {
        const roomName = 'Executive Boardroom';
        
        // Not in preferred building
        const emptyPreferredHierarchy: ILocationHierarchyResponse = {
          locations: [],
          total: 0,
          hierarchy: {}
        };

        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(emptyPreferredHierarchy) // Preferred building (empty)
          .mockResolvedValueOnce(mockGlobalHierarchy); // Global search

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(200003); // Executive Boardroom from global search
        expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledTimes(2);
      });

      it('should prefer preferred building over global matches', async () => {
        const roomName = 'Conference Room A'; // Exists in both buildings
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(100002); // From preferred building, not 200001
        expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledTimes(1);
      });

      it('should handle room number extraction from room names', async () => {
        const roomNumber = '105';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(roomNumber);

        expect(result).toBe(100004); // Meeting Room 105
      });

      it('should throw error when location not found anywhere', async () => {
        const roomName = 'Nonexistent Room';
        
        const emptyHierarchy: ILocationHierarchyResponse = {
          locations: [],
          total: 0,
          hierarchy: {}
        };

        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(emptyHierarchy) // Preferred building
          .mockResolvedValueOnce(emptyHierarchy); // Global search

        await expect(bookingService.resolveLocationId(roomName))
          .rejects.toThrow('Location "Nonexistent Room" not found in organization hierarchy');
      });

      it('should handle API errors during location resolution', async () => {
        const roomName = 'Test Room';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockRejectedValue(new Error('API Error'));

        await expect(bookingService.resolveLocationId(roomName))
          .rejects.toThrow('Error resolving location "Test Room": API Error');
      });
    });

    describe('Edge Cases', () => {
      it('should handle string representation of large numbers', async () => {
        const locationId = '123456';
        
        // String representation of large numbers should be treated as search terms
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce({ locations: [], total: 0, hierarchy: {} }) // Preferred building (empty)
          .mockResolvedValueOnce({ locations: [], total: 0, hierarchy: {} }); // Global search (empty)

        await expect(bookingService.resolveLocationId(locationId))
          .rejects.toThrow('Location "123456" not found in organization hierarchy');

        // Should do string search, not direct ID lookup
        expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledTimes(2);
      });

      it('should handle case-insensitive searches', async () => {
        const roomName = 'CONFERENCE ROOM A';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(100002); // Should find despite case difference
      });

      it('should handle whitespace in search terms', async () => {
        const roomName = '  Conference Room A  ';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockPreferredBuildingHierarchy);

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(100002);
      });

      it('should handle invalid preferred location config gracefully', async () => {
        const invalidConfig = { ...mockConfig, matrixPreferredLocation: 'invalid' };
        vi.mocked(mockConfigManager.getConfig).mockReturnValue(invalidConfig);

        const roomName = 'Conference Room A';
        
        vi.mocked(mockLocationService.getLocationHierarchy)
          .mockResolvedValueOnce(mockGlobalHierarchy); // Skip preferred building, go to global

        const result = await bookingService.resolveLocationId(roomName);

        expect(result).toBe(100002); // Should still find in global search
      });
    });
  });

  describe('findLocationInHierarchy', () => {
    it('should find exact matches first', () => {
      const locations = [
        { id: 1, name: 'Room A Test' },
        { id: 2, name: 'Room A' },
        { id: 3, name: 'Room A Extended' }
      ];

      const result = bookingService['findLocationInHierarchy']('Room A', locations);

      expect(result).toEqual({ id: 2, name: 'Room A' });
    });

    it('should find partial matches when no exact match', () => {
      const locations = [
        { id: 1, name: 'Conference Room A' },
        { id: 2, name: 'Meeting Room B' }
      ];

      const result = bookingService['findLocationInHierarchy']('Conference', locations);

      expect(result).toEqual({ id: 1, name: 'Conference Room A' });
    });

    it('should extract room numbers from location names', () => {
      const locations = [
        { id: 1, name: 'Meeting Room 701' },
        { id: 2, name: 'Conference Room 105' }
      ];

      const result = bookingService['findLocationInHierarchy']('701', locations);

      expect(result).toEqual({ id: 1, name: 'Meeting Room 701' });
    });

    it('should return null when no matches found', () => {
      const locations = [
        { id: 1, name: 'Room A' },
        { id: 2, name: 'Room B' }
      ];

      const result = bookingService['findLocationInHierarchy']('Room C', locations);

      expect(result).toBeNull();
    });
  });
});