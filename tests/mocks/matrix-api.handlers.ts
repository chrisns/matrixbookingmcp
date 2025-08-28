/**
 * MSW request handlers for Matrix Booking API
 * Provides realistic API mocking for testing
 */

import { http, HttpResponse, delay } from 'msw';
import {
  mockLocations,
  mockAvailabilityResponse,
  mockNoAvailabilityResponse,
  mockBookingFailureResponse,
  mockErrorResponses,
  createMockBookingResponse,
  createMockAvailabilityResponse
} from './test-data.js';

/**
 * Matrix Booking API base URL
 */
const MATRIX_API_BASE = 'https://app.matrixbooking.com/api/v1';

/**
 * Request handlers for Matrix Booking API endpoints
 */
export const matrixApiHandlers = [
  /**
   * GET /location/:id - Get location by ID (singular endpoint)
   */
  http.get(`${MATRIX_API_BASE}/location/:id`, async ({ params }) => {
    const { id } = params;
    const locationId = parseInt(id as string, 10);

    // Simulate network delay
    await delay(100);

    // Find location by ID
    const location = mockLocations.find(loc => loc.id === locationId);
    
    if (!location) {
      return HttpResponse.json(
        mockErrorResponses.notFound,
        { status: 404 }
      );
    }

    return HttpResponse.json(location);
  }),

  /**
   * GET /locations/:id - Get location by ID (plural endpoint fallback)
   */
  http.get(`${MATRIX_API_BASE}/locations/:id`, async ({ params }) => {
    const { id } = params;
    const locationId = parseInt(id as string, 10);

    await delay(100);
    const location = mockLocations.find(loc => loc.id === locationId);
    
    if (!location) {
      return HttpResponse.json(mockErrorResponses.notFound, { status: 404 });
    }

    return HttpResponse.json(location);
  }),

  /**
   * GET /locations - Get all locations (fallback)
   */
  http.get(`${MATRIX_API_BASE}/locations`, async () => {
    await delay(100);
    return HttpResponse.json(mockLocations);
  }),

  /**
   * GET /availability - Check availability
   */
  http.get(`${MATRIX_API_BASE}/availability`, async ({ request }) => {
    await delay(150);

    try {
      const url = new URL(request.url);
      const locationId = parseInt(url.searchParams.get('l') || '0', 10);
      const dateFrom = url.searchParams.get('f');
      const dateTo = url.searchParams.get('t');

      // Validate required parameters
      if (!dateFrom || !dateTo || !locationId) {
        return HttpResponse.json(
          mockErrorResponses.badRequest,
          { status: 400 }
        );
      }

      // Find location
      const location = mockLocations.find(loc => loc.id === locationId);
      if (!location) {
        return HttpResponse.json(
          mockErrorResponses.notFound,
          { status: 404 }
        );
      }

      // Create availability response with found location
      const response = createMockAvailabilityResponse({
        location,
        slots: mockAvailabilityResponse.slots.map(slot => ({
          ...slot,
          locationId
        }))
      });

      // Simulate some unavailable scenarios based on time patterns
      const fromDate = new Date(dateFrom);
      const isWeekend = fromDate.getDay() === 0 || fromDate.getDay() === 6;
      const isLateNight = fromDate.getHours() >= 18;

      if (isWeekend || isLateNight) {
        return HttpResponse.json({
          ...mockNoAvailabilityResponse,
          location
        });
      }

      return HttpResponse.json(response);
    } catch (error) {
      return HttpResponse.json(
        mockErrorResponses.badRequest,
        { status: 400 }
      );
    }
  }),

  /**
   * POST /booking - Create booking
   */
  http.post(`${MATRIX_API_BASE}/booking`, async ({ request }) => {
    await delay(200);

    try {
      const body = await request.json() as any;
      const { locationId, timeFrom, timeTo, attendees, owner } = body;

      // Validate required fields
      if (!locationId || !timeFrom || !timeTo || !attendees || !owner) {
        return HttpResponse.json(
          mockErrorResponses.badRequest,
          { status: 400 }
        );
      }

      // Find location
      const location = mockLocations.find(loc => loc.id === locationId);
      if (!location) {
        return HttpResponse.json(
          mockErrorResponses.notFound,
          { status: 404 }
        );
      }

      // Simulate booking conflicts on certain patterns
      const fromDate = new Date(timeFrom);
      const isConflicted = fromDate.getMinutes() === 0 && fromDate.getHours() === 11;

      if (isConflicted) {
        return HttpResponse.json(
          mockBookingFailureResponse,
          { status: 409 }
        );
      }

      // Create successful booking response
      const bookingId = Date.now();
      const response = createMockBookingResponse({
        id: bookingId,
        locationId: locationId,
        timeFrom: timeFrom,
        timeTo: timeTo,
        owner: {
          id: owner.id || 1,
          name: owner.name,
          email: owner.email
        },
        bookedBy: {
          id: owner.id || 1,
          name: owner.name,
          email: owner.email
        },
        attendeeCount: Array.isArray(attendees) ? attendees.length : 1
      });

      return HttpResponse.json(response, { status: 201 });
    } catch (error) {
      return HttpResponse.json(
        mockErrorResponses.badRequest,
        { status: 400 }
      );
    }
  })
];

/**
 * Error scenario handlers for testing specific failure cases
 */
export const errorHandlers = [
  /**
   * Unauthorized access (401)
   */
  http.post(`${MATRIX_API_BASE}/availability-401`, async () => {
    await delay(100);
    return HttpResponse.json(
      mockErrorResponses.unauthorized,
      { status: 401 }
    );
  }),

  /**
   * Forbidden access (403)
   */
  http.post(`${MATRIX_API_BASE}/availability-403`, async () => {
    await delay(100);
    return HttpResponse.json(
      mockErrorResponses.forbidden,
      { status: 403 }
    );
  }),

  /**
   * Internal Server Error (500)
   */
  http.post(`${MATRIX_API_BASE}/availability-500`, async () => {
    await delay(100);
    return HttpResponse.json(
      mockErrorResponses.internalServerError,
      { status: 500 }
    );
  }),

  /**
   * Timeout simulation - takes longer than 5 seconds
   */
  http.post(`${MATRIX_API_BASE}/availability-timeout`, async () => {
    await delay(6000); // Longer than 5-second timeout
    return HttpResponse.json(mockAvailabilityResponse);
  }),

  /**
   * Network error simulation
   */
  http.post(`${MATRIX_API_BASE}/availability-network-error`, async () => {
    return HttpResponse.error();
  })
];

/**
 * All handlers combined
 */
export const allHandlers = [...matrixApiHandlers, ...errorHandlers];

/**
 * Handler utilities for tests
 */
export const createCustomHandler = (endpoint: string, response: any, status = 200) => {
  return http.post(`${MATRIX_API_BASE}${endpoint}`, async () => {
    await delay(100);
    return HttpResponse.json(response, { status });
  });
};

export const createDelayedHandler = (endpoint: string, response: any, delayMs: number) => {
  return http.post(`${MATRIX_API_BASE}${endpoint}`, async () => {
    await delay(delayMs);
    return HttpResponse.json(response);
  });
};