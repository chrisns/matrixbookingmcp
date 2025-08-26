import { describe, it, expect } from 'vitest';
import type { 
  IAPIRequest, 
  IAPIResponse, 
  IMatrixAPIClient 
} from '../../../src/types/api.types.js';
import type { ICredentials } from '../../../src/types/authentication.types.js';
import type { IAvailabilityRequest, IAvailabilityResponse } from '../../../src/types/availability.types.js';
import type { IBookingRequest, IBookingResponse } from '../../../src/types/booking.types.js';
import type { ILocation } from '../../../src/types/location.types.js';

describe('API Types', () => {
  describe('IAPIRequest interface', () => {
    it('should define correct API request structure', () => {
      const getRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/availability',
        headers: {
          'Authorization': 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/json'
        }
      };

      const postRequest: IAPIRequest = {
        method: 'POST',
        url: 'https://api.example.com/bookings',
        headers: {
          'Authorization': 'Basic dGVzdDp0ZXN0',
          'Content-Type': 'application/json'
        },
        body: {
          timeFrom: '2024-01-01T09:00:00Z',
          timeTo: '2024-01-01T10:00:00Z',
          locationId: 123
        }
      };

      expect(getRequest).toHaveProperty('method');
      expect(getRequest).toHaveProperty('url');
      expect(getRequest).toHaveProperty('headers');
      expect(getRequest.body).toBeUndefined();

      expect(postRequest).toHaveProperty('method');
      expect(postRequest).toHaveProperty('url');
      expect(postRequest).toHaveProperty('headers');
      expect(postRequest).toHaveProperty('body');

      expect(typeof getRequest.method).toBe('string');
      expect(typeof getRequest.url).toBe('string');
      expect(typeof getRequest.headers).toBe('object');
      expect(typeof postRequest.body).toBe('object');
    });

    it('should handle all HTTP methods', () => {
      const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

      methods.forEach(method => {
        const request: IAPIRequest = {
          method,
          url: 'https://api.example.com/test',
          headers: {}
        };

        expect(request.method).toBe(method);
      });
    });

    it('should handle optional body property', () => {
      const requestWithoutBody: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Accept': 'application/json' }
      };

      const requestWithStringBody: IAPIRequest = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text data'
      };

      const requestWithObjectBody: IAPIRequest = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
        body: { key: 'value', number: 123, array: [1, 2, 3] }
      };

      expect(requestWithoutBody.body).toBeUndefined();
      expect(typeof requestWithStringBody.body).toBe('string');
      expect(typeof requestWithObjectBody.body).toBe('object');
    });

    it('should handle various header configurations', () => {
      const emptyHeaders: IAPIRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {}
      };

      const multipleHeaders: IAPIRequest = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'MatrixBookingMCP/1.0',
          'X-Request-ID': 'req-123'
        }
      };

      expect(Object.keys(emptyHeaders.headers)).toHaveLength(0);
      expect(Object.keys(multipleHeaders.headers)).toHaveLength(5);
      expect(multipleHeaders.headers['Authorization']).toBe('Bearer token123');
    });
  });

  describe('IAPIResponse interface', () => {
    it('should define correct API response structure', () => {
      const response: IAPIResponse<{ message: string }> = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': '123ms'
        },
        data: {
          message: 'Success'
        }
      };

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('statusText');
      expect(response).toHaveProperty('headers');
      expect(response).toHaveProperty('data');
      expect(typeof response.status).toBe('number');
      expect(typeof response.statusText).toBe('string');
      expect(typeof response.headers).toBe('object');
      expect(typeof response.data).toBe('object');
    });

    it('should handle various HTTP status codes', () => {
      const successCodes = [200, 201, 202, 204];
      const errorCodes = [400, 401, 403, 404, 500, 502, 503];

      successCodes.forEach(status => {
        const response: IAPIResponse = {
          status,
          statusText: 'Success',
          headers: {},
          data: { success: true }
        };

        expect(response.status).toBe(status);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });

      errorCodes.forEach(status => {
        const response: IAPIResponse = {
          status,
          statusText: 'Error',
          headers: {},
          data: { error: 'Something went wrong' }
        };

        expect(response.status).toBe(status);
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });

    it('should handle typed response data', () => {
      interface AvailabilityData {
        available: boolean;
        slots: Array<{
          from: string;
          to: string;
          available: boolean;
        }>;
      }

      const typedResponse: IAPIResponse<AvailabilityData> = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: {
          available: true,
          slots: [
            {
              from: '2024-01-01T09:00:00Z',
              to: '2024-01-01T10:00:00Z',
              available: true
            }
          ]
        }
      };

      expect(typedResponse.data.available).toBe(true);
      expect(typedResponse.data.slots).toHaveLength(1);
      expect(typedResponse.data.slots[0].from).toBe('2024-01-01T09:00:00Z');
    });

    it('should handle various data types', () => {
      const stringResponse: IAPIResponse<string> = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
        data: 'Plain text response'
      };

      const numberResponse: IAPIResponse<number> = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: 42
      };

      const arrayResponse: IAPIResponse<string[]> = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: ['item1', 'item2', 'item3']
      };

      expect(typeof stringResponse.data).toBe('string');
      expect(typeof numberResponse.data).toBe('number');
      expect(Array.isArray(arrayResponse.data)).toBe(true);
    });
  });

  describe('IMatrixAPIClient interface', () => {
    it('should define all required Matrix API client methods', async () => {
      class MockMatrixAPIClient implements IMatrixAPIClient {
        async checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse> {
          return {
            available: true,
            slots: [
              {
                from: request.dateFrom,
                to: request.dateTo,
                available: true,
                locationId: request.locationId || 1
              }
            ],
            location: {
              id: request.locationId || 1,
              name: 'Test Location'
            }
          };
        }

        async createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse> {
          return {
            id: 123,
            status: 'CONFIRMED',
            timeFrom: request.timeFrom,
            timeTo: request.timeTo,
            location: {
              id: request.locationId,
              name: 'Booked Location'
            },
            owner: request.owner,
            attendees: request.attendees
          };
        }

        async getLocation(locationId: number, credentials: ICredentials): Promise<ILocation> {
          return {
            id: locationId,
            name: `Location ${locationId}`,
            capacity: 10,
            features: ['projector', 'whiteboard']
          };
        }

        async makeRequest<T>(request: IAPIRequest): Promise<IAPIResponse<T>> {
          return {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            data: { mock: 'response' } as T
          };
        }
      }

      const client = new MockMatrixAPIClient();

      expect(typeof client.checkAvailability).toBe('function');
      expect(typeof client.createBooking).toBe('function');
      expect(typeof client.getLocation).toBe('function');
      expect(typeof client.makeRequest).toBe('function');

      // Test method functionality
      const credentials: ICredentials = {
        username: 'test',
        password: 'pass',
        encodedCredentials: 'dGVzdDpwYXNz'
      };

      const availabilityRequest: IAvailabilityRequest = {
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z',
        locationId: 123
      };

      const availabilityResponse = await client.checkAvailability(availabilityRequest, credentials);
      expect(availabilityResponse.available).toBe(true);
      expect(availabilityResponse.location.id).toBe(123);

      const location = await client.getLocation(456, credentials);
      expect(location.id).toBe(456);
      expect(location.name).toBe('Location 456');
    });

    it('should handle complex booking operations', async () => {
      class TestMatrixAPIClient implements IMatrixAPIClient {
        async checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse> {
          // Simulate availability check logic
          const isWeekend = new Date(request.dateFrom).getDay() % 6 === 0;
          
          return {
            available: !isWeekend,
            slots: isWeekend ? [] : [
              {
                from: request.dateFrom,
                to: request.dateTo,
                available: true,
                locationId: request.locationId || 1
              }
            ],
            location: {
              id: request.locationId || 1,
              name: 'Conference Room A'
            }
          };
        }

        async createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse> {
          // Simulate booking creation
          const bookingId = Math.floor(Math.random() * 10000);
          
          return {
            id: bookingId,
            status: 'CONFIRMED',
            timeFrom: request.timeFrom,
            timeTo: request.timeTo,
            location: {
              id: request.locationId,
              name: 'Confirmed Room',
              capacity: 12
            },
            owner: request.owner,
            attendees: request.attendees
          };
        }

        async getLocation(locationId: number, credentials: ICredentials): Promise<ILocation> {
          const locations: Record<number, ILocation> = {
            1: { id: 1, name: 'Small Meeting Room', capacity: 4, features: ['TV'] },
            2: { id: 2, name: 'Large Conference Room', capacity: 20, features: ['projector', 'video conference', 'whiteboard'] },
            3: { id: 3, name: 'Executive Suite', capacity: 8, features: ['leather chairs', 'executive table'] }
          };

          return locations[locationId] || {
            id: locationId,
            name: `Unknown Location ${locationId}`
          };
        }

        async makeRequest<T>(request: IAPIRequest): Promise<IAPIResponse<T>> {
          // Simulate HTTP request processing
          const delay = Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));

          if (request.url.includes('error')) {
            return {
              status: 500,
              statusText: 'Internal Server Error',
              headers: { 'Content-Type': 'application/json' },
              data: { error: 'Simulated error' } as T
            };
          }

          return {
            status: request.method === 'POST' ? 201 : 200,
            statusText: request.method === 'POST' ? 'Created' : 'OK',
            headers: {
              'Content-Type': 'application/json',
              'X-Request-ID': 'req-' + Math.random().toString(36).substr(2, 9)
            },
            data: { success: true, method: request.method } as T
          };
        }
      }

      const client = new TestMatrixAPIClient();
      const credentials: ICredentials = {
        username: 'user',
        password: 'pass',
        encodedCredentials: 'dXNlcjpwYXNz'
      };

      // Test complex booking scenario
      const bookingRequest: IBookingRequest = {
        timeFrom: '2024-01-01T09:00:00Z',
        timeTo: '2024-01-01T10:00:00Z',
        locationId: 2,
        attendees: [
          { email: 'attendee1@example.com', name: 'Attendee 1' },
          { email: 'attendee2@example.com', name: 'Attendee 2' }
        ],
        extraRequests: ['projector setup', 'coffee service'],
        owner: { id: 123, email: 'owner@example.com', name: 'Meeting Owner' },
        ownerIsAttendee: true,
        source: 'mcp-server'
      };

      const bookingResponse = await client.createBooking(bookingRequest, credentials);
      expect(bookingResponse.status).toBe('CONFIRMED');
      expect(bookingResponse.attendees).toHaveLength(2);
      expect(bookingResponse.owner.email).toBe('owner@example.com');

      // Test location details
      const locationDetails = await client.getLocation(2, credentials);
      expect(locationDetails.name).toBe('Large Conference Room');
      expect(locationDetails.capacity).toBe(20);
      expect(locationDetails.features?.includes('projector')).toBe(true);

      // Test generic request method
      const genericRequest: IAPIRequest = {
        method: 'GET',
        url: 'https://api.matrix.com/test',
        headers: { 'Accept': 'application/json' }
      };

      const genericResponse = await client.makeRequest(genericRequest);
      expect(genericResponse.status).toBe(200);
      expect(genericResponse.statusText).toBe('OK');
    });

    it('should handle authentication and error scenarios', async () => {
      class ErrorTestAPIClient implements IMatrixAPIClient {
        async checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse> {
          if (credentials.username === 'invalid') {
            throw new Error('Authentication failed');
          }
          
          return {
            available: false,
            slots: [],
            location: { id: 1, name: 'Unavailable Room' }
          };
        }

        async createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse> {
          if (!request.locationId) {
            throw new Error('Location ID is required');
          }
          
          throw new Error('Room is already booked for this time slot');
        }

        async getLocation(locationId: number, credentials: ICredentials): Promise<ILocation> {
          if (locationId === 999) {
            throw new Error('Location not found');
          }
          
          return {
            id: locationId,
            name: `Test Location ${locationId}`
          };
        }

        async makeRequest<T>(request: IAPIRequest): Promise<IAPIResponse<T>> {
          if (request.headers['Authorization']?.includes('invalid')) {
            return {
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              data: { error: 'Invalid credentials' } as T
            };
          }
          
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { success: true } as T
          };
        }
      }

      const client = new ErrorTestAPIClient();
      
      const validCredentials: ICredentials = {
        username: 'valid',
        password: 'pass',
        encodedCredentials: 'dmFsaWQ6cGFzcw=='
      };

      const invalidCredentials: ICredentials = {
        username: 'invalid',
        password: 'pass',
        encodedCredentials: 'aW52YWxpZDpwYXNz'
      };

      // Test authentication error
      await expect(client.checkAvailability({
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T17:00:00Z'
      }, invalidCredentials)).rejects.toThrow('Authentication failed');

      // Test location not found error
      await expect(client.getLocation(999, validCredentials)).rejects.toThrow('Location not found');

      // Test successful request with valid credentials
      const location = await client.getLocation(123, validCredentials);
      expect(location.id).toBe(123);
    });
  });
});