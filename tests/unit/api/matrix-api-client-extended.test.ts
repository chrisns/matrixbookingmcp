import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatrixAPIClient } from '../../../src/api/matrix-api-client.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { IErrorHandler } from '../../../src/types/error.types.js';
import { 
  ICurrentUserResponse, 
  IUserBookingsRequest, 
  IUserBookingsResponse 
} from '../../../src/types/user.types.js';
import { 
  ILocationQueryRequest, 
  ILocationHierarchyResponse 
} from '../../../src/types/location.types.js';
import { IOrganizationResponse } from '../../../src/types/organization.types.js';
import { IAvailabilityResponse } from '../../../src/types/availability.types.js';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('MatrixAPIClient - Extended Endpoints', () => {
  let client: MatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockErrorHandler: IErrorHandler;
  let mockCredentials: ICredentials;
  let mockConfig: IServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock credentials
    const username = 'testuser';
    const password = 'testpass';
    const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
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

    // Create client instance
    client = new MatrixAPIClient(mockAuthManager, mockConfigManager, mockErrorHandler);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should successfully get current user', async () => {
      const mockUserResponse: ICurrentUserResponse = {
        id: 123,
        personId: 456,
        organisationId: 789,
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john.doe@example.com',
        roles: ['user'],
        preferences: {
          timezone: 'Europe/London',
          defaultLocationId: 42
        }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockUserResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getCurrentUser(mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/user/current',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `Basic ${mockCredentials.encodedCredentials}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'x-matrix-source': 'WEB',
            'x-time-zone': 'Europe/London'
          }
        })
      );
      expect(result).toEqual(mockUserResponse);
    });

    it('should handle API errors', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' })
      };

      const errorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'API request failed with status 401',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 401,
        requestId: 'test-request-id'
      };

      mockFetch.mockResolvedValue(mockErrorResponse);
      mockErrorHandler.handleAPIError = vi.fn().mockReturnValue(errorResponse);

      await expect(client.getCurrentUser(mockCredentials))
        .rejects.toThrow('API request failed with status 401');

      expect(mockErrorHandler.handleAPIError).toHaveBeenCalledWith(
        mockErrorResponse,
        { error: 'Unauthorized' }
      );
    });
  });

  describe('getUserBookings', () => {
    it('should successfully get user bookings with no parameters', async () => {
      const request: IUserBookingsRequest = {};
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

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockBookingsResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getUserBookings(request, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/user/current/bookings',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockBookingsResponse);
    });

    it('should successfully get user bookings with query parameters', async () => {
      const request: IUserBookingsRequest = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        status: 'ACTIVE',
        page: 1,
        pageSize: 10
      };

      const mockBookingsResponse: IUserBookingsResponse = {
        bookings: [],
        total: 0,
        page: 1,
        pageSize: 10
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockBookingsResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getUserBookings(request, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/user/current/bookings?startDate=2025-01-01&endDate=2025-01-31&status=ACTIVE&page=1&pageSize=10',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockBookingsResponse);
    });
  });

  describe('getAllBookings', () => {
    it('should successfully get all bookings', async () => {
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
            status: 'PENDING',
            timeFrom: '2025-01-15T14:00:00.000Z',
            timeTo: '2025-01-15T16:00:00.000Z',
            organisation: { id: 1, name: 'Test Organization' },
            locationId: 43,
            locationKind: 'ROOM',
            owner: { id: 789, name: 'Jane Smith', email: 'jane.smith@example.com' },
            bookedBy: { id: 789, name: 'Jane Smith', email: 'jane.smith@example.com' },
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
              approve: true,
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
        total: 2
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockBookingsResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getAllBookings(mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/booking',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockBookingsResponse);
    });
  });

  describe('getAvailability', () => {
    it('should successfully get availability', async () => {
      const mockAvailabilityResponse: IAvailabilityResponse = {
        available: true,
        slots: [
          {
            from: '2025-01-15T09:00:00.000Z',
            to: '2025-01-15T17:00:00.000Z',
            available: true,
            locationId: 42
          }
        ],
        location: {
          id: 42,
          name: 'Conference Room A',
          kind: 'ROOM'
        }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockAvailabilityResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getAvailability(mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/availability',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockAvailabilityResponse);
    });
  });

  describe('getLocationHierarchy', () => {
    it('should successfully get location hierarchy with no parameters', async () => {
      const request: ILocationQueryRequest = {};
      const mockHierarchyResponse: ILocationHierarchyResponse = {
        locations: [
          {
            id: 1,
            name: 'Building A',
            kind: 'building',
            isBookable: false
          },
          {
            id: 42,
            name: 'Conference Room A',
            kind: 'meeting_room',
            capacity: 10,
            isBookable: true,
            ancestors: [
              { id: 1, name: 'Building A', kind: 'building' }
            ]
          }
        ],
        total: 2,
        hierarchy: {
          1: [42]
        }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockHierarchyResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getLocationHierarchy(request, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/location',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockHierarchyResponse);
    });

    it('should successfully get location hierarchy with query parameters', async () => {
      const request: ILocationQueryRequest = {
        parentId: 1,
        kind: 'meeting_room',
        includeAncestors: true,
        includeFacilities: true,
        includeChildren: false,
        isBookable: true
      };

      const mockHierarchyResponse: ILocationHierarchyResponse = {
        locations: [
          {
            id: 42,
            name: 'Conference Room A',
            kind: 'meeting_room',
            capacity: 10,
            isBookable: true,
            facilities: [
              {
                id: 'wifi',
                name: 'WiFi',
                category: 'connectivity',
                value: true
              }
            ],
            ancestors: [
              { id: 1, name: 'Building A', kind: 'building' }
            ]
          }
        ],
        total: 1,
        hierarchy: {}
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockHierarchyResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getLocationHierarchy(request, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/location?parentId=1&kind=meeting_room&includeAncestors=true&includeFacilities=true&includeChildren=false&isBookable=true',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockHierarchyResponse);
    });
  });

  describe('getOrganization', () => {
    it('should successfully get organization data', async () => {
      const organizationId = 789;
      const mockOrgResponse: IOrganizationResponse = {
        id: 789,
        name: 'Test Organization',
        description: 'A test organization',
        categories: [
          {
            id: 1,
            name: 'Meeting',
            description: 'Meeting rooms',
            isActive: true
          }
        ],
        locationKinds: [
          {
            id: 1,
            name: 'meeting_room',
            description: 'Meeting Room',
            allowsBooking: true,
            capacity: { min: 1, max: 50 }
          }
        ],
        rootLocation: {
          id: 1,
          name: 'Main Building',
          kind: 'building'
        },
        settings: {
          timezone: 'Europe/London',
          businessHours: {
            start: '09:00',
            end: '17:00'
          },
          advanceBookingDays: 30
        }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue(mockOrgResponse)
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getOrganization(organizationId, mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.matrixbooking.com/api/v1/org/789',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockOrgResponse);
    });

    it('should handle organization not found error', async () => {
      const organizationId = 999;
      const mockErrorResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue({ error: 'Organization not found' })
      };

      const errorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: 'API request failed with status 404',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 404,
        requestId: 'test-request-id'
      };

      mockFetch.mockResolvedValue(mockErrorResponse);
      mockErrorHandler.handleAPIError = vi.fn().mockReturnValue(errorResponse);

      await expect(client.getOrganization(organizationId, mockCredentials))
        .rejects.toThrow('API request failed with status 404');
    });
  });

  describe('timeout handling', () => {
    it('should handle timeout for new endpoints', async () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'AbortError';

      const errorResponse = {
        error: {
          code: 'TIMEOUT',
          message: 'Request timed out after 5000ms',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 408,
        requestId: 'test-request-id'
      };

      mockFetch.mockRejectedValue(timeoutError);
      mockErrorHandler.handleTimeout = vi.fn().mockReturnValue(errorResponse);

      await expect(client.getCurrentUser(mockCredentials))
        .rejects.toThrow('Request timed out after 5000ms');

      expect(mockErrorHandler.handleTimeout).toHaveBeenCalled();
    });
  });

  describe('network error handling', () => {
    it('should handle network errors for new endpoints', async () => {
      const networkError = new Error('Network error');

      const errorResponse = {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network request failed',
          timestamp: '2025-01-01T12:00:00.000Z'
        },
        httpStatus: 500,
        requestId: 'test-request-id'
      };

      mockFetch.mockRejectedValue(networkError);
      mockErrorHandler.handleNetworkError = vi.fn().mockReturnValue(errorResponse);

      await expect(client.getUserBookings({}, mockCredentials))
        .rejects.toThrow('Network request failed');

      expect(mockErrorHandler.handleNetworkError).toHaveBeenCalledWith(networkError);
    });
  });
});