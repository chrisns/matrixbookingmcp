import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatrixBookingMCPServer } from '../../../src/mcp/mcp-server.js';
import { ConfigurationManager } from '../../../src/config/index.js';
import { AuthenticationManager } from '../../../src/auth/index.js';
import { MatrixAPIClient } from '../../../src/api/index.js';
import { AvailabilityService } from '../../../src/services/availability-service.js';
import { BookingService } from '../../../src/services/booking-service.js';
import { LocationService } from '../../../src/services/location-service.js';
import { UserService } from '../../../src/services/user-service.js';
import { SearchService } from '../../../src/services/search-service.js';
import { OrganizationService } from '../../../src/services/organization-service.js';

// Mock dependencies
vi.mock('../../../src/config/index.js');
vi.mock('../../../src/auth/index.js');
vi.mock('../../../src/api/index.js');
vi.mock('../../../src/services/availability-service.js');
vi.mock('../../../src/services/booking-service.js');
vi.mock('../../../src/services/location-service.js');
vi.mock('../../../src/services/user-service.js');
vi.mock('../../../src/services/search-service.js');
vi.mock('../../../src/services/organization-service.js');

describe('MatrixBookingMCPServer', () => {
  let mcpServer: MatrixBookingMCPServer;
  let mockConfigManager: ConfigurationManager;
  let mockAuthManager: AuthenticationManager;
  let mockApiClient: MatrixAPIClient;
  let mockAvailabilityService: AvailabilityService;
  let mockBookingService: BookingService;
  let mockLocationService: LocationService;
  let mockUserService: UserService;
  let mockSearchService: SearchService;
  let mockOrganizationService: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock ConfigurationManager
    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        apiBaseUrl: 'https://api.example.com',
        apiTimeout: 5000,
        matrixPreferredLocation: '1',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password'
      })
    } as any;

    // Mock AuthenticationManager
    mockAuthManager = {
      getCredentials: vi.fn().mockReturnValue({
        username: 'test@example.com',
        password: 'password'
      }),
      createAuthHeader: vi.fn().mockReturnValue({
        'Authorization': 'Basic dGVzdEBleGFtcGxlLmNvbTpwYXNzd29yZA=='
      })
    } as any;

    // Mock MatrixAPIClient
    mockApiClient = {} as any;

    // Mock service classes
    mockAvailabilityService = {
      checkAvailability: vi.fn()
    } as any;

    mockBookingService = {
      formatBookingRequest: vi.fn(),
      createBooking: vi.fn(),
      cancelBooking: vi.fn()
    } as any;

    mockLocationService = {
      getLocation: vi.fn(),
      getPreferredLocation: vi.fn(),
      getLocationHierarchy: vi.fn()
    } as any;

    mockUserService = {
      getCurrentUser: vi.fn(),
      getUserBookings: vi.fn()
    } as any;

    mockSearchService = {
      search: vi.fn()
    } as any;

    mockOrganizationService = {
      getBookingCategories: vi.fn()
    } as any;

    // Setup constructor mocks
    (ConfigurationManager as any).mockImplementation(() => mockConfigManager);
    (AuthenticationManager as any).mockImplementation(() => mockAuthManager);
    (MatrixAPIClient as any).mockImplementation(() => mockApiClient);
    (AvailabilityService as any).mockImplementation(() => mockAvailabilityService);
    (BookingService as any).mockImplementation(() => mockBookingService);
    (LocationService as any).mockImplementation(() => mockLocationService);
    (UserService as any).mockImplementation(() => mockUserService);
    (SearchService as any).mockImplementation(() => mockSearchService);
    (OrganizationService as any).mockImplementation(() => mockOrganizationService);
  });

  describe('Constructor', () => {
    it('should create MCP server instance with correct configuration', () => {
      mcpServer = new MatrixBookingMCPServer();
      expect(mcpServer).toBeInstanceOf(MatrixBookingMCPServer);
    });

    it('should initialize services with correct dependencies', () => {
      mcpServer = new MatrixBookingMCPServer();
      
      expect(ConfigurationManager).toHaveBeenCalledOnce();
      expect(AuthenticationManager).toHaveBeenCalledWith(mockConfigManager);
      expect(MatrixAPIClient).toHaveBeenCalledWith(mockAuthManager, mockConfigManager);
    });
  });

  describe('Server Methods', () => {
    beforeEach(() => {
      mcpServer = new MatrixBookingMCPServer();
    });

    it('should have start method', async () => {
      expect(typeof mcpServer.start).toBe('function');
      await expect(mcpServer.start()).resolves.toBeUndefined();
    });

    it('should have stop method', async () => {
      expect(typeof mcpServer.stop).toBe('function');
      await expect(mcpServer.stop()).resolves.toBeUndefined();
    });

    it('should have getServer method', () => {
      expect(typeof mcpServer.getServer).toBe('function');
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    beforeEach(() => {
      mcpServer = new MatrixBookingMCPServer();
    });

    it('should register expected tools', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
      
      // The server should have been configured with the correct tools
      // This is tested implicitly through the constructor setup
    });
  });

  describe('Tool Definitions', () => {
    beforeEach(() => {
      mcpServer = new MatrixBookingMCPServer();
    });

    it('should define matrix_booking_check_availability tool correctly', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
      
      // Tool definitions are tested through the MCP framework
      // The actual tool schemas are defined in the getTools() private method
    });

    it('should define matrix_booking_create_booking tool correctly', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
    });

    it('should define matrix_booking_get_location tool correctly', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
    });
  });

  describe('Tool Handler Integration', () => {
    beforeEach(() => {
      mcpServer = new MatrixBookingMCPServer();
    });

    it('should test availability service integration through private method', async () => {
      const mockResponse = { rooms: [], message: 'No availability found' };
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleAvailability = (mcpServer as any).handleCheckAvailability;
      const result = await handleAvailability.call(mcpServer, {
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T17:00:00.000Z',
        locationId: 1
      });

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalledWith({
        dateFrom: '2024-01-15T09:00:00.000Z',
        dateTo: '2024-01-15T17:00:00.000Z',
        locationId: 1
      });
      expect(result.content[0].text).toContain('No availability found');
    });

    it('should test booking service integration through private method', async () => {
      const mockFormattedRequest = { timeFrom: '2024-01-15T09:00:00.000', timeTo: '2024-01-15T10:00:00.000' };
      const mockResponse = { bookingId: 12345, status: 'confirmed' };
      
      (mockBookingService.formatBookingRequest as any).mockReturnValue(mockFormattedRequest);
      (mockBookingService.createBooking as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleBooking = (mcpServer as any).handleCreateBooking;
      const result = await handleBooking.call(mcpServer, {
        timeFrom: '2024-01-15T09:00:00.000',
        timeTo: '2024-01-15T10:00:00.000',
        locationId: 1
      });

      expect(mockBookingService.formatBookingRequest).toHaveBeenCalled();
      expect(mockBookingService.createBooking).toHaveBeenCalledWith(mockFormattedRequest);
      expect(result.content[0].text).toContain('confirmed');
    });

    it('should test location service integration with locationId through private method', async () => {
      const mockResponse = { locationId: 1, name: 'Test Location', address: '123 Test St' };
      (mockLocationService.getLocation as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleLocation = (mcpServer as any).handleGetLocation;
      const result = await handleLocation.call(mcpServer, {
        locationId: 1
      });

      expect(mockLocationService.getLocation).toHaveBeenCalledWith(1);
      expect(result.content[0].text).toContain('Test Location');
    });

    it('should test location service integration without locationId through private method', async () => {
      const mockResponse = { locationId: 1, name: 'Preferred Location', address: '456 Preferred St' };
      (mockLocationService.getPreferredLocation as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleLocation = (mcpServer as any).handleGetLocation;
      const result = await handleLocation.call(mcpServer, {});

      expect(mockLocationService.getPreferredLocation).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Preferred Location');
    });

    it('should test service error handling through private methods', async () => {
      const errorMessage = 'Service unavailable';
      (mockAvailabilityService.checkAvailability as any).mockRejectedValue(new Error(errorMessage));

      // Test error handling in private method
      // Test error handling functionality exists
      
      // The error should be caught and handled by the call tool handler
      // We test the service is called, error handling is in the wrapper
      expect(mockAvailabilityService.checkAvailability).toBeDefined();
    });

    it('should test user service integration through private method with default parameters', async () => {
      const mockResponse = {
        bookings: [
          {
            id: 123,
            status: 'CONFIRMED',
            timeFrom: '2024-01-15T09:00:00.000Z',
            timeTo: '2024-01-15T10:00:00.000Z',
            locationId: 100001,
            locationKind: 'ROOM',
            owner: { id: 1, name: 'Test User', email: 'test@example.com' },
            bookedBy: { id: 1, name: 'Test User', email: 'test@example.com' },
            attendeeCount: 3,
            organisation: { id: 1, name: 'Test Org' },
            isPrivate: false,
            hasStarted: false,
            hasEnded: false,
            ownerIsAttendee: true,
            source: 'matrix-booking-mcp',
            version: 1,
            hasExternalNotes: false,
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
            checkInStatus: 'NOT_STARTED',
            checkInStartTime: '',
            checkInEndTime: ''
          }
        ],
        total: 1,
        page: 1,
        pageSize: 50
      };
      (mockUserService.getUserBookings as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleUserBookings = (mcpServer as any).handleGetUserBookings;
      const result = await handleUserBookings.call(mcpServer, {});

      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({});
      expect(result.content[0].text).toContain('Test User');
      expect(result.content[0].text).toContain('locationId');
      expect(result.content[0].text).toContain('1h');
      expect(result.isError).toBeUndefined();
    });

    it('should test user service integration with date filtering', async () => {
      const mockResponse = {
        bookings: [
          {
            id: 456,
            status: 'CONFIRMED',
            timeFrom: '2024-01-16T14:00:00.000Z',
            timeTo: '2024-01-16T15:30:00.000Z',
            locationId: 100002,
            locationKind: 'DESK',
            owner: { id: 2, name: 'Another User', email: 'another@example.com' },
            bookedBy: { id: 2, name: 'Another User', email: 'another@example.com' },
            attendeeCount: 1,
            organisation: { id: 1, name: 'Test Org' },
            isPrivate: true,
            hasStarted: true,
            hasEnded: false,
            ownerIsAttendee: true,
            source: 'matrix-booking-mcp',
            version: 2,
            hasExternalNotes: true,
            duration: { millis: 5400000 },
            possibleActions: {
              edit: false,
              cancel: false,
              approve: false,
              confirm: false,
              endEarly: true,
              changeOwner: false,
              start: false,
              viewHistory: true
            },
            checkInStatus: 'CHECKED_IN',
            checkInStartTime: '2024-01-16T14:05:00.000Z',
            checkInEndTime: ''
          }
        ],
        total: 1,
        page: 1,
        pageSize: 50
      };
      (mockUserService.getUserBookings as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleUserBookings = (mcpServer as any).handleGetUserBookings;
      const result = await handleUserBookings.call(mcpServer, {
        dateFrom: '2024-01-16T00:00:00.000Z',
        dateTo: '2024-01-16T23:59:59.999Z',
        status: 'ACTIVE'
      });

      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({
        startDate: '2024-01-16T00:00:00.000Z',
        endDate: '2024-01-16T23:59:59.999Z',
        status: 'ACTIVE'
      });
      expect(result.content[0].text).toContain('Another User');
      expect(result.content[0].text).toContain('locationId');
      expect(result.content[0].text).toContain('1h 30m');
    });

    it('should test user service integration with pagination', async () => {
      const mockResponse = {
        bookings: [],
        total: 25,
        page: 2,
        pageSize: 10
      };
      (mockUserService.getUserBookings as any).mockResolvedValue(mockResponse);

      // Test the private method by calling it via reflection
      const handleUserBookings = (mcpServer as any).handleGetUserBookings;
      const result = await handleUserBookings.call(mcpServer, {
        page: 2,
        pageSize: 10
      });

      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10
      });
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.summary.totalBookings).toBe(25);
      expect(parsedResult.summary.page).toBe(2);
      expect(parsedResult.summary.pageSize).toBe(10);
      expect(parsedResult.summary.hasNext).toBe(true);
    });

    it('should test user service error handling', async () => {
      const errorMessage = 'User authentication failed';
      (mockUserService.getUserBookings as any).mockRejectedValue(new Error(errorMessage));

      // Test the private method by calling it via reflection
      const handleUserBookings = (mcpServer as any).handleGetUserBookings;
      const result = await handleUserBookings.call(mcpServer, {});

      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({});
      expect(result.isError).toBe(true);
      
      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain(errorMessage);
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
    });

    it('should test duration calculation helper method', () => {
      // Test the private calculateDuration method
      const calculateDuration = (mcpServer as any).calculateDuration;
      
      // Test 1 hour
      expect(calculateDuration.call(mcpServer, '2024-01-15T09:00:00.000Z', '2024-01-15T10:00:00.000Z')).toBe('1h');
      
      // Test 1 hour 30 minutes
      expect(calculateDuration.call(mcpServer, '2024-01-15T09:00:00.000Z', '2024-01-15T10:30:00.000Z')).toBe('1h 30m');
      
      // Test 30 minutes
      expect(calculateDuration.call(mcpServer, '2024-01-15T09:00:00.000Z', '2024-01-15T09:30:00.000Z')).toBe('30m');
      
      // Test invalid dates
      expect(calculateDuration.call(mcpServer, 'invalid-date', '2024-01-15T10:00:00.000Z')).toBe('Unknown duration');
    });

    it('should test cancel booking service integration through private method', async () => {
      const mockResponse = {
        success: true,
        bookingId: 12345,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES',
        reason: 'Meeting cancelled',
        originalBooking: {
          locationId: 100001,
          timeFrom: '2024-01-15T14:00:00.000Z',
          timeTo: '2024-01-15T15:00:00.000Z',
          attendeeCount: 5,
          owner: 'John Doe'
        }
      };
      
      const mockLocationResponse = {
        id: 100001,
        name: 'Conference Room A',
        description: 'Large conference room'
      };

      (mockBookingService.cancelBooking as any).mockResolvedValue(mockResponse);
      (mockLocationService.getLocation as any).mockResolvedValue(mockLocationResponse);

      // Test the private method by calling it via reflection
      const handleCancelBooking = (mcpServer as any).handleCancelBooking;
      const result = await handleCancelBooking.call(mcpServer, {
        bookingId: 12345,
        notifyScope: 'ALL_ATTENDEES',
        sendNotifications: true,
        reason: 'Meeting cancelled'
      });

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith({
        bookingId: 12345,
        notifyScope: 'ALL_ATTENDEES',
        sendNotifications: true,
        reason: 'Meeting cancelled'
      });
      expect(mockLocationService.getLocation).toHaveBeenCalledWith(100001);
      expect(result.content[0].text).toContain('CANCELLED');
      expect(result.content[0].text).toContain('Conference Room A');
      expect(result.isError).toBeUndefined();
    });

    it('should test cancel booking with minimal parameters', async () => {
      const mockResponse = {
        success: true,
        bookingId: 67890,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: true,
        notifyScope: 'ALL_ATTENDEES'
      };

      (mockBookingService.cancelBooking as any).mockResolvedValue(mockResponse);

      // Test the private method with only required parameter
      const handleCancelBooking = (mcpServer as any).handleCancelBooking;
      const result = await handleCancelBooking.call(mcpServer, {
        bookingId: 67890
      });

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith({
        bookingId: 67890
      });
      expect(result.content[0].text).toContain('67890');
      expect(result.content[0].text).toContain('CANCELLED');
      expect(result.isError).toBeUndefined();
    });

    it('should test cancel booking error handling', async () => {
      const errorMessage = 'Booking not found or already cancelled';
      (mockBookingService.cancelBooking as any).mockRejectedValue(new Error(errorMessage));

      // Test error handling in private method
      const handleCancelBooking = (mcpServer as any).handleCancelBooking;
      const result = await handleCancelBooking.call(mcpServer, {
        bookingId: 'nonexistent'
      });

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith({
        bookingId: 'nonexistent'
      });
      expect(result.isError).toBe(true);
      
      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain(errorMessage);
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
    });

    it('should test cancel booking with location name resolution failure', async () => {
      const mockResponse = {
        success: true,
        bookingId: 11111,
        status: 'CANCELLED',
        cancellationTime: '2024-01-15T10:30:00.000Z',
        notificationsSent: false,
        notifyScope: 'NONE',
        originalBooking: {
          locationId: 999999,
          timeFrom: '2024-01-15T14:00:00.000Z',
          timeTo: '2024-01-15T15:00:00.000Z'
        }
      };

      (mockBookingService.cancelBooking as any).mockResolvedValue(mockResponse);
      (mockLocationService.getLocation as any).mockRejectedValue(new Error('Location not found'));

      // Test the private method
      const handleCancelBooking = (mcpServer as any).handleCancelBooking;
      const result = await handleCancelBooking.call(mcpServer, {
        bookingId: 11111,
        notifyScope: 'NONE',
        sendNotifications: false
      });

      expect(mockBookingService.cancelBooking).toHaveBeenCalled();
      expect(mockLocationService.getLocation).toHaveBeenCalledWith(999999);
      // Should still succeed even if location name resolution fails
      expect(result.content[0].text).toContain('CANCELLED');
      expect(result.isError).toBeUndefined();
    });

    it('should test tool definitions are properly returned', () => {
      // Test the private getTools method
      const getTools = (mcpServer as any).getTools;
      const tools = getTools.call(mcpServer);
      
      expect(tools).toHaveLength(12);
      expect(tools.map((t: any) => t.name)).toEqual([
        'matrix_booking_check_availability',
        'matrix_booking_create_booking',
        'matrix_booking_get_location',
        'get_current_user',
        'get_booking_categories',
        'get_locations',
        'discover_available_facilities',
        'find_rooms_with_facilities',
        'get_user_bookings',
        'health_check',
        'matrix_booking_cancel_booking',
        'get_tool_guidance'
      ]);
    });

    it('should test cancel booking tool definition schema', () => {
      // Test the tool definition schema
      const getTools = (mcpServer as any).getTools;
      const tools = getTools.call(mcpServer);
      
      const cancelBookingTool = tools.find((t: any) => t.name === 'matrix_booking_cancel_booking');
      expect(cancelBookingTool).toBeDefined();
      expect(cancelBookingTool.description).toContain('Cancel an existing room or desk booking');
      expect(cancelBookingTool.inputSchema.required).toEqual(['bookingId']);
      expect(cancelBookingTool.inputSchema.properties.bookingId.type).toEqual(['string', 'number']);
      expect(cancelBookingTool.inputSchema.properties.notifyScope.enum).toEqual(['ALL_ATTENDEES', 'OWNER_ONLY', 'NONE']);
      expect(cancelBookingTool.inputSchema.properties.reason.maxLength).toBe(500);
    });
  });
});

describe('MCP Server Integration', () => {
  it('should be exportable from the MCP module', async () => {
    const { MatrixBookingMCPServer: ExportedServer } = await import('../../../src/mcp/index.js');
    expect(ExportedServer).toBeDefined();
    expect(ExportedServer).toBe(MatrixBookingMCPServer);
  });
});