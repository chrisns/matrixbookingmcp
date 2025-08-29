import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../../src/services/booking-service.js';
import { IBookingRequest, IBookingResponse, IOwner, IAttendee, ICancelBookingRequest, ICancelBookingResponse } from '../../../src/types/booking.types.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IAuthenticationManager, ICredentials, IUserProfile } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { ILocation, ILocationService } from '../../../src/types/location.types.js';

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockApiClient: IMatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;
  let mockLocationService: ILocationService;

  const mockConfig: IServerConfig = {
    matrixUsername: 'test@example.com',
    matrixPassword: 'password',
    matrixPreferredLocation: '123',
    apiTimeout: 5000,
    apiBaseUrl: 'https://app.matrixbooking.com/api/v1',
    cacheEnabled: true
  };

  const username = 'test@example.com';
  const password = 'password';
  const mockCredentials: ICredentials = {
    username,
    password,
    encodedCredentials: Buffer.from(`${username}:${password}`).toString('base64')
  };

  const mockLocation: ILocation = {
    id: 123,
    name: 'Conference Room A',
    capacity: 10,
    features: ['Projector', 'Whiteboard']
  };

  const mockOwner: IOwner = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockAttendee: IAttendee = {
    id: 2,
    email: 'attendee@example.com',
    name: 'Attendee User'
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

  beforeEach(() => {
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      cancelBooking: vi.fn(),
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

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      const request: IBookingRequest = {
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        locationId: 123,
        attendees: [mockAttendee],
        extraRequests: ['Projector'],
        owner: mockOwner,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      };

      const expectedResponse: IBookingResponse = {
        id: 456,
        status: 'CONFIRMED',
        timeFrom: request.timeFrom,
        timeTo: request.timeTo,
        organisation: { id: 1, name: 'Test Organization' },
        locationId: mockLocation.id,
        locationKind: 'Conference Room',
        owner: mockOwner,
        bookedBy: mockOwner,
        attendeeCount: 1,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp',
        version: 1,
        hasExternalNotes: false,
        isPrivate: false,
        duration: { millis: 3600000 },
        possibleActions: {
          edit: true,
          cancel: true,
          approve: false,
          confirm: false,
          endEarly: false,
          changeOwner: false,
          start: false,
          viewHistory: false
        },
        checkInStatus: 'NOT_CHECKED_IN',
        checkInStartTime: '',
        checkInEndTime: '',
        hasStarted: false,
        hasEnded: false
      };

      vi.mocked(mockApiClient.createBooking).mockResolvedValue(expectedResponse);

      const result = await bookingService.createBooking(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.createBooking).toHaveBeenCalledWith(request, mockCredentials);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle API errors properly', async () => {
      const request: IBookingRequest = {
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: mockOwner,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      };

      const apiError = new Error('Room not available') as Error & { errorResponse?: unknown };
      apiError.errorResponse = { error: { message: 'Room not available', code: 'UNAVAILABLE' } };
      
      vi.mocked(mockApiClient.createBooking).mockRejectedValue(apiError);

      await expect(bookingService.createBooking(request)).rejects.toThrow('Room not available');
      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
      expect(mockApiClient.createBooking).toHaveBeenCalledWith(request, mockCredentials);
    });
  });

  describe('formatBookingRequest', () => {
    it('should apply default values for empty request', async () => {
      const partialRequest: Partial<IBookingRequest> = {};
      const result = await bookingService.formatBookingRequest(partialRequest);

      expect(result.locationId).toBe(123);
      expect(result.attendees).toEqual([]);
      expect(result.extraRequests).toEqual([]);
      expect(result.ownerIsAttendee).toBe(true);
      expect(result.source).toBe('matrix-booking-mcp');
      expect(result.owner.id).toBe(4112469006); // Real personId from user profile
      expect(result.owner.email).toBe('test@example.com');
      expect(result.owner.name).toBe('Test User');

      // Validate date formats - Matrix API expects local timezone (no Z suffix)
      expect(result.timeFrom).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00\.000$/);
      expect(result.timeTo).toMatch(/^\d{4}-\d{2}-\d{2}T10:00:00\.000$/);
    });

    it('should preserve provided values and only apply defaults for missing fields', async () => {
      const partialRequest: Partial<IBookingRequest> = {
        timeFrom: '2024-01-15T14:00:00.000Z',
        timeTo: '2024-01-15T15:00:00.000Z',
        locationId: 456,
        attendees: [mockAttendee],
        owner: mockOwner,
        ownerIsAttendee: false,
        source: 'custom-source'
      };

      const result = await bookingService.formatBookingRequest(partialRequest);

      expect(result.timeFrom).toBe('2024-01-15T14:00:00.000Z');
      expect(result.timeTo).toBe('2024-01-15T15:00:00.000Z');
      expect(result.locationId).toBe(456);
      expect(result.attendees).toEqual([mockAttendee]);
      expect(result.owner).toEqual(mockOwner);
      expect(result.ownerIsAttendee).toBe(false);
      expect(result.source).toBe('custom-source');
      expect(result.extraRequests).toEqual([]); // Default applied
    });

    it('should handle partial owner information', async () => {
      const partialRequest: Partial<IBookingRequest> = {};

      const result = await bookingService.formatBookingRequest(partialRequest);

      expect(result.owner.id).toBe(4112469006); // Real personId from user profile
      expect(result.owner.email).toBe('test@example.com');
      expect(result.owner.name).toBe('Test User');
    });
  });

  describe('validateBookingRequest', () => {
    const validRequest: IBookingRequest = {
      timeFrom: '2024-01-15T09:00:00.000Z',
      timeTo: '2024-01-15T10:00:00.000Z',
      locationId: 123,
      attendees: [mockAttendee],
      extraRequests: ['Projector'],
      owner: mockOwner,
      ownerIsAttendee: true,
      source: 'matrix-booking-mcp'
    };

    it('should return true for valid request', () => {
      expect(bookingService.validateBookingRequest(validRequest)).toBe(true);
    });

    it('should return false for missing timeFrom', () => {
      const invalidRequest = { ...validRequest, timeFrom: '' };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for missing timeTo', () => {
      const invalidRequest = { ...validRequest, timeTo: '' };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for invalid date format', () => {
      const invalidRequest = { ...validRequest, timeFrom: 'invalid-date' };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false when timeTo is before timeFrom', () => {
      const invalidRequest = {
        ...validRequest,
        timeFrom: '2024-01-15T10:00:00.000Z',
        timeTo: '2024-01-15T09:00:00.000Z'
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false when timeTo equals timeFrom', () => {
      const invalidRequest = {
        ...validRequest,
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T09:00:00.000Z'
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for invalid locationId', () => {
      const invalidRequest = { ...validRequest, locationId: -1 };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for zero locationId', () => {
      const invalidRequest = { ...validRequest, locationId: 0 };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for non-integer locationId', () => {
      const invalidRequest = { ...validRequest, locationId: 123.45 };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for missing owner', () => {
      const invalidRequest = { ...validRequest, owner: undefined as any };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for owner without email', () => {
      const invalidRequest = {
        ...validRequest,
        owner: { ...mockOwner, email: '' }
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for owner without name', () => {
      const invalidRequest = {
        ...validRequest,
        owner: { ...mockOwner, name: '' }
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for attendee without email', () => {
      const invalidRequest = {
        ...validRequest,
        attendees: [{ ...mockAttendee, email: '' }]
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for attendee without name', () => {
      const invalidRequest = {
        ...validRequest,
        attendees: [{ ...mockAttendee, name: '' }]
      };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for empty source', () => {
      const invalidRequest = { ...validRequest, source: '' };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return false for whitespace-only source', () => {
      const invalidRequest = { ...validRequest, source: '   ' };
      expect(bookingService.validateBookingRequest(invalidRequest)).toBe(false);
    });

    it('should return true for empty attendees array', () => {
      const validRequestWithEmptyAttendees = { ...validRequest, attendees: [] };
      expect(bookingService.validateBookingRequest(validRequestWithEmptyAttendees)).toBe(true);
    });

    it('should return true for empty extraRequests array', () => {
      const validRequestWithEmptyExtras = { ...validRequest, extraRequests: [] };
      expect(bookingService.validateBookingRequest(validRequestWithEmptyExtras)).toBe(true);
    });
  });

  describe('integration with dependencies', () => {
    it('should use configuration manager for defaults', () => {
      bookingService.formatBookingRequest({});
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });

    it('should use authentication manager for credentials', async () => {
      const request: IBookingRequest = {
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: mockOwner,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      };

      const mockResponse: IBookingResponse = {
        id: 456,
        status: 'CONFIRMED',
        timeFrom: request.timeFrom,
        timeTo: request.timeTo,
        organisation: { id: 1, name: 'Test Organization' },
        locationId: mockLocation.id,
        locationKind: 'Conference Room',
        owner: mockOwner,
        bookedBy: mockOwner,
        attendeeCount: 0,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp',
        version: 1,
        hasExternalNotes: false,
        isPrivate: false,
        duration: { millis: 3600000 },
        possibleActions: {
          edit: true,
          cancel: true,
          approve: false,
          confirm: false,
          endEarly: false,
          changeOwner: false,
          start: false,
          viewHistory: false
        },
        checkInStatus: 'NOT_CHECKED_IN',
        checkInStartTime: '',
        checkInEndTime: '',
        hasStarted: false,
        hasEnded: false
      };

      vi.mocked(mockApiClient.createBooking).mockResolvedValue(mockResponse);

      await bookingService.createBooking(request);

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
    });

    it('should pass formatted request to API client', async () => {
      const request: IBookingRequest = {
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: mockOwner,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      };

      const mockResponse: IBookingResponse = {
        id: 456,
        status: 'CONFIRMED',
        timeFrom: request.timeFrom,
        timeTo: request.timeTo,
        organisation: { id: 1, name: 'Test Organization' },
        locationId: mockLocation.id,
        locationKind: 'Conference Room',
        owner: mockOwner,
        bookedBy: mockOwner,
        attendeeCount: 0,
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp',
        version: 1,
        hasExternalNotes: false,
        isPrivate: false,
        duration: { millis: 3600000 },
        possibleActions: {
          edit: true,
          cancel: true,
          approve: false,
          confirm: false,
          endEarly: false,
          changeOwner: false,
          start: false,
          viewHistory: false
        },
        checkInStatus: 'NOT_CHECKED_IN',
        checkInStartTime: '',
        checkInEndTime: '',
        hasStarted: false,
        hasEnded: false
      };

      vi.mocked(mockApiClient.createBooking).mockResolvedValue(mockResponse);

      await bookingService.createBooking(request);

      expect(mockApiClient.createBooking).toHaveBeenCalledWith(request, mockCredentials);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully with valid booking ID', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 123456,
        notifyScope: 'ALL_ATTENDEES',
        sendNotifications: true,
        reason: 'Meeting cancelled due to schedule conflict'
      };

      const expectedResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 123456,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T12:00:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        reason: 'Meeting cancelled due to schedule conflict',
        originalBooking: {
          locationId: 123,
          locationName: 'Conference Room A',
          timeFrom: '2024-01-15T09:00:00.000Z',
          timeTo: '2024-01-15T10:00:00.000Z',
          attendeeCount: 2,
          owner: 'Test User'
        }
      };

      vi.mocked(mockApiClient.cancelBooking!).mockResolvedValue(expectedResponse);

      const result = await bookingService.cancelBooking(request);

      expect(result).toEqual(expectedResponse);
      expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should cancel booking with string booking ID', async () => {
      const request: ICancelBookingRequest = {
        bookingId: '123456'
      };

      const expectedResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 123456,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T12:00:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE'
      };

      vi.mocked(mockApiClient.cancelBooking!).mockResolvedValue(expectedResponse);

      const result = await bookingService.cancelBooking(request);

      expect(result).toEqual(expectedResponse);
      expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should cancel booking with minimal parameters (defaults)', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 789012
      };

      const expectedResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 789012,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T12:00:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE'
      };

      vi.mocked(mockApiClient.cancelBooking!).mockResolvedValue(expectedResponse);

      const result = await bookingService.cancelBooking(request);

      expect(result).toEqual(expectedResponse);
      expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should throw error for invalid booking ID (negative number)', async () => {
      const request: ICancelBookingRequest = {
        bookingId: -123
      };

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Invalid booking ID: Booking ID must be positive');
    });

    it('should throw error for invalid booking ID (zero)', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 0
      };

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Invalid booking ID: Booking ID must be positive');
    });

    it('should throw error for invalid booking ID (non-numeric string)', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 'invalid'
      };

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Invalid booking ID: Booking ID must be a valid number');
    });

    it('should throw error for invalid booking ID (empty string)', async () => {
      const request: ICancelBookingRequest = {
        bookingId: ''
      };

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Invalid booking ID: Booking ID is required');
    });

    it('should throw error for reason exceeding 500 characters', async () => {
      const longReason = 'a'.repeat(501);
      const request: ICancelBookingRequest = {
        bookingId: 123456,
        reason: longReason
      };

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Cancellation reason cannot exceed 500 characters');
    });

    it('should accept reason exactly at 500 character limit', async () => {
      const maxReason = 'a'.repeat(500);
      const request: ICancelBookingRequest = {
        bookingId: 123456,
        reason: maxReason
      };

      const expectedResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 123456,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T12:00:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE',
        reason: maxReason
      };

      vi.mocked(mockApiClient.cancelBooking!).mockResolvedValue(expectedResponse);

      const result = await bookingService.cancelBooking(request);

      expect(result).toEqual(expectedResponse);
      expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should handle API client errors gracefully', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 123456
      };

      const apiError = new Error('Booking not found');
      vi.mocked(mockApiClient.cancelBooking!).mockRejectedValue(apiError);

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Booking not found');

      expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
    });

    it('should handle authentication errors gracefully', async () => {
      const request: ICancelBookingRequest = {
        bookingId: 123456
      };

      const authError = new Error('Authentication failed');
      vi.mocked(mockAuthManager.getCredentials).mockRejectedValue(authError);

      await expect(bookingService.cancelBooking(request))
        .rejects.toThrow('Authentication failed');

      expect(mockAuthManager.getCredentials).toHaveBeenCalled();
    });

    it('should validate all notification scope options', async () => {
      const notifyScopes: Array<'ALL_ATTENDEES' | 'OWNER_ONLY' | 'NONE'> = ['ALL_ATTENDEES', 'OWNER_ONLY', 'NONE'];
      
      for (const notifyScope of notifyScopes) {
        const request: ICancelBookingRequest = {
          bookingId: 123456,
          notifyScope
        };

        const expectedResponse: ICancelBookingResponse = {
          success: true,
          bookingId: 123456,
          status: 'CANCELLED',
          cancellationTime: '2024-01-15T12:00:00.000Z',
          notificationsSent: notifyScope !== 'NONE',
          notifyScope
        };

        vi.mocked(mockApiClient.cancelBooking!).mockResolvedValue(expectedResponse);

        const result = await bookingService.cancelBooking(request);

        expect(result.notifyScope).toBe(notifyScope);
        expect(mockApiClient.cancelBooking!).toHaveBeenCalledWith(request, mockCredentials);
      }
    });
  });
});