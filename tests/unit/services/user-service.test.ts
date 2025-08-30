import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../../src/services/user-service';

describe('UserService', () => {
  let service: UserService;
  let mockApiClient: any;
  let mockAuthManager: any;

  beforeEach(() => {
    mockApiClient = {
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn()
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

    service = new UserService(mockApiClient, mockAuthManager);
  });

  describe('getCurrentUser', () => {
    it('should get current user', async () => {
      const mockUser = {
        id: 1,
        personId: 123,
        name: 'Test User',
        email: 'test@example.com',
        organizationId: 456
      };

      mockApiClient.getCurrentUser.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser();

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password'
      });
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      mockApiClient.getCurrentUser.mockRejectedValue(new Error('User not found'));

      await expect(service.getCurrentUser()).rejects.toThrow('User not found');
    });

    it('should handle non-Error objects', async () => {
      mockApiClient.getCurrentUser.mockRejectedValue('String error');

      await expect(service.getCurrentUser()).rejects.toThrow('String error');
    });
  });

  describe('getUserBookings', () => {
    it('should get user bookings with default parameters', async () => {
      const mockBookings = {
        bookings: [
          {
            id: 1,
            locationId: 123,
            timeFrom: '2025-01-01T09:00:00',
            timeTo: '2025-01-01T10:00:00'
          },
          {
            id: 2,
            locationId: 456,
            timeFrom: '2025-01-02T14:00:00',
            timeTo: '2025-01-02T15:00:00'
          }
        ]
      };

      mockApiClient.getUserBookings.mockResolvedValue(mockBookings);

      const result = await service.getUserBookings({});

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.getUserBookings).toHaveBeenCalled();
      expect(result).toEqual(mockBookings);
    });

    it('should handle empty bookings', async () => {
      const mockBookings = {
        bookings: []
      };

      mockApiClient.getUserBookings.mockResolvedValue(mockBookings);

      const result = await service.getUserBookings({});

      expect(result).toEqual(mockBookings);
    });

    it('should handle API errors', async () => {
      mockApiClient.getUserBookings.mockRejectedValue(new Error('API Error'));

      await expect(service.getUserBookings({})).rejects.toThrow('API Error');
    });

    it('should handle non-Error objects', async () => {
      mockApiClient.getUserBookings.mockRejectedValue('String error');

      await expect(service.getUserBookings({})).rejects.toThrow('String error');
    });
  });

  describe('formatUserBookingsRequest', () => {
    it('should format user bookings request with defaults', () => {
      const result = (service as any).formatUserBookingsRequest({});

      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    it('should handle null input', () => {
      const result = (service as any).formatUserBookingsRequest(null);

      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    it('should handle undefined input', () => {
      const result = (service as any).formatUserBookingsRequest(undefined);

      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
    });

    it('should handle valid request object', () => {
      const request = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        status: 'ACTIVE'
      };

      const result = (service as any).formatUserBookingsRequest(request);

      expect(result).toHaveProperty('startDate', '2025-01-01');
      expect(result).toHaveProperty('endDate', '2025-01-31');
      expect(result).toHaveProperty('status', 'ACTIVE');
    });
  });
});