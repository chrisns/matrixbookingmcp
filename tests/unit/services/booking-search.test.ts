import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from '../../../src/services/booking-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IAuthenticationManager } from '../../../src/types/authentication.types.js';
import { IConfigurationManager } from '../../../src/config/config-manager.js';
import { ILocationService } from '../../../src/types/location.types.js';
import { IBookingSearchRequest } from '../../../src/types/booking.types.js';

describe('BookingService - searchBookings', () => {
  let bookingService: BookingService;
  let mockApiClient: IMatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockLocationService: ILocationService;

  beforeEach(() => {
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      getLocation: vi.fn(),
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getAllBookings: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn(),
      searchUsers: vi.fn(),
      getUserFilteredBookings: vi.fn(),
      cancelBooking: vi.fn(),
      makeRequest: vi.fn()
    } as IMatrixAPIClient;

    mockAuthManager = {
      getCredentials: vi.fn().mockResolvedValue({ token: 'test-token' }),
      getCurrentUser: vi.fn().mockResolvedValue({ 
        email: 'test@example.com', 
        personId: 123,
        name: 'Test User' 
      }),
      validateCredentials: vi.fn(),
      refreshToken: vi.fn(),
      encodeCredentials: vi.fn(),
      createAuthHeader: vi.fn()
    } as IAuthenticationManager;

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        matrixApiUrl: 'https://api.test.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password',
        matrixPreferredLocation: '100000'
      }),
      validateConfig: vi.fn(),
      updateConfig: vi.fn()
    } as IConfigurationManager;

    mockLocationService = {
      getLocation: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getPreferredLocation: vi.fn(),
      getLocationsByKind: vi.fn(),
      getLocationDetails: vi.fn(),
      searchLocations: vi.fn(),
      getLocationById: vi.fn(),
      validateLocationId: vi.fn(),
      getLocationChildren: vi.fn()
    } as ILocationService;

    bookingService = new BookingService(
      mockApiClient,
      mockAuthManager,
      mockConfigManager,
      mockLocationService
    );
  });

  describe('searchBookings', () => {
    it('should search bookings with date range', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            locationName: 'Room 101',
            locationKind: 'ROOM',
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          }
        ],
        total: 1
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01'
      };

      const result = await bookingService.searchBookings(request);

      expect(mockApiClient.getAllBookings).toHaveBeenCalledWith(
        { token: 'test-token' },
        undefined,
        '2024-01-01T00:00:00',
        '2024-01-01T00:00:00',
        undefined
      );

      expect(result.bookings).toHaveLength(1);
      expect(result.summary.totalBookings).toBe(1);
      expect(result.summary.uniqueUsers).toBe(1);
      expect(result.summary.uniqueLocations).toBe(1);
    });

    it('should filter by user when includeAllUsers is false', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          },
          {
            id: 2,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T11:00:00',
            timeTo: '2024-01-01T12:00:00',
            locationId: 100002,
            owner: { id: 456, email: 'other@example.com', name: 'Other User' },
            bookedBy: { id: 456, email: 'other@example.com', name: 'Other User' }
          }
        ],
        total: 2
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01',
        includeAllUsers: false
      };

      const result = await bookingService.searchBookings(request);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]!.owner?.email).toBe('test@example.com');
    });

    it('should include all users when includeAllUsers is true', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          },
          {
            id: 2,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T11:00:00',
            timeTo: '2024-01-01T12:00:00',
            locationId: 100002,
            owner: { id: 456, email: 'other@example.com', name: 'Other User' },
            bookedBy: { id: 456, email: 'other@example.com', name: 'Other User' }
          }
        ],
        total: 2
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01',
        includeAllUsers: true
      };

      const result = await bookingService.searchBookings(request);

      expect(result.bookings).toHaveLength(2);
      expect(result.summary.uniqueUsers).toBe(2);
    });

    it('should group results by user', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          },
          {
            id: 2,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T11:00:00',
            timeTo: '2024-01-01T12:00:00',
            locationId: 100002,
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          }
        ],
        total: 2
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01',
        groupBy: 'user'
      };

      const result = await bookingService.searchBookings(request);

      expect(result.groupedResults).toBeDefined();
      expect(result.groupedResults!['Test User']).toHaveLength(2);
    });

    it('should filter by location kind', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            locationKind: 'ROOM',
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          },
          {
            id: 2,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T11:00:00',
            timeTo: '2024-01-01T12:00:00',
            locationId: 100002,
            locationKind: 'DESK',
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          }
        ],
        total: 2
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01',
        locationKind: 'DESK'
      };

      const result = await bookingService.searchBookings(request);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]!.locationKind).toBe('DESK');
    });

    it('should include location details when requested', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2024-01-01T09:00:00',
            timeTo: '2024-01-01T10:00:00',
            locationId: 100001,
            owner: { id: 123, email: 'test@example.com', name: 'Test User' },
            bookedBy: { id: 123, email: 'test@example.com', name: 'Test User' }
          }
        ],
        total: 1
      };

      const mockLocation = {
        id: 100001,
        name: 'Room 101',
        kind: 'ROOM',
        qualifiedName: 'Building A/Floor 1/Room 101',
        facilities: [
          { id: '1', name: 'Screen', text: 'Projector Screen', category: 'equipment' }
        ]
      };

      (mockApiClient.getAllBookings as any).mockResolvedValue(mockBookings);
      (mockLocationService.getLocation as any).mockResolvedValue(mockLocation);

      const request: IBookingSearchRequest = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01',
        includeLocationDetails: true,
        includeFacilities: true
      };

      const result = await bookingService.searchBookings(request);

      expect(result.bookings[0]!.location).toBeDefined();
      expect(result.bookings[0]!.location?.name).toBe('Room 101');
      expect(result.bookings[0]!.location?.facilities).toHaveLength(1);
    });
  });
});