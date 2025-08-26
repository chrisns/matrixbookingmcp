import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../../src/services/booking-service.js';
import { IBookingRequest, IBookingResponse, IOwner, IAttendee } from '../../../src/types/booking.types.js';
import { IMatrixAPIClient } from '../../../src/types/api.types.js';
import { IAuthenticationManager, ICredentials } from '../../../src/types/authentication.types.js';
import { IConfigurationManager, IServerConfig } from '../../../src/config/config-manager.js';
import { ILocation } from '../../../src/types/location.types.js';

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockApiClient: IMatrixAPIClient;
  let mockAuthManager: IAuthenticationManager;
  let mockConfigManager: IConfigurationManager;

  const mockConfig: IServerConfig = {
    matrixUsername: 'test@example.com',
    matrixPassword: 'password',
    matrixPreferredLocation: '123',
    apiTimeout: 5000,
    apiBaseUrl: 'https://app.matrixbooking.com/api/v1'
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

  beforeEach(() => {
    mockApiClient = {
      checkAvailability: vi.fn(),
      createBooking: vi.fn(),
      getLocation: vi.fn(),
      makeRequest: vi.fn()
    };

    mockAuthManager = {
      getCredentials: vi.fn(),
      createAuthHeader: vi.fn(),
      encodeCredentials: vi.fn()
    };

    mockConfigManager = {
      getConfig: vi.fn(),
      validateConfig: vi.fn()
    };

    vi.mocked(mockConfigManager.getConfig).mockReturnValue(mockConfig);
    vi.mocked(mockAuthManager.getCredentials).mockResolvedValue(mockCredentials);

    bookingService = new BookingService(mockApiClient, mockAuthManager, mockConfigManager);
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
        location: mockLocation,
        owner: mockOwner,
        attendees: [mockAttendee]
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
    it('should apply default values for empty request', () => {
      const partialRequest: Partial<IBookingRequest> = {};
      const result = bookingService.formatBookingRequest(partialRequest);

      expect(result.locationId).toBe(123);
      expect(result.attendees).toEqual([]);
      expect(result.extraRequests).toEqual([]);
      expect(result.ownerIsAttendee).toBe(true);
      expect(result.source).toBe('matrix-booking-mcp');
      expect(result.owner.email).toBe('test@example.com');
      expect(result.owner.name).toBe('test@example.com');

      // Validate date formats - Matrix API expects local timezone (no Z suffix)
      expect(result.timeFrom).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00\.000$/);
      expect(result.timeTo).toMatch(/^\d{4}-\d{2}-\d{2}T10:00:00\.000$/);
    });

    it('should preserve provided values and only apply defaults for missing fields', () => {
      const partialRequest: Partial<IBookingRequest> = {
        timeFrom: '2024-01-15T14:00:00.000Z',
        timeTo: '2024-01-15T15:00:00.000Z',
        locationId: 456,
        attendees: [mockAttendee],
        owner: mockOwner,
        ownerIsAttendee: false,
        source: 'custom-source'
      };

      const result = bookingService.formatBookingRequest(partialRequest);

      expect(result.timeFrom).toBe('2024-01-15T14:00:00.000Z');
      expect(result.timeTo).toBe('2024-01-15T15:00:00.000Z');
      expect(result.locationId).toBe(456);
      expect(result.attendees).toEqual([mockAttendee]);
      expect(result.owner).toEqual(mockOwner);
      expect(result.ownerIsAttendee).toBe(false);
      expect(result.source).toBe('custom-source');
      expect(result.extraRequests).toEqual([]); // Default applied
    });

    it('should handle partial owner information', () => {
      const partialRequest: Partial<IBookingRequest> = {};

      const result = bookingService.formatBookingRequest(partialRequest);

      expect(result.owner.id).toBe(0);
      expect(result.owner.email).toBe('test@example.com');
      expect(result.owner.name).toBe('test@example.com');
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
        location: mockLocation,
        owner: mockOwner,
        attendees: []
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
        location: mockLocation,
        owner: mockOwner,
        attendees: []
      };

      vi.mocked(mockApiClient.createBooking).mockResolvedValue(mockResponse);

      await bookingService.createBooking(request);

      expect(mockApiClient.createBooking).toHaveBeenCalledWith(request, mockCredentials);
    });
  });
});