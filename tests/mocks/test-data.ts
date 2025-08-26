/**
 * Test data for Matrix Booking API mocking
 * Contains realistic response formats based on Matrix Booking API specifications
 */

import type { 
  ILocation, 
  IAvailabilityResponse, 
  IBookingResponse, 
  ITimeSlot 
} from '../../src/types/index.js';

/**
 * Test locations with various configurations
 */
export const mockLocations: ILocation[] = [
  {
    id: 1,
    name: 'Conference Room Alpha',
    capacity: 12,
    features: ['WiFi', 'Projector', 'Whiteboard', 'Video Conferencing']
  },
  {
    id: 2, 
    name: 'Meeting Room Beta',
    capacity: 6,
    features: ['WiFi', 'TV Display']
  },
  {
    id: 42,
    name: 'Executive Boardroom',
    capacity: 20,
    features: ['WiFi', 'Projector', 'Whiteboard', 'Video Conferencing', 'Catering Setup']
  }
];

/**
 * Test time slots for availability responses
 */
export const mockTimeSlots: ITimeSlot[] = [
  {
    from: '2024-01-01T09:00:00.000Z',
    to: '2024-01-01T10:00:00.000Z',
    available: true,
    locationId: 1
  },
  {
    from: '2024-01-01T10:00:00.000Z', 
    to: '2024-01-01T11:00:00.000Z',
    available: true,
    locationId: 1
  },
  {
    from: '2024-01-01T11:00:00.000Z',
    to: '2024-01-01T12:00:00.000Z',
    available: false,
    locationId: 1
  }
];

/**
 * Success availability response
 */
export const mockAvailabilityResponse: IAvailabilityResponse = {
  available: true,
  slots: mockTimeSlots.filter(slot => slot.available),
  location: mockLocations[0]!
};

/**
 * No availability response
 */
export const mockNoAvailabilityResponse: IAvailabilityResponse = {
  available: false,
  slots: [],
  location: mockLocations[0]!
};

/**
 * Successful booking response
 */
export const mockBookingResponse: IBookingResponse = {
  id: 123,
  status: 'CONFIRMED',
  timeFrom: '2024-01-01T09:00:00.000Z',
  timeTo: '2024-01-01T10:00:00.000Z',
  organisation: { id: 1, name: 'Test Organization' },
  locationId: 1,
  locationKind: 'meeting-room',
  owner: {
    id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com'
  },
  bookedBy: {
    id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com'
  },
  attendeeCount: 1,
  ownerIsAttendee: true,
  source: 'mcp-test',
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
    changeOwner: true,
    start: false,
    viewHistory: true
  },
  checkInStatus: 'NOT_CHECKED_IN',
  checkInStartTime: '2024-01-01T09:00:00.000Z',
  checkInEndTime: '2024-01-01T10:00:00.000Z',
  hasStarted: false,
  hasEnded: false
};

/**
 * Failed booking response - room unavailable
 */
export const mockBookingFailureResponse: IBookingResponse = {
  id: 124,
  status: 'CANCELLED',
  timeFrom: '2024-01-01T09:00:00.000Z',
  timeTo: '2024-01-01T10:00:00.000Z',
  organisation: { id: 1, name: 'Test Organization' },
  locationId: 1,
  locationKind: 'meeting-room',
  owner: {
    id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com'
  },
  bookedBy: {
    id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com'
  },
  attendeeCount: 1,
  ownerIsAttendee: true,
  source: 'mcp-test',
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
  checkInStartTime: '2024-01-01T09:00:00.000Z',
  checkInEndTime: '2024-01-01T10:00:00.000Z',
  hasStarted: false,
  hasEnded: false
};

/**
 * Matrix API Error Responses
 */
export const mockErrorResponses = {
  unauthorized: {
    error: 'Unauthorized',
    message: 'Invalid credentials provided',
    statusCode: 401
  },
  forbidden: {
    error: 'Forbidden', 
    message: 'Access denied to this resource',
    statusCode: 403
  },
  notFound: {
    error: 'Not Found',
    message: 'The requested resource was not found',
    statusCode: 404
  },
  internalServerError: {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    statusCode: 500
  },
  badRequest: {
    error: 'Bad Request',
    message: 'Invalid request parameters',
    statusCode: 400
  }
};

/**
 * Test data factory functions
 */
export const createMockLocation = (overrides: Partial<ILocation> = {}): ILocation => ({
  id: 1,
  name: 'Test Location',
  capacity: 10,
  features: ['WiFi'],
  ...overrides
});

export const createMockTimeSlot = (overrides: Partial<ITimeSlot> = {}): ITimeSlot => ({
  from: '2024-01-01T09:00:00.000Z',
  to: '2024-01-01T10:00:00.000Z',
  available: true,
  locationId: 1,
  ...overrides
});

export const createMockAvailabilityResponse = (overrides: Partial<IAvailabilityResponse> = {}): IAvailabilityResponse => ({
  available: true,
  slots: [createMockTimeSlot()],
  location: createMockLocation(),
  ...overrides
});

export const createMockBookingResponse = (overrides: Partial<IBookingResponse> = {}): IBookingResponse => ({
  id: 125,
  status: 'CONFIRMED',
  timeFrom: '2024-01-01T09:00:00.000Z',
  timeTo: '2024-01-01T10:00:00.000Z',
  organisation: { id: 1, name: 'Test Organization' },
  locationId: 1,
  locationKind: 'meeting-room',
  owner: {
    id: 1,
    name: 'Test Owner',
    email: 'owner@example.com'
  },
  bookedBy: {
    id: 1,
    name: 'Test Owner',
    email: 'owner@example.com'
  },
  attendeeCount: 1,
  ownerIsAttendee: true,
  source: 'mcp-test',
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
    changeOwner: true,
    start: false,
    viewHistory: true
  },
  checkInStatus: 'NOT_CHECKED_IN',
  checkInStartTime: '2024-01-01T09:00:00.000Z',
  checkInEndTime: '2024-01-01T10:00:00.000Z',
  hasStarted: false,
  hasEnded: false,
  ...overrides
});

/**
 * HTTP response helpers for different scenarios
 */
export const createHttpResponse = (data: any, status = 200) => ({
  status,
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
});

export const createErrorResponse = (status: number, message: string) => ({
  status,
  body: JSON.stringify({
    error: getErrorTypeFromStatus(status),
    message,
    statusCode: status
  }),
  headers: {
    'Content-Type': 'application/json'
  }
});

function getErrorTypeFromStatus(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 500: return 'Internal Server Error';
    default: return 'Unknown Error';
  }
}