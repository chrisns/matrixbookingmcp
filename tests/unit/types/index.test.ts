import { describe, it, expect } from 'vitest';
import * as Types from '../../../src/types/index.js';

describe('Types Index', () => {
  describe('Module exports', () => {
    it('should export all authentication types', () => {
      // Type interfaces exist at compile time only, not runtime
      // This test verifies they can be used in TypeScript
      const _typeCheck = (credentials: Types.ICredentials) => credentials;
      expect(typeof _typeCheck).toBe('function');
      
      // Test that we can create objects conforming to the interfaces
      const credentials: Types.ICredentials = {
        username: 'test',
        password: 'pass',
        encodedCredentials: 'dGVzdDpwYXNz'
      };
      
      expect(credentials).toBeDefined();
      expect(credentials.username).toBe('test');
    });

    it('should export all availability types', () => {
      // Type-level checks - if these compile, the exports are working
      const _availabilityRequest: Types.IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z'
      };

      const _timeSlot: Types.ITimeSlot = {
        from: '2024-01-01T09:00:00Z',
        to: '2024-01-01T10:00:00Z',
        available: true,
        locationId: 1
      };

      expect(_availabilityRequest).toBeDefined();
      expect(_timeSlot).toBeDefined();
    });

    it('should export all booking types', () => {
      const _attendee: Types.IAttendee = {
        email: 'test@example.com',
        name: 'Test User'
      };

      const _owner: Types.IOwner = {
        id: 1,
        email: 'owner@example.com',
        name: 'Owner'
      };

      const _bookingRequest: Types.IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: 1,
        attendees: [_attendee],
        extraRequests: [],
        owner: _owner,
        ownerIsAttendee: false,
        source: 'test'
      };

      expect(_attendee).toBeDefined();
      expect(_owner).toBeDefined();
      expect(_bookingRequest).toBeDefined();
    });

    it('should export all location types', () => {
      const _location: Types.ILocation = {
        id: 1,
        name: 'Test Room',
        capacity: 10,
        features: ['projector']
      };

      expect(_location).toBeDefined();
      expect(_location.id).toBe(1);
    });

    it('should export all error types', () => {
      const _apiError: Types.IAPIError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const _errorResponse: Types.IErrorResponse = {
        error: _apiError,
        httpStatus: 400
      };

      const _errorType: Types.ErrorType = 'NETWORK_ERROR';

      expect(_apiError).toBeDefined();
      expect(_errorResponse).toBeDefined();
      expect(_errorType).toBe('NETWORK_ERROR');
    });

    it('should export all MCP types', () => {
      const _mcpRequest: Types.IMCPRequest = {
        method: 'matrix_booking/check_availability',
        params: { test: true },
        id: 'test-1'
      };

      const _mcpResponse: Types.IMCPResponse = {
        result: { success: true },
        id: 'test-1'
      };

      const _mcpMethod: Types.MCPMethod = 'matrix_booking_create_booking';

      expect(_mcpRequest).toBeDefined();
      expect(_mcpResponse).toBeDefined();
      expect(_mcpMethod).toBe('matrix_booking_create_booking');
    });

    it('should export all API types', () => {
      const _apiRequest: Types.IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {}
      };

      const _apiResponse: Types.IAPIResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true }
      };

      expect(_apiRequest).toBeDefined();
      expect(_apiResponse).toBeDefined();
    });

    it('should export all validation types', () => {
      const _dateString: Types.DateString = '2024-01-01T12:00:00Z';
      const _timezone: Types.TimeZoneString = 'America/New_York';
      
      const _validationResult: Types.IValidationResult = {
        isValid: true,
        errors: []
      };

      const _dateValidationOptions: Types.IDateValidationOptions = {
        minDate: new Date(),
        timezone: 'UTC'
      };

      const _sanitizationOptions: Types.ISanitizationOptions = {
        stripHtml: true,
        trimWhitespace: true
      };

      expect(typeof _dateString).toBe('string');
      expect(typeof _timezone).toBe('string');
      expect(_validationResult).toBeDefined();
      expect(_dateValidationOptions).toBeDefined();
      expect(_sanitizationOptions).toBeDefined();
    });
  });

  describe('Type compatibility', () => {
    it('should ensure availability types work together', () => {
      const location: Types.ILocation = {
        id: 123,
        name: 'Test Room'
      };

      const timeSlot: Types.ITimeSlot = {
        from: '2024-01-01T09:00:00Z',
        to: '2024-01-01T10:00:00Z',
        available: true,
        locationId: location.id
      };

      const availabilityResponse: Types.IAvailabilityResponse = {
        available: true,
        slots: [timeSlot],
        location: location
      };

      expect(availabilityResponse.location.id).toBe(timeSlot.locationId);
      expect(availabilityResponse.slots).toContain(timeSlot);
    });

    it('should ensure booking types work together', () => {
      const owner: Types.IOwner = {
        id: 1,
        email: 'owner@example.com',
        name: 'Meeting Owner'
      };

      const attendee: Types.IAttendee = {
        id: 2,
        email: 'attendee@example.com',
        name: 'Attendee'
      };

      const location: Types.ILocation = {
        id: 123,
        name: 'Conference Room'
      };

      const bookingRequest: Types.IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: location.id,
        attendees: [attendee],
        extraRequests: [],
        owner: owner,
        ownerIsAttendee: false,
        source: 'test'
      };

      const bookingResponse: Types.IBookingResponse = {
        id: 456,
        status: 'CONFIRMED',
        timeFrom: bookingRequest.timeFrom,
        timeTo: bookingRequest.timeTo,
        organisation: { id: 1, name: 'Test Organization' },
        locationId: location.id,
        locationKind: 'Conference Room',
        owner: owner,
        bookedBy: owner,
        attendeeCount: 1,
        ownerIsAttendee: false,
        source: 'test',
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

      expect(bookingResponse.owner.id).toBe(bookingRequest.owner.id);
      expect(bookingResponse.locationId).toBe(bookingRequest.locationId);
      expect(bookingResponse.attendeeCount).toBeGreaterThan(0);
    });

    it('should ensure error types work together', () => {
      const apiError: Types.IAPIError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        timestamp: new Date().toISOString()
      };

      const errorResponse: Types.IErrorResponse = {
        error: apiError,
        httpStatus: 400,
        requestId: 'req-123'
      };

      const errorType: Types.ErrorType = 'VALIDATION_ERROR';

      expect(errorResponse.error.code).toBe(errorType);
      expect(errorResponse.httpStatus).toBeGreaterThanOrEqual(400);
    });

    it('should ensure MCP types work with Matrix Booking operations', () => {
      const availabilityParams: Types.IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z',
        locationId: 123
      };

      const mcpRequest: Types.IMCPRequest = {
        method: 'matrix_booking/check_availability',
        params: availabilityParams as unknown as Record<string, unknown>,
        id: 'req-1'
      };

      const availabilityResult: Types.IAvailabilityResponse = {
        available: true,
        slots: [
          {
            from: availabilityParams.dateFrom,
            to: availabilityParams.dateTo,
            available: true,
            locationId: availabilityParams.locationId!
          }
        ],
        location: {
          id: availabilityParams.locationId!,
          name: 'Test Room'
        }
      };

      const mcpResponse: Types.IMCPResponse<Types.IAvailabilityResponse> = {
        result: availabilityResult,
        id: mcpRequest.id!
      };

      expect(mcpResponse.result?.available).toBe(true);
      expect(mcpResponse.id).toBe(mcpRequest.id);
    });

    it('should ensure API types work with authentication', () => {
      const credentials: Types.ICredentials = {
        username: 'test',
        password: 'pass',
        encodedCredentials: 'dGVzdDpwYXNz'
      };

      const apiRequest: Types.IAPIRequest = {
        method: 'POST',
        url: 'https://api.matrix.com/availability',
        headers: {
          'Authorization': `Basic ${credentials.encodedCredentials}`,
          'Content-Type': 'application/json'
        },
        body: {
          dateFrom: '2024-01-01T09:00:00Z',
          dateTo: '2024-01-01T17:00:00Z'
        }
      };

      const apiResponse: Types.IAPIResponse<Types.IAvailabilityResponse> = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          available: true,
          slots: [],
          location: { id: 1, name: 'Room' }
        }
      };

      expect(apiRequest.headers['Authorization']).toContain(credentials.encodedCredentials);
      expect(apiResponse.data.available).toBe(true);
    });
  });

  describe('Type safety validation', () => {
    it('should enforce strict typing for all interfaces', () => {
      // These tests ensure TypeScript strict mode is working correctly
      
      // Test that optional properties are truly optional
      const minimalLocation: Types.ILocation = {
        id: 1,
        name: 'Test'
        // capacity and features are optional
      };
      
      const fullLocation: Types.ILocation = {
        id: 1,
        name: 'Test',
        capacity: 10,
        features: ['projector']
      };

      expect(minimalLocation).toBeDefined();
      expect(fullLocation).toBeDefined();

      // Test that required properties cannot be undefined
      const validationResult: Types.IValidationResult = {
        isValid: true,
        errors: []
        // sanitizedValue is optional
      };

      expect(validationResult.isValid).toBe(true);
      expect(Array.isArray(validationResult.errors)).toBe(true);
    });

    it('should maintain type relationships between related interfaces', () => {
      const owner: Types.IOwner = {
        id: 100,
        email: 'owner@test.com',
        name: 'Owner Name'
      };

      // IAttendee has optional id, IOwner has required id
      const attendeeWithId: Types.IAttendee = {
        id: 200,
        email: 'attendee@test.com',
        name: 'Attendee Name'
      };

      const attendeeWithoutId: Types.IAttendee = {
        email: 'attendee2@test.com',
        name: 'Attendee Name 2'
      };

      expect(owner.id).toBeDefined();
      expect(typeof owner.id).toBe('number');
      expect(attendeeWithId.id).toBeDefined();
      expect(attendeeWithoutId.id).toBeUndefined();
    });

    it('should ensure enum-like types are properly constrained', () => {
      const validErrorTypes: Types.ErrorType[] = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'AUTHENTICATION_ERROR',
        'VALIDATION_ERROR',
        'API_ERROR',
        'SYSTEM_ERROR'
      ];

      const validMCPMethods: Types.MCPMethod[] = [
        'matrix_booking_check_availability',
        'matrix_booking_create_booking',
        'matrix_booking_get_location'
      ];

      const validHttpMethods = ['GET', 'POST', 'PUT', 'DELETE'] as const;

      // These should all be valid
      validErrorTypes.forEach(errorType => {
        const error: Types.ErrorType = errorType;
        expect(typeof error).toBe('string');
      });

      validMCPMethods.forEach(method => {
        const mcpMethod: Types.MCPMethod = method;
        expect(typeof mcpMethod).toBe('string');
      });

      validHttpMethods.forEach(method => {
        const apiRequest: Types.IAPIRequest = {
          method,
          url: 'https://test.com',
          headers: {}
        };
        expect(apiRequest.method).toBe(method);
      });
    });
  });
});