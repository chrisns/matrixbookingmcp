import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from '../../src/services/availability-service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let mockApiClient: any;
  let mockConfigManager: any;
  let mockAuthManager: any;

  beforeEach(() => {
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      cancelBooking: vi.fn(),
      getLocation: vi.fn(),
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn(),
      getLocationHierarchy: vi.fn(),
      getOrganization: vi.fn(),
      makeRequest: vi.fn(),
      getBooking: vi.fn(),
      getAllBookings: vi.fn(),
      getRoomAvailability: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn()
    } as any;

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        apiBaseUrl: 'https://api.example.com',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password',
        matrixPreferredLocation: '123',
        defaultBookingCategory: 9000001
      }),
      validateConfig: vi.fn()
    } as any;

    mockAuthManager = {
      getCredentials: vi.fn().mockResolvedValue({
        username: 'test@example.com',
        password: 'password'
      }),
      createAuthHeader: vi.fn(),
      getCurrentUser: vi.fn(),
      isAuthenticated: vi.fn()
    } as any;

    service = new AvailabilityService(mockApiClient, mockConfigManager, mockAuthManager);
  });

  describe('checkAvailability', () => {
    it('should check availability with correct parameters', async () => {
      const request = {
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00',
        bookingCategory: 456
      };

      const expectedResponse = {
        available: true,
        locations: [],
        availability: []
      };

      mockApiClient.checkAvailability.mockResolvedValue(expectedResponse);

      const result = await service.checkAvailability(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(request, {
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle API errors', async () => {
      const request = {
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00'
      };

      mockApiClient.checkAvailability.mockRejectedValue(new Error('API Error'));

      await expect(service.checkAvailability(request)).rejects.toThrow('API Error');
    });

    it('should handle non-Error objects', async () => {
      const request = {
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00'
      };

      mockApiClient.checkAvailability.mockRejectedValue('String error');

      await expect(service.checkAvailability(request)).rejects.toThrow('Failed to check availability');
    });
  });

  describe('checkAvailabilitySimple', () => {
    it('should use default booking category', async () => {
      const expectedResponse = {
        available: true,
        locations: [],
        availability: []
      };

      mockApiClient.checkAvailability.mockResolvedValue(expectedResponse);

      await service.checkAvailabilitySimple(123, '2025-01-01T09:00:00', '2025-01-01T10:00:00');

      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 123,
          dateFrom: '2025-01-01T09:00:00',
          dateTo: '2025-01-01T10:00:00',
          bookingCategory: 9000001 // Default desk category
        }),
        expect.any(Object)
      );
    });

    it('should use provided booking category', async () => {
      const expectedResponse = {
        available: true,
        locations: [],
        availability: []
      };

      mockApiClient.checkAvailability.mockResolvedValue(expectedResponse);

      await service.checkAvailabilitySimple(
        123, 
        '2025-01-01T09:00:00', 
        '2025-01-01T10:00:00',
        789
      );

      expect(mockApiClient.checkAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingCategory: 789
        }),
        expect.any(Object)
      );
    });
  });
});