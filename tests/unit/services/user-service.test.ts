import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../../src/services/user-service.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { ICurrentUserResponse, IUserBookingsRequest, IUserBookingsResponse } from '../../../src/types/user.types.js';

describe('UserService', () => {
  let service: UserService;
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

    // Setup mock API client with new methods
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
    service = new UserService(
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
      const newService = new UserService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager,
        mockErrorHandler
      );
      expect(newService).toBeInstanceOf(UserService);
    });

    it('should create instance with default error handler when not provided', () => {
      const newService = new UserService(
        mockApiClient,
        mockConfigManager,
        mockAuthManager
      );
      expect(newService).toBeInstanceOf(UserService);
    });
  });

  describe('getCurrentUser', () => {
    it('should successfully get current user with complete profile', async () => {
      const mockUserProfile: ICurrentUserResponse = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john.doe@example.com',
        roles: ['user', 'booking_admin'],
        preferences: {
          timezone: 'Europe/London',
          language: 'en',
          defaultLocationId: 42
        },
        permissions: ['read_bookings', 'create_bookings'],
        isAdmin: false
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(mockUserProfile);

      const result = await service.getCurrentUser();

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
      expect(result).toEqual(mockUserProfile);
    });

    it('should successfully get current user with minimal profile', async () => {
      const mockUserProfile: ICurrentUserResponse = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'Jane',
        lastName: 'Smith',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        roles: ['user']
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(mockUserProfile);

      const result = await service.getCurrentUser();

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
      expect(result).toEqual(mockUserProfile);
    });

    it('should validate required fields in user profile response', async () => {
      const invalidUserProfile = {
        id: 123,
        // Missing personId
        organisationId: 789,
        firstName: 'Invalid',
        lastName: 'User',
        name: 'Invalid User',
        email: 'invalid@example.com',
        roles: ['user']
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(invalidUserProfile);

      await expect(service.getCurrentUser())
        .rejects.toThrow('Invalid user profile response: missing required fields');

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
    });

    it('should validate email field in user profile response', async () => {
      const invalidUserProfile = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'Invalid',
        lastName: 'User',
        name: 'Invalid User',
        // Missing email
        roles: ['user']
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(invalidUserProfile);

      await expect(service.getCurrentUser())
        .rejects.toThrow('Invalid user profile response: missing required fields');

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
    });

    it('should validate name field in user profile response', async () => {
      const invalidUserProfile = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'Invalid',
        lastName: 'User',
        // Missing name
        email: 'invalid@example.com',
        roles: ['user']
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(invalidUserProfile);

      await expect(service.getCurrentUser())
        .rejects.toThrow('Invalid user profile response: missing required fields');

      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
    });

    it('should handle API client errors and re-throw them', async () => {
      const apiError = new Error('Matrix API error: 401 Unauthorized');
      
      mockApiClient.getCurrentUser = vi.fn().mockRejectedValue(apiError);

      await expect(service.getCurrentUser()).rejects.toThrow('Matrix API error: 401 Unauthorized');
      expect(mockApiClient.getCurrentUser).toHaveBeenCalledWith(mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'USER_SERVICE_ERROR',
          message: 'User service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getCurrentUser = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getCurrentUser()).rejects.toThrow('User service error occurred');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'USER_SERVICE_ERROR');
    });

    it('should handle user with admin role', async () => {
      const mockAdminProfile: ICurrentUserResponse = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        email: 'admin@example.com',
        roles: ['admin', 'user'],
        isAdmin: true,
        permissions: ['read_all', 'create_all', 'delete_all']
      };

      mockApiClient.getCurrentUser = vi.fn().mockResolvedValue(mockAdminProfile);

      const result = await service.getCurrentUser();

      expect(result.isAdmin).toBe(true);
      expect(result.roles).toContain('admin');
      expect(result.permissions).toContain('delete_all');
    });
  });

  describe('getUserBookings', () => {
    it('should successfully get user bookings with default request', async () => {
      const mockBookingsResponse: IUserBookingsResponse = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2025-01-15T09:00:00.000Z',
            timeTo: '2025-01-15T10:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 42,
            locationKind: 'ROOM',
            owner: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            bookedBy: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            attendeeCount: 1,
            ownerIsAttendee: true,
            source: 'WEB',
            version: 1,
            hasExternalNotes: false,
            isPrivate: false,
            duration: { millis: 3600000 },
            possibleActions: {
              edit: true,
              cancel: true,
              approve: false,
              confirm: false,
              endEarly: true,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'NOT_CHECKED_IN',
            checkInStartTime: '',
            checkInEndTime: '',
            hasStarted: false,
            hasEnded: false
          }
        ],
        total: 1
      };

      mockApiClient.getUserBookings = vi.fn().mockResolvedValue(mockBookingsResponse);

      const result = await service.getUserBookings();

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getUserBookings).toHaveBeenCalledWith({}, mockCredentials);
      expect(result).toEqual(mockBookingsResponse);
    });

    it('should successfully get user bookings with custom request parameters', async () => {
      const request: IUserBookingsRequest = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        status: 'ACTIVE',
        page: 1,
        pageSize: 10
      };

      const mockBookingsResponse: IUserBookingsResponse = {
        bookings: [
          {
            id: 1,
            status: 'CONFIRMED',
            timeFrom: '2025-01-15T09:00:00.000Z',
            timeTo: '2025-01-15T10:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 42,
            locationKind: 'ROOM',
            owner: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            bookedBy: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            attendeeCount: 1,
            ownerIsAttendee: true,
            source: 'WEB',
            version: 1,
            hasExternalNotes: false,
            isPrivate: false,
            duration: { millis: 3600000 },
            possibleActions: {
              edit: true,
              cancel: true,
              approve: false,
              confirm: false,
              endEarly: true,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'NOT_CHECKED_IN',
            checkInStartTime: '',
            checkInEndTime: '',
            hasStarted: false,
            hasEnded: false
          },
          {
            id: 2,
            status: 'CONFIRMED',
            timeFrom: '2025-01-20T14:00:00.000Z',
            timeTo: '2025-01-20T16:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 43,
            locationKind: 'ROOM',
            owner: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            bookedBy: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            attendeeCount: 1,
            ownerIsAttendee: true,
            source: 'WEB',
            version: 1,
            hasExternalNotes: false,
            isPrivate: false,
            duration: { millis: 7200000 },
            possibleActions: {
              edit: true,
              cancel: true,
              approve: false,
              confirm: false,
              endEarly: true,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'NOT_CHECKED_IN',
            checkInStartTime: '',
            checkInEndTime: '',
            hasStarted: false,
            hasEnded: false
          }
        ],
        total: 2,
        page: 1,
        pageSize: 10
      };

      mockApiClient.getUserBookings = vi.fn().mockResolvedValue(mockBookingsResponse);

      const result = await service.getUserBookings(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalledTimes(1);
      expect(mockApiClient.getUserBookings).toHaveBeenCalledWith(request, mockCredentials);
      expect(result).toEqual(mockBookingsResponse);
    });

    it('should handle empty bookings response', async () => {
      const mockEmptyResponse: IUserBookingsResponse = {
        bookings: [],
        total: 0
      };

      mockApiClient.getUserBookings = vi.fn().mockResolvedValue(mockEmptyResponse);

      const result = await service.getUserBookings();

      expect(result.bookings).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle API client errors and re-throw them', async () => {
      const request: IUserBookingsRequest = {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };
      const apiError = new Error('Matrix API error: 404 Not Found');
      
      mockApiClient.getUserBookings = vi.fn().mockRejectedValue(apiError);

      await expect(service.getUserBookings(request)).rejects.toThrow('Matrix API error: 404 Not Found');
      expect(mockApiClient.getUserBookings).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should handle unknown errors using error handler', async () => {
      const unknownError = 'Unknown error';
      const errorResponse = {
        error: {
          code: 'USER_SERVICE_ERROR',
          message: 'User service error occurred',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockApiClient.getUserBookings = vi.fn().mockRejectedValue(unknownError);
      mockErrorHandler.handleError = vi.fn().mockReturnValue(errorResponse);

      await expect(service.getUserBookings()).rejects.toThrow('User service error occurred');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(unknownError, 'USER_SERVICE_ERROR');
    });

    it('should handle paginated bookings response', async () => {
      const request: IUserBookingsRequest = {
        page: 2,
        pageSize: 5
      };

      const mockPaginatedResponse: IUserBookingsResponse = {
        bookings: [
          {
            id: 6,
            status: 'CONFIRMED',
            timeFrom: '2025-01-25T11:00:00.000Z',
            timeTo: '2025-01-25T12:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 44,
            locationKind: 'ROOM',
            owner: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            bookedBy: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            attendeeCount: 1,
            ownerIsAttendee: true,
            source: 'WEB',
            version: 1,
            hasExternalNotes: false,
            isPrivate: false,
            duration: { millis: 3600000 },
            possibleActions: {
              edit: true,
              cancel: true,
              approve: false,
              confirm: false,
              endEarly: true,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'NOT_CHECKED_IN',
            checkInStartTime: '',
            checkInEndTime: '',
            hasStarted: false,
            hasEnded: false
          }
        ],
        total: 11,
        page: 2,
        pageSize: 5
      };

      mockApiClient.getUserBookings = vi.fn().mockResolvedValue(mockPaginatedResponse);

      const result = await service.getUserBookings(request);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.total).toBe(11);
      expect(result.bookings).toHaveLength(1);
    });

    it('should handle different booking statuses', async () => {
      const cancelledRequest: IUserBookingsRequest = {
        status: 'CANCELLED'
      };

      const mockCancelledResponse: IUserBookingsResponse = {
        bookings: [
          {
            id: 99,
            status: 'CANCELLED',
            timeFrom: '2025-01-10T09:00:00.000Z',
            timeTo: '2025-01-10T10:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 42,
            locationKind: 'ROOM',
            owner: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            bookedBy: { id: 456, name: 'John Doe', email: 'john.doe@example.com' },
            attendeeCount: 1,
            ownerIsAttendee: true,
            source: 'WEB',
            version: 1,
            hasExternalNotes: false,
            isPrivate: false,
            duration: { millis: 3600000 },
            possibleActions: {
              edit: false,
              cancel: false,
              approve: false,
              confirm: false,
              endEarly: false,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'NOT_CHECKED_IN',
            checkInStartTime: '',
            checkInEndTime: '',
            hasStarted: false,
            hasEnded: false
          }
        ],
        total: 1
      };

      mockApiClient.getUserBookings = vi.fn().mockResolvedValue(mockCancelledResponse);

      const result = await service.getUserBookings(cancelledRequest);

      expect(mockApiClient.getUserBookings).toHaveBeenCalledWith(cancelledRequest, mockCredentials);
      expect(result.bookings[0]?.status).toBe('CANCELLED');
    });
  });

  describe('error handling integration', () => {
    it('should maintain error chain when API call fails in getCurrentUser', async () => {
      const apiError = new Error('Matrix API error: 403 Forbidden') as Error & { 
        errorResponse?: { httpStatus: number } 
      };
      apiError.errorResponse = { httpStatus: 403 };
      
      mockApiClient.getCurrentUser = vi.fn().mockRejectedValue(apiError);

      try {
        await service.getCurrentUser();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(apiError); // Should be the same error object
        expect((error as typeof apiError).errorResponse?.httpStatus).toBe(403);
      }
    });

    it('should maintain error chain when API call fails in getUserBookings', async () => {
      const apiError = new Error('Matrix API error: 500 Internal Server Error') as Error & { 
        errorResponse?: { httpStatus: number } 
      };
      apiError.errorResponse = { httpStatus: 500 };
      
      mockApiClient.getUserBookings = vi.fn().mockRejectedValue(apiError);

      try {
        await service.getUserBookings();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(apiError); // Should be the same error object
        expect((error as typeof apiError).errorResponse?.httpStatus).toBe(500);
      }
    });

    it('should handle auth manager credential errors', async () => {
      const authError = new Error('Authentication credentials not available');
      mockAuthManager.getCredentials = vi.fn().mockImplementation(() => {
        throw authError;
      });

      await expect(service.getCurrentUser()).rejects.toThrow('Authentication credentials not available');
      expect(mockApiClient.getCurrentUser).not.toHaveBeenCalled();
    });
  });
});