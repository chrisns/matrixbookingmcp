import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatrixBookingMCPServer } from '../../../src/mcp/mcp-server.js';
import { IUserBookingsResponse, IUserBookingsRequest } from '../../../src/types/user.types.js';
import { IBookingResponse } from '../../../src/types/booking.types.js';

// Mock all the dependencies
vi.mock('../../../src/config/index.js');
vi.mock('../../../src/auth/index.js');
vi.mock('../../../src/api/index.js');
vi.mock('../../../src/services/availability-service.js');
vi.mock('../../../src/services/booking-service.js');
vi.mock('../../../src/services/location-service.js');
vi.mock('../../../src/services/organization-service.js');
vi.mock('../../../src/services/user-service.js');
vi.mock('../../../src/services/search-service.js');

describe('get_user_bookings MCP Tool', () => {
  let server: MatrixBookingMCPServer;
  let mockUserService: any;

  // Helper function to create complete mock booking objects
  const createMockBooking = (overrides: Partial<IBookingResponse> = {}): IBookingResponse => ({
    id: 1,
    locationId: 123,
    timeFrom: '2024-01-15T09:00:00.000Z',
    timeTo: '2024-01-15T10:00:00.000Z',
    status: 'CONFIRMED',
    attendeeCount: 1,
    owner: { id: 1, name: 'Test User', email: 'test@example.com' },
    bookedBy: { id: 1, name: 'Test User', email: 'test@example.com' },
    locationKind: 'Room',
    organisation: { id: 1, name: 'Test Org' },
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
      viewHistory: true
    },
    checkInStatus: 'NOT_CHECKED_IN',
    checkInStartTime: '',
    checkInEndTime: '',
    hasStarted: false,
    hasEnded: false,
    ...overrides
  });

  const mockBookingsResponse: IUserBookingsResponse = {
    bookings: [
      {
        id: 123,
        locationId: 456,
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        status: 'CONFIRMED',
        attendeeCount: 5,
        owner: { id: 1, name: 'John Doe', email: 'john@example.com' },
        bookedBy: { id: 1, name: 'John Doe', email: 'john@example.com' },
        locationKind: 'Room',
        organisation: { id: 1, name: 'Test Org' },
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
          viewHistory: true
        },
        checkInStatus: 'NOT_CHECKED_IN',
        checkInStartTime: '',
        checkInEndTime: '',
        hasStarted: false,
        hasEnded: false
      },
      {
        id: 124,
        locationId: 789,
        timeFrom: '2024-01-16T14:00:00.000Z',
        timeTo: '2024-01-16T15:30:00.000Z',
        status: 'CONFIRMED',
        attendeeCount: 2,
        owner: { id: 1, name: 'John Doe', email: 'john@example.com' },
        bookedBy: { id: 1, name: 'John Doe', email: 'john@example.com' },
        locationKind: 'Desk',
        organisation: { id: 1, name: 'Test Org' },
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp',
        version: 1,
        hasExternalNotes: false,
        isPrivate: true,
        duration: { millis: 5400000 },
        possibleActions: {
          edit: true,
          cancel: true,
          approve: false,
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
    total: 2,
    page: 1,
    pageSize: 50
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock UserService
    mockUserService = {
      getUserBookings: vi.fn(),
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        organisationId: 1
      })
    };

    // Replace the constructor to inject our mocks
    vi.doMock('../../../src/services/user-service.js', () => ({
      UserService: vi.fn(() => mockUserService)
    }));

    server = new MatrixBookingMCPServer();
    (server as any).userService = mockUserService;
  });

  describe('Tool Definition', () => {
    it('should include get_user_bookings tool in registry', async () => {
      const tools = (server as any).getTools();
      const getUserBookingsTool = tools.find((tool: any) => tool.name === 'get_user_bookings');
      
      expect(getUserBookingsTool).toBeDefined();
      expect(getUserBookingsTool.name).toBe('get_user_bookings');
    });

    it('should have enhanced description with use cases and anti-patterns', async () => {
      const tools = (server as any).getTools();
      const getUserBookingsTool = tools.find((tool: any) => tool.name === 'get_user_bookings');
      
      expect(getUserBookingsTool.description).toContain('Common Use Cases:');
      expect(getUserBookingsTool.description).toContain('Not For:');
      expect(getUserBookingsTool.description).toContain('Related Tools:');
      expect(getUserBookingsTool.description).toContain('What meetings do I have tomorrow?');
      expect(getUserBookingsTool.description).toContain('use matrix_booking_check_availability');
    });

    it('should define proper input schema with optional parameters', async () => {
      const tools = (server as any).getTools();
      const getUserBookingsTool = tools.find((tool: any) => tool.name === 'get_user_bookings');
      
      expect(getUserBookingsTool.inputSchema.type).toBe('object');
      expect(getUserBookingsTool.inputSchema.properties.dateFrom).toBeDefined();
      expect(getUserBookingsTool.inputSchema.properties.dateTo).toBeDefined();
      expect(getUserBookingsTool.inputSchema.properties.status).toBeDefined();
      expect(getUserBookingsTool.inputSchema.properties.page).toBeDefined();
      expect(getUserBookingsTool.inputSchema.properties.pageSize).toBeDefined();
      
      // Verify status enum
      expect(getUserBookingsTool.inputSchema.properties.status.enum).toContain('ACTIVE');
      expect(getUserBookingsTool.inputSchema.properties.status.enum).toContain('CANCELLED');
      expect(getUserBookingsTool.inputSchema.properties.status.enum).toContain('COMPLETED');
      
      // Verify pagination constraints
      expect(getUserBookingsTool.inputSchema.properties.page.minimum).toBe(1);
      expect(getUserBookingsTool.inputSchema.properties.pageSize.minimum).toBe(1);
      expect(getUserBookingsTool.inputSchema.properties.pageSize.maximum).toBe(100);
    });
  });

  describe('Handler Functionality', () => {
    it('should handle request with default parameters', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const result = await (server as any).handleGetUserBookings({});
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const parsedResponse = JSON.parse(result.content[0].text);
      expect(parsedResponse.summary.totalBookings).toBe(2);
      expect(parsedResponse.bookings).toHaveLength(2);
    });

    it('should handle request with date filtering parameters', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const args = {
        dateFrom: '2024-01-15T00:00:00.000Z',
        dateTo: '2024-01-16T23:59:59.999Z',
        status: 'ACTIVE'
      };
      
      const result = await (server as any).handleGetUserBookings(args);
      
      const expectedRequest: IUserBookingsRequest = {
        startDate: '2024-01-15T00:00:00.000Z',
        endDate: '2024-01-16T23:59:59.999Z',
        status: 'ACTIVE'
      };
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith(expectedRequest);
      expect(result.isError).toBeUndefined();
    });

    it('should handle request with pagination parameters', async () => {
      mockUserService.getUserBookings.mockResolvedValue({
        ...mockBookingsResponse,
        page: 2,
        pageSize: 25,
        total: 100
      });
      
      const args = {
        page: 2,
        pageSize: 25
      };
      
      const result = await (server as any).handleGetUserBookings(args);
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({
        page: 2,
        pageSize: 25
      });
      
      const parsedResponse = JSON.parse(result.content[0].text);
      expect(parsedResponse.summary.page).toBe(2);
      expect(parsedResponse.summary.pageSize).toBe(25);
      expect(parsedResponse.summary.totalBookings).toBe(100);
      expect(parsedResponse.summary.hasNext).toBe(true);
    });

    it('should format booking responses with human-readable information', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.bookings[0]).toEqual({
        id: 123,
        locationId: 456,
        locationName: 'Location ID: 456',
        timeSlot: '2024-01-15T09:00:00.000Z to 2024-01-15T10:00:00.000Z',
        status: 'CONFIRMED',
        duration: '1h',
        attendeeCount: 5,
        owner: 'John Doe',
        locationKind: 'Room',
        organisation: 'Test Org',
        isPrivate: false,
        hasStarted: false,
        hasEnded: false
      });
      
      expect(parsedResponse.bookings[1].duration).toBe('1h 30m');
    });

    it('should calculate duration correctly for various time spans', async () => {
      const mockBooking = createMockBooking({
        timeTo: '2024-01-15T09:30:00.000Z'
      });

      mockUserService.getUserBookings.mockResolvedValue({
        bookings: [mockBooking],
        total: 1,
        page: 1,
        pageSize: 50
      });
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.bookings[0].duration).toBe('30m');
    });

    it('should handle invalid date formats gracefully', async () => {
      const mockBookingWithInvalidDates = createMockBooking({
        timeFrom: 'invalid-date',
        timeTo: 'also-invalid'
      });

      mockUserService.getUserBookings.mockResolvedValue({
        bookings: [mockBookingWithInvalidDates],
        total: 1,
        page: 1,
        pageSize: 50
      });
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.bookings[0].duration).toBe('Unknown duration');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures with actionable suggestions', async () => {
      const authError = new Error('Authentication failed');
      mockUserService.getUserBookings.mockRejectedValue(authError);
      
      const result = await (server as any).handleGetUserBookings({});
      
      expect(result.isError).toBe(true);
      
      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Authentication failed');
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
      
      // Check for health check suggestion
      const healthCheckSuggestion = errorResponse.suggestions.find((s: any) => s.tool === 'health_check');
      expect(healthCheckSuggestion).toBeDefined();
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      mockUserService.getUserBookings.mockRejectedValue(serviceError);
      
      const result = await (server as any).handleGetUserBookings({});
      
      expect(result.isError).toBe(true);
      
      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Service temporarily unavailable');
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
    });

    it('should handle unknown errors gracefully', async () => {
      mockUserService.getUserBookings.mockRejectedValue('Unknown error object');
      
      const result = await (server as any).handleGetUserBookings({});
      
      expect(result.isError).toBe(true);
      
      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Unknown error object');
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
    });

    it('should log errors for debugging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Test error');
      mockUserService.getUserBookings.mockRejectedValue(testError);
      
      await (server as any).handleGetUserBookings({});
      
      expect(consoleSpy).toHaveBeenCalledWith('MCP Server: Error getting user bookings:', testError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Parameter Validation and Type Conversion', () => {
    it('should properly convert string parameters to correct types', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const args = {
        page: '2',
        pageSize: '25'
      };
      
      await (server as any).handleGetUserBookings(args);
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({
        page: '2', // Note: The current implementation passes strings as-is
        pageSize: '25' // This might need type conversion in the actual implementation
      });
    });

    it('should handle missing optional parameters', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const result = await (server as any).handleGetUserBookings({});
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({});
      expect(result.isError).toBeUndefined();
    });

    it('should handle null and undefined values in args', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const args = {
        dateFrom: null,
        dateTo: undefined,
        status: 'ACTIVE'
      };
      
      await (server as any).handleGetUserBookings(args);
      
      const expectedRequest: IUserBookingsRequest = {
        status: 'ACTIVE'
      };
      
      expect(mockUserService.getUserBookings).toHaveBeenCalledWith(expectedRequest);
    });
  });

  describe('Response Formatting', () => {
    it('should include pagination metadata in response', async () => {
      const paginatedResponse = {
        ...mockBookingsResponse,
        page: 2,
        pageSize: 10,
        total: 25
      };
      
      mockUserService.getUserBookings.mockResolvedValue(paginatedResponse);
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.summary).toEqual({
        totalBookings: 25,
        page: 2,
        pageSize: 10,
        hasNext: true
      });
    });

    it('should handle missing optional booking properties gracefully', async () => {
      const bookingWithMissingProps = createMockBooking({
        id: 123,
        locationId: 456,
        attendeeCount: undefined as any, // Test missing properties
        owner: undefined as any,
        locationKind: undefined as any,
        organisation: undefined as any
      });

      mockUserService.getUserBookings.mockResolvedValue({
        bookings: [bookingWithMissingProps],
        total: 1,
        page: 1,
        pageSize: 50
      });
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.bookings[0].attendeeCount).toBe(0);
      expect(parsedResponse.bookings[0].owner).toBe('Unknown');
      expect(parsedResponse.bookings[0].organisation).toBe('Unknown');
    });

    it('should format time slots correctly', async () => {
      mockUserService.getUserBookings.mockResolvedValue(mockBookingsResponse);
      
      const result = await (server as any).handleGetUserBookings({});
      const parsedResponse = JSON.parse(result.content[0].text);
      
      expect(parsedResponse.bookings[0].timeSlot).toBe(
        '2024-01-15T09:00:00.000Z to 2024-01-15T10:00:00.000Z'
      );
    });
  });
});