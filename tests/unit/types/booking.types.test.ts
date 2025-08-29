import { describe, it, expect } from 'vitest';
import type { 
  IBookingRequest, 
  IBookingResponse, 
  IAttendee, 
  IOwner, 
  IBookingService,
  ICancelBookingRequest,
  ICancelBookingResponse
} from '../../../src/types/booking.types.js';
import type { ILocation } from '../../../src/types/location.types.js';

describe('Booking Types', () => {
  describe('IAttendee interface', () => {
    it('should define correct attendee structure', () => {
      const attendee: IAttendee = {
        id: 123,
        email: 'attendee@example.com',
        name: 'John Doe'
      };

      expect(attendee).toHaveProperty('email');
      expect(attendee).toHaveProperty('name');
      expect(attendee).toHaveProperty('id');
      expect(typeof attendee.email).toBe('string');
      expect(typeof attendee.name).toBe('string');
      expect(typeof attendee.id).toBe('number');
    });

    it('should handle optional id property', () => {
      const attendeeWithoutId: IAttendee = {
        email: 'attendee@example.com',
        name: 'Jane Doe'
      };

      expect(attendeeWithoutId.id).toBeUndefined();
      expect(attendeeWithoutId.email).toBe('attendee@example.com');
      expect(attendeeWithoutId.name).toBe('Jane Doe');
    });

    it('should enforce required email and name properties', () => {
      // TypeScript compilation test - these should cause type errors if uncommented
      // const invalid1: IAttendee = { name: 'John' }; // missing email
      // const invalid2: IAttendee = { email: 'test@test.com' }; // missing name

      const valid: IAttendee = {
        email: 'valid@example.com',
        name: 'Valid User'
      };

      expect(valid).toBeDefined();
    });
  });

  describe('IOwner interface', () => {
    it('should define correct owner structure', () => {
      const owner: IOwner = {
        id: 456,
        email: 'owner@example.com',
        name: 'Meeting Owner'
      };

      expect(owner).toHaveProperty('id');
      expect(owner).toHaveProperty('email');
      expect(owner).toHaveProperty('name');
      expect(typeof owner.id).toBe('number');
      expect(typeof owner.email).toBe('string');
      expect(typeof owner.name).toBe('string');
    });

    it('should require all properties including id', () => {
      const owner: IOwner = {
        id: 789,
        email: 'required@example.com',
        name: 'Required Name'
      };

      expect(owner.id).toBeDefined();
      expect(typeof owner.id).toBe('number');
    });
  });

  describe('IBookingRequest interface', () => {
    it('should define correct booking request structure', () => {
      const owner: IOwner = {
        id: 123,
        email: 'owner@example.com',
        name: 'Owner Name'
      };

      const attendees: IAttendee[] = [
        {
          id: 456,
          email: 'attendee1@example.com',
          name: 'Attendee 1'
        },
        {
          email: 'attendee2@example.com',
          name: 'Attendee 2'
        }
      ];

      const request: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: 123,
        attendees: attendees,
        extraRequests: ['projector', 'catering'],
        owner: owner,
        ownerIsAttendee: true,
        source: 'mcp-server'
      };

      expect(request).toHaveProperty('timeFrom');
      expect(request).toHaveProperty('timeTo');
      expect(request).toHaveProperty('locationId');
      expect(request).toHaveProperty('attendees');
      expect(request).toHaveProperty('extraRequests');
      expect(request).toHaveProperty('owner');
      expect(request).toHaveProperty('ownerIsAttendee');
      expect(request).toHaveProperty('source');

      expect(typeof request.timeFrom).toBe('string');
      expect(typeof request.timeTo).toBe('string');
      expect(typeof request.locationId).toBe('number');
      expect(Array.isArray(request.attendees)).toBe(true);
      expect(Array.isArray(request.extraRequests)).toBe(true);
      expect(typeof request.owner).toBe('object');
      expect(typeof request.ownerIsAttendee).toBe('boolean');
      expect(typeof request.source).toBe('string');
    });

    it('should handle empty arrays', () => {
      const owner: IOwner = {
        id: 123,
        email: 'owner@example.com',
        name: 'Owner'
      };

      const request: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: owner,
        ownerIsAttendee: false,
        source: 'test'
      };

      expect(request.attendees).toHaveLength(0);
      expect(request.extraRequests).toHaveLength(0);
    });

    it('should handle ISO 8601 date formats', () => {
      const owner: IOwner = {
        id: 123,
        email: 'owner@example.com',
        name: 'Owner'
      };

      const request: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00.000Z',
        timeTo: '2024-01-01T10:00:00+00:00',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: owner,
        ownerIsAttendee: true,
        source: 'api'
      };

      expect(request.timeFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(request.timeTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('IBookingResponse interface', () => {
    it('should define correct booking response structure', () => {
      const location: ILocation = {
        id: 123,
        name: 'Conference Room A',
        capacity: 10
      };

      const owner: IOwner = {
        id: 123,
        email: 'owner@example.com',
        name: 'Owner'
      };

      const attendees: IAttendee[] = [
        {
          id: 456,
          email: 'attendee@example.com',
          name: 'Attendee'
        }
      ];

      const response: IBookingResponse = {
        id: 789,
        status: 'CONFIRMED',
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        organisation: { id: 1, name: 'Test Organization' },
        locationId: location.id,
        locationKind: 'Conference Room',
        owner: owner,
        bookedBy: owner,
        attendeeCount: attendees.length,
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

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timeFrom');
      expect(response).toHaveProperty('timeTo');
      expect(response).toHaveProperty('locationId');
      expect(response).toHaveProperty('owner');
      expect(response).toHaveProperty('attendeeCount');

      expect(typeof response.id).toBe('number');
      expect(['CONFIRMED', 'PENDING', 'CANCELLED'].includes(response.status)).toBe(true);
    });

    it('should handle all booking status types', () => {
      const basicResponse = {
        id: 123,
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        organisation: { id: 1, name: 'Test Organization' },
        locationId: 1,
        locationKind: 'Conference Room',
        owner: { id: 1, email: 'owner@test.com', name: 'Owner' },
        bookedBy: { id: 1, email: 'owner@test.com', name: 'Owner' },
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

      const confirmedResponse: IBookingResponse = {
        ...basicResponse,
        status: 'CONFIRMED'
      };

      const pendingResponse: IBookingResponse = {
        ...basicResponse,
        status: 'PENDING'
      };

      const cancelledResponse: IBookingResponse = {
        ...basicResponse,
        status: 'CANCELLED'
      };

      expect(confirmedResponse.status).toBe('CONFIRMED');
      expect(pendingResponse.status).toBe('PENDING');
      expect(cancelledResponse.status).toBe('CANCELLED');
    });
  });

  describe('IBookingService interface', () => {
    it('should define all required booking methods', async () => {
      class MockBookingService implements IBookingService {
        async createBooking(request: IBookingRequest): Promise<IBookingResponse> {
          return {
            id: 123,
            status: 'CONFIRMED',
            timeFrom: request.timeFrom,
            timeTo: request.timeTo,
            organisation: { id: 1, name: 'Test Organization' },
            locationId: request.locationId,
            locationKind: 'Conference Room',
            owner: request.owner,
            bookedBy: request.owner,
            attendeeCount: request.attendees.length,
            ownerIsAttendee: request.ownerIsAttendee,
            source: request.source,
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
        }

        async formatBookingRequest(request: Partial<IBookingRequest>): Promise<IBookingRequest> {
          return {
            timeFrom: request.timeFrom || new Date().toISOString(),
            timeTo: request.timeTo || new Date(Date.now() + 3600000).toISOString(),
            locationId: request.locationId || 1,
            attendees: request.attendees || [],
            extraRequests: request.extraRequests || [],
            owner: request.owner || { id: 1, email: 'default@test.com', name: 'Default Owner' },
            ownerIsAttendee: request.ownerIsAttendee || false,
            source: request.source || 'mcp-server'
          };
        }

        validateBookingRequest(request: IBookingRequest): boolean {
          return !!(
            request.timeFrom &&
            request.timeTo &&
            request.locationId &&
            request.owner &&
            request.owner.id &&
            request.owner.email &&
            request.owner.name
          );
        }

        async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
          const response: ICancelBookingResponse = {
            success: true,
            bookingId: typeof request.bookingId === 'number' ? request.bookingId : parseInt(request.bookingId.toString()),
            status: 'CANCELLED',
            cancellationTime: new Date().toISOString(),
            notificationsSent: request.sendNotifications ?? true,
            notifyScope: request.notifyScope ?? 'ALL_ATTENDEES'
          };
          if (request.reason) {
            response.reason = request.reason;
          }
          return response;
        }
      }

      const service = new MockBookingService();
      
      expect(typeof service.createBooking).toBe('function');
      expect(typeof service.formatBookingRequest).toBe('function');
      expect(typeof service.validateBookingRequest).toBe('function');

      const owner: IOwner = {
        id: 123,
        email: 'owner@test.com',
        name: 'Test Owner'
      };

      const request: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: 123,
        attendees: [],
        extraRequests: [],
        owner: owner,
        ownerIsAttendee: false,
        source: 'test'
      };

      const response = await service.createBooking(request);
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('status');
      
      const isValid = service.validateBookingRequest(request);
      expect(isValid).toBe(true);
    });

    it('should handle booking request formatting with defaults', async () => {
      class TestBookingService implements IBookingService {
        async createBooking(_request: IBookingRequest): Promise<IBookingResponse> {
          throw new Error('Not implemented for test');
        }

        async formatBookingRequest(request: Partial<IBookingRequest>): Promise<IBookingRequest> {
          const now = new Date();
          const later = new Date(now.getTime() + 3600000);

          return {
            timeFrom: request.timeFrom || now.toISOString(),
            timeTo: request.timeTo || later.toISOString(),
            locationId: request.locationId || 1,
            attendees: request.attendees || [],
            extraRequests: request.extraRequests || [],
            owner: request.owner || {
              id: 1,
              email: 'default@example.com',
              name: 'Default Owner'
            },
            ownerIsAttendee: request.ownerIsAttendee ?? false,
            source: request.source || 'mcp-server'
          };
        }

        validateBookingRequest(_request: IBookingRequest): boolean {
          return true;
        }

        async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
          const response: ICancelBookingResponse = {
            success: true,
            bookingId: typeof request.bookingId === 'number' ? request.bookingId : parseInt(request.bookingId.toString()),
            status: 'CANCELLED',
            cancellationTime: new Date().toISOString(),
            notificationsSent: request.sendNotifications ?? true,
            notifyScope: request.notifyScope ?? 'ALL_ATTENDEES'
          };
          if (request.reason) {
            response.reason = request.reason;
          }
          return response;
        }
      }

      const service = new TestBookingService();
      const partialRequest: Partial<IBookingRequest> = {
        locationId: 456
      };

      const formatted = await service.formatBookingRequest(partialRequest);
      
      expect(formatted.locationId).toBe(456);
      expect(formatted.attendees).toEqual([]);
      expect(formatted.extraRequests).toEqual([]);
      expect(formatted.ownerIsAttendee).toBe(false);
      expect(formatted.source).toBe('mcp-server');
      expect(formatted.owner.id).toBe(1);
    });
  });

  describe('ICancelBookingRequest interface', () => {
    it('should define correct cancel booking request structure with required fields', () => {
      const request: ICancelBookingRequest = {
        bookingId: 12345
      };

      expect(request).toHaveProperty('bookingId');
      expect(typeof request.bookingId).toBe('number');
    });

    it('should handle string booking IDs', () => {
      const request: ICancelBookingRequest = {
        bookingId: "12345"
      };

      expect(request.bookingId).toBe("12345");
      expect(typeof request.bookingId).toBe('string');
    });

    it('should support all optional parameters', () => {
      const request: ICancelBookingRequest = {
        bookingId: 12345,
        notifyScope: 'ALL_ATTENDEES',
        sendNotifications: true,
        reason: 'Meeting cancelled due to schedule conflict'
      };

      expect(request.notifyScope).toBe('ALL_ATTENDEES');
      expect(request.sendNotifications).toBe(true);
      expect(request.reason).toBe('Meeting cancelled due to schedule conflict');
    });

    it('should support all notifyScope values', () => {
      const requests: ICancelBookingRequest[] = [
        { bookingId: 1, notifyScope: 'ALL_ATTENDEES' },
        { bookingId: 2, notifyScope: 'OWNER_ONLY' },
        { bookingId: 3, notifyScope: 'NONE' }
      ];

      requests.forEach(request => {
        expect(['ALL_ATTENDEES', 'OWNER_ONLY', 'NONE']).toContain(request.notifyScope);
      });
    });

    it('should handle boolean sendNotifications', () => {
      const requestTrue: ICancelBookingRequest = {
        bookingId: 1,
        sendNotifications: true
      };

      const requestFalse: ICancelBookingRequest = {
        bookingId: 2,
        sendNotifications: false
      };

      expect(requestTrue.sendNotifications).toBe(true);
      expect(requestFalse.sendNotifications).toBe(false);
    });

    it('should allow optional reason field', () => {
      const withReason: ICancelBookingRequest = {
        bookingId: 1,
        reason: 'Emergency cancellation'
      };

      const withoutReason: ICancelBookingRequest = {
        bookingId: 2
      };

      expect(withReason.reason).toBe('Emergency cancellation');
      expect(withoutReason.reason).toBeUndefined();
    });
  });

  describe('ICancelBookingResponse interface', () => {
    it('should define correct cancel booking response structure with required fields', () => {
      const response: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('bookingId');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('cancellationTime');
      expect(response).toHaveProperty('notificationsSent');
      expect(response).toHaveProperty('notifyScope');

      expect(typeof response.success).toBe('boolean');
      expect(typeof response.bookingId).toBe('number');
      expect(typeof response.status).toBe('string');
      expect(typeof response.cancellationTime).toBe('string');
      expect(typeof response.notificationsSent).toBe('boolean');
      expect(typeof response.notifyScope).toBe('string');
    });

    it('should handle success and failure responses', () => {
      const successResponse: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      const failureResponse: ICancelBookingResponse = {
        success: false,
        bookingId: 12345,
        status: 'FAILED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE'
      };

      expect(successResponse.success).toBe(true);
      expect(failureResponse.success).toBe(false);
    });

    it('should support optional reason field', () => {
      const withReason: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        reason: 'Schedule conflict'
      };

      const withoutReason: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      expect(withReason.reason).toBe('Schedule conflict');
      expect(withoutReason.reason).toBeUndefined();
    });

    it('should support optional originalBooking field', () => {
      const withOriginalBooking: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        originalBooking: {
          locationId: 100001,
          locationName: 'Conference Room A',
          timeFrom: '2024-01-15T14:00:00.000',
          timeTo: '2024-01-15T15:00:00.000',
          attendeeCount: 3,
          owner: 'john.doe@company.com'
        }
      };

      const withoutOriginalBooking: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      expect(withOriginalBooking.originalBooking).toBeDefined();
      expect(withOriginalBooking.originalBooking?.locationId).toBe(100001);
      expect(withOriginalBooking.originalBooking?.locationName).toBe('Conference Room A');
      expect(withoutOriginalBooking.originalBooking).toBeUndefined();
    });

    it('should handle originalBooking with optional fields', () => {
      const minimalOriginalBooking: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        originalBooking: {
          locationId: 100001,
          timeFrom: '2024-01-15T14:00:00.000',
          timeTo: '2024-01-15T15:00:00.000'
        }
      };

      expect(minimalOriginalBooking.originalBooking?.locationId).toBe(100001);
      expect(minimalOriginalBooking.originalBooking?.locationName).toBeUndefined();
      expect(minimalOriginalBooking.originalBooking?.attendeeCount).toBeUndefined();
      expect(minimalOriginalBooking.originalBooking?.owner).toBeUndefined();
    });

    it('should handle ISO 8601 timestamp format', () => {
      const response: ICancelBookingResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      const timestamp = new Date(response.cancellationTime);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('IBookingService interface extension', () => {
    it('should support optional cancelBooking method', () => {
      class TestServiceWithCancel implements IBookingService {
        async createBooking(_request: IBookingRequest): Promise<IBookingResponse> {
          throw new Error('Not implemented for test');
        }

        async formatBookingRequest(_request: Partial<IBookingRequest>): Promise<IBookingRequest> {
          throw new Error('Not implemented for test');
        }

        validateBookingRequest(_request: IBookingRequest): boolean {
          return true;
        }

        async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
          const response: ICancelBookingResponse = {
            success: true,
            bookingId: typeof request.bookingId === 'string' ? parseInt(request.bookingId) : request.bookingId,
            status: 'CANCELLED',
            cancellationTime: new Date().toISOString(),
            notificationsSent: request.sendNotifications ?? true,
            notifyScope: request.notifyScope ?? 'ALL_ATTENDEES'
          };
          
          if (request.reason) {
            response.reason = request.reason;
          }
          
          return response;
        }
      }

      const service = new TestServiceWithCancel();
      expect(service.cancelBooking).toBeDefined();
      expect(typeof service.cancelBooking).toBe('function');
    });

    it('should require cancelBooking method in all services', () => {
      class TestServiceWithoutCancel implements IBookingService {
        async createBooking(_request: IBookingRequest): Promise<IBookingResponse> {
          throw new Error('Not implemented for test');
        }

        async formatBookingRequest(_request: Partial<IBookingRequest>): Promise<IBookingRequest> {
          throw new Error('Not implemented for test');
        }

        validateBookingRequest(_request: IBookingRequest): boolean {
          return true;
        }

        async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
          const response: ICancelBookingResponse = {
            success: true,
            bookingId: typeof request.bookingId === 'number' ? request.bookingId : parseInt(request.bookingId.toString()),
            status: 'CANCELLED',
            cancellationTime: new Date().toISOString(),
            notificationsSent: request.sendNotifications ?? true,
            notifyScope: request.notifyScope ?? 'ALL_ATTENDEES'
          };
          if (request.reason) {
            response.reason = request.reason;
          }
          return response;
        }
      }

      const service = new TestServiceWithoutCancel();
      expect(typeof service.cancelBooking).toBe('function');
    });
  });
});