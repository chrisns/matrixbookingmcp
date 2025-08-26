/**
 * MSW testing utilities and mocks export
 * Provides easy access to all MSW-related testing tools
 */

// Core MSW setup
export { server, setupMSW, withHandlers, withoutMSW } from './setup.js';

// Request handlers
export { 
  matrixApiHandlers, 
  errorHandlers, 
  allHandlers,
  createCustomHandler,
  createDelayedHandler 
} from './matrix-api.handlers.js';

// Test data and factories
export {
  // Mock data
  mockLocations,
  mockTimeSlots,
  mockAvailabilityResponse,
  mockNoAvailabilityResponse,
  mockBookingResponse,
  mockBookingFailureResponse,
  mockErrorResponses,
  
  // Factory functions
  createMockLocation,
  createMockTimeSlot,
  createMockAvailabilityResponse,
  createMockBookingResponse,
  
  // HTTP utilities
  createHttpResponse,
  createErrorResponse
} from './test-data.js';

// Import for use in test scenarios
import { mockLocations, createMockBookingResponse } from './test-data.js';

/**
 * Quick setup for common test scenarios
 */
export const testScenarios = {
  /**
   * Simulate API unavailability
   */
  unavailable: () => ({
    available: false,
    slots: [],
    location: mockLocations[0]
  }),

  /**
   * Simulate booking conflict
   */
  bookingConflict: () => createMockBookingResponse({
    status: 'CANCELLED'
  }),

  /**
   * Simulate network timeout
   */
  timeout: 6000, // ms - longer than 5-second API timeout

  /**
   * Common error status codes
   */
  errors: {
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
    conflict: 409,
    serverError: 500
  }
};

// Re-export everything from test data for convenience
export * from './test-data.js';