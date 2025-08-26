import { describe, it, expect } from 'vitest';
import type { 
  IAvailabilityRequest, 
  IAvailabilityResponse, 
  ITimeSlot, 
  IAvailabilityService 
} from '../../../src/types/availability.types.js';
import type { ILocation } from '../../../src/types/location.types.js';

describe('Availability Types', () => {
  describe('IAvailabilityRequest interface', () => {
    it('should define correct availability request structure', () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z',
        locationId: 123,
        duration: 60
      };

      expect(request).toHaveProperty('dateFrom');
      expect(request).toHaveProperty('dateTo');
      expect(request).toHaveProperty('locationId');
      expect(request).toHaveProperty('duration');
      expect(typeof request.dateFrom).toBe('string');
      expect(typeof request.dateTo).toBe('string');
      expect(typeof request.locationId).toBe('number');
      expect(typeof request.duration).toBe('number');
    });

    it('should handle optional properties', () => {
      const minimalRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z'
      };

      expect(minimalRequest.locationId).toBeUndefined();
      expect(minimalRequest.duration).toBeUndefined();
    });

    it('should enforce ISO 8601 date format expectation', () => {
      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00.000Z',
        dateTo: '2024-01-01T17:00:00+00:00'
      };

      expect(request.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(request.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('ITimeSlot interface', () => {
    it('should define correct time slot structure', () => {
      const timeSlot: ITimeSlot = {
        from: '2024-01-01T09:00:00Z',
        to: '2024-01-01T10:00:00Z',
        available: true,
        locationId: 123
      };

      expect(timeSlot).toHaveProperty('from');
      expect(timeSlot).toHaveProperty('to');
      expect(timeSlot).toHaveProperty('available');
      expect(timeSlot).toHaveProperty('locationId');
      expect(typeof timeSlot.from).toBe('string');
      expect(typeof timeSlot.to).toBe('string');
      expect(typeof timeSlot.available).toBe('boolean');
      expect(typeof timeSlot.locationId).toBe('number');
    });

    it('should handle both available and unavailable slots', () => {
      const availableSlot: ITimeSlot = {
        from: '2024-01-01T09:00:00Z',
        to: '2024-01-01T10:00:00Z',
        available: true,
        locationId: 123
      };

      const unavailableSlot: ITimeSlot = {
        from: '2024-01-01T10:00:00Z',
        to: '2024-01-01T11:00:00Z',
        available: false,
        locationId: 123
      };

      expect(availableSlot.available).toBe(true);
      expect(unavailableSlot.available).toBe(false);
    });
  });

  describe('IAvailabilityResponse interface', () => {
    it('should define correct availability response structure', () => {
      const location: ILocation = {
        id: 123,
        name: 'Conference Room A',
        capacity: 10,
        features: ['projector', 'whiteboard']
      };

      const timeSlots: ITimeSlot[] = [
        {
          from: '2024-01-01T09:00:00Z',
          to: '2024-01-01T10:00:00Z',
          available: true,
          locationId: 123
        }
      ];

      const response: IAvailabilityResponse = {
        available: true,
        slots: timeSlots,
        location: location
      };

      expect(response).toHaveProperty('available');
      expect(response).toHaveProperty('slots');
      expect(response).toHaveProperty('location');
      expect(typeof response.available).toBe('boolean');
      expect(Array.isArray(response.slots)).toBe(true);
      expect(typeof response.location).toBe('object');
    });

    it('should handle empty slots array', () => {
      const location: ILocation = {
        id: 123,
        name: 'Conference Room A'
      };

      const response: IAvailabilityResponse = {
        available: false,
        slots: [],
        location: location
      };

      expect(response.slots).toHaveLength(0);
      expect(response.available).toBe(false);
    });

    it('should handle multiple time slots', () => {
      const location: ILocation = {
        id: 123,
        name: 'Conference Room A'
      };

      const timeSlots: ITimeSlot[] = [
        {
          from: '2024-01-01T09:00:00Z',
          to: '2024-01-01T10:00:00Z',
          available: true,
          locationId: 123
        },
        {
          from: '2024-01-01T10:00:00Z',
          to: '2024-01-01T11:00:00Z',
          available: false,
          locationId: 123
        },
        {
          from: '2024-01-01T11:00:00Z',
          to: '2024-01-01T12:00:00Z',
          available: true,
          locationId: 123
        }
      ];

      const response: IAvailabilityResponse = {
        available: true,
        slots: timeSlots,
        location: location
      };

      expect(response.slots).toHaveLength(3);
      expect(response.slots.every(slot => typeof slot.available === 'boolean')).toBe(true);
    });
  });

  describe('IAvailabilityService interface', () => {
    it('should define all required availability methods', async () => {
      class MockAvailabilityService implements IAvailabilityService {
        async checkAvailability(request: IAvailabilityRequest): Promise<IAvailabilityResponse> {
          return {
            available: true,
            slots: [{
              from: request.dateFrom,
              to: request.dateTo,
              available: true,
              locationId: request.locationId || 1
            }],
            location: {
              id: request.locationId || 1,
              name: 'Test Location'
            }
          };
        }

        formatAvailabilityRequest(request: Partial<IAvailabilityRequest>): IAvailabilityRequest {
          return {
            dateFrom: request.dateFrom || new Date().toISOString(),
            dateTo: request.dateTo || new Date(Date.now() + 3600000).toISOString(),
            ...(request.locationId !== undefined && { locationId: request.locationId }),
            ...(request.duration !== undefined && { duration: request.duration })
          };
        }
      }

      const service = new MockAvailabilityService();
      
      expect(typeof service.checkAvailability).toBe('function');
      expect(typeof service.formatAvailabilityRequest).toBe('function');

      const request: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T10:00:00Z'
      };

      const response = await service.checkAvailability(request);
      expect(response).toHaveProperty('available');
      expect(response).toHaveProperty('slots');
      expect(response).toHaveProperty('location');
    });

    it('should handle partial availability request formatting', () => {
      class TestAvailabilityService implements IAvailabilityService {
        async checkAvailability(request: IAvailabilityRequest): Promise<IAvailabilityResponse> {
          throw new Error('Not implemented for test');
        }

        formatAvailabilityRequest(request: Partial<IAvailabilityRequest>): IAvailabilityRequest {
          const now = new Date();
          const later = new Date(now.getTime() + 3600000);

          return {
            dateFrom: request.dateFrom || now.toISOString(),
            dateTo: request.dateTo || later.toISOString(),
            locationId: request.locationId || 1,
            duration: request.duration || 60
          };
        }
      }

      const service = new TestAvailabilityService();
      const partialRequest: Partial<IAvailabilityRequest> = {
        locationId: 123
      };

      const formatted = service.formatAvailabilityRequest(partialRequest);
      
      expect(formatted).toHaveProperty('dateFrom');
      expect(formatted).toHaveProperty('dateTo');
      expect(formatted.locationId).toBe(123);
      expect(formatted.duration).toBe(60);
      expect(typeof formatted.dateFrom).toBe('string');
      expect(typeof formatted.dateTo).toBe('string');
    });
  });
});