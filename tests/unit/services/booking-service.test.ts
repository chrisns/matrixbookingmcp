import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../../src/services/booking-service';

describe('BookingService', () => {
  let service: BookingService;
  let mockApiClient: any;
  let mockAuthManager: any;
  let mockConfigManager: any;
  let mockLocationService: any;

  beforeEach(() => {
    mockApiClient = {
      createBooking: vi.fn(),
      cancelBooking: vi.fn(),
      getBooking: vi.fn(),
      getAllBookings: vi.fn()
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

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        apiBaseUrl: 'https://api.example.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password',
        matrixPreferredLocation: '1000001'
      }),
      validateConfig: vi.fn()
    };

    mockLocationService = {
      getLocation: vi.fn(),
      getLocationHierarchy: vi.fn(),
      searchLocations: vi.fn()
    };

    service = new BookingService(mockApiClient, mockAuthManager, mockConfigManager, mockLocationService);
  });

  describe('createBooking', () => {
    it('should create booking with all fields', async () => {
      const bookingRequest = {
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00',
        label: 'Test meeting',
        owner: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com'
        },
        ownerIsAttendee: true,
        attendees: [],
        extraRequests: [],
        source: 'WEB'
      };

      const mockResponse = {
        id: 999,
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00'
      };

      mockApiClient.createBooking.mockResolvedValue(mockResponse);

      const result = await service.createBooking(bookingRequest);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.createBooking).toHaveBeenCalledWith(bookingRequest, {
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle booking creation errors', async () => {
      const bookingRequest = {
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00',
        owner: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com'
        },
        ownerIsAttendee: true,
        attendees: [],
        extraRequests: [],
        source: 'WEB'
      };

      mockApiClient.createBooking.mockRejectedValue(new Error('Booking failed'));

      await expect(service.createBooking(bookingRequest)).rejects.toThrow('Booking failed');
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking with reason', async () => {
      const request = {
        bookingId: 123,
        reason: 'Test cancellation'
      };

      mockApiClient.cancelBooking.mockResolvedValue({ success: true });

      await service.cancelBooking(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.cancelBooking).toHaveBeenCalledWith(
        request,
        {
          username: 'test@example.com',
          password: 'password'
        }
      );
    });

    it('should cancel booking without reason', async () => {
      const request = {
        bookingId: 123
      };

      mockApiClient.cancelBooking.mockResolvedValue({ success: true });

      await service.cancelBooking(request);

      expect(mockApiClient.cancelBooking).toHaveBeenCalledWith(
        request,
        {
          username: 'test@example.com',
          password: 'password'
        }
      );
    });

    it('should handle cancellation errors', async () => {
      const request = {
        bookingId: 123
      };

      mockApiClient.cancelBooking.mockRejectedValue(new Error('Cancel failed'));

      await expect(service.cancelBooking(request)).rejects.toThrow('Cancel failed');
    });
  });

  // getBooking method is not implemented in BookingService

  // getAllBookings method is not implemented in BookingService
});