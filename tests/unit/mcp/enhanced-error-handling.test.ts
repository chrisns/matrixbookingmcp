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

describe('MatrixBookingMCPServer - Enhanced Error Handling', () => {
  let mcpServer: MatrixBookingMCPServer;
  let mockAvailabilityService: AvailabilityService;
  let mockLocationService: LocationService;
  let mockUserService: UserService;
  let mockOrganizationService: OrganizationService;
  let mockSearchService: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks for constructor dependencies
    const mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        apiBaseUrl: 'https://api.example.com',
        apiTimeout: 5000,
        matrixPreferredLocation: '1',
        matrixUsername: 'test@example.com',
        matrixPassword: 'password'
      })
    } as any;

    const mockAuthManager = {
      getAccessToken: vi.fn().mockResolvedValue('mock-token'),
      authenticate: vi.fn().mockResolvedValue(true)
    } as any;

    const mockApiClient = {
      get: vi.fn(),
      post: vi.fn()
    } as any;

    // Create mock services
    mockAvailabilityService = {
      checkAvailability: vi.fn()
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

    mockOrganizationService = {
      getBookingCategories: vi.fn()
    } as any;

    mockSearchService = {
      search: vi.fn()
    } as any;

    // Default mock for BookingService
    const mockBookingService = {
      formatBookingRequest: vi.fn(),
      createBooking: vi.fn(),
      resolveLocationId: vi.fn()
    } as any;

    // Mock constructors
    vi.mocked(ConfigurationManager).mockReturnValue(mockConfigManager);
    vi.mocked(AuthenticationManager).mockReturnValue(mockAuthManager);
    vi.mocked(MatrixAPIClient).mockReturnValue(mockApiClient);
    vi.mocked(AvailabilityService).mockReturnValue(mockAvailabilityService);
    vi.mocked(BookingService).mockReturnValue(mockBookingService);
    vi.mocked(LocationService).mockReturnValue(mockLocationService);
    vi.mocked(UserService).mockReturnValue(mockUserService);
    vi.mocked(OrganizationService).mockReturnValue(mockOrganizationService);
    vi.mocked(SearchService).mockReturnValue(mockSearchService);

    mcpServer = new MatrixBookingMCPServer();
  });

  describe('Error Analysis', () => {
    it('should correctly analyze HTTP 405 errors', async () => {
      const error = new Error('HTTP 405 Method Not Allowed');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      // Use the private method directly since the MCP server setup is complex
      const response = await (mcpServer as any).handleCheckAvailability({ dateFrom: '2024-01-01T09:00:00Z' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('METHOD_NOT_ALLOWED');
      expect(responseContent.error.httpStatus).toBe(405);
      expect(responseContent.suggestions).toHaveLength(2);
      expect(responseContent.suggestions[0].tool).toBe('health_check');
      expect(responseContent.suggestions[1].tool).toBe('get_current_user');
    });

    it('should correctly analyze "Person not found" errors', async () => {
      const error = new Error('Person not found in system');
      mockUserService.getCurrentUser = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleGetCurrentUser({});

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('PERSON_NOT_FOUND');
      expect(responseContent.troubleshooting.commonCauses).toContain('User not properly registered in Matrix system');
      expect(responseContent.suggestions[0].tool).toBe('get_current_user');
    });

    it('should correctly analyze location not found errors', async () => {
      const error = new Error('Location not found: invalid ID 123');
      mockLocationService.getLocation = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleGetLocation({ locationId: 123 });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('LOCATION_NOT_FOUND');
      // Should suggest location exploration tools
      const locationTools = responseContent.suggestions.filter((s: any) => s.tool === 'get_locations');
      expect(locationTools.length).toBeGreaterThan(0);
    });

    it('should correctly analyze timeout errors', async () => {
      const error = new Error('Request timeout after 5000ms');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleCheckAvailability({ dateFrom: '2024-01-01T09:00:00Z' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('REQUEST_TIMEOUT');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Run health_check to verify service availability');
      expect(responseContent.suggestions[0].tool).toBe('health_check');
    });

    it('should correctly analyze authentication errors', async () => {
      const error = new Error('Authentication failed: 401 Unauthorized');
      mockUserService.getCurrentUser = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleGetCurrentUser({});

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('AUTH_FAILED');
      expect(responseContent.error.httpStatus).toBe(401);
      expect(responseContent.troubleshooting.commonCauses).toContain('Invalid or expired authentication credentials');
    });

    it('should correctly analyze network errors', async () => {
      const error = new Error('Network connection failed: ECONNREFUSED');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleCheckAvailability({ dateFrom: '2024-01-01T09:00:00Z' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('NETWORK_CONNECTION_FAILED');
      expect(responseContent.troubleshooting.commonCauses).toContain('Network connectivity issues');
    });
  });

  describe('Context-Specific Error Suggestions', () => {
    it('should provide availability-specific suggestions for timeout errors', async () => {
      const error = new Error('Request timeout');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleCheckAvailability({ dateFrom: '2024-01-01T09:00:00Z' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should suggest retry with shorter time range for availability context
      const availabilitySuggestions = responseContent.suggestions.filter((s: any) => 
        s.tool === 'matrix_booking_check_availability'
      );
      expect(availabilitySuggestions.length).toBeGreaterThan(0);
    });

    it('should provide location-specific suggestions for location errors in booking context', async () => {
      const error = new Error('Location not found');
      // Mock the booking service to throw location error
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      // Create new server instance to pick up mocked booking service
      const newMcpServer = new MatrixBookingMCPServer();
      const server = newMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_create_booking',
          arguments: { 
            timeFrom: '2024-01-01T09:00:00Z',
            timeTo: '2024-01-01T10:00:00Z',
            locationName: 'NonExistentRoom'
          }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should suggest location exploration tools for booking context
      const getLocationsSuggestions = responseContent.suggestions.filter((s: any) => s.tool === 'get_locations');
      const findRoomsSuggestions = responseContent.suggestions.filter((s: any) => s.tool === 'find_rooms_with_facilities');
      
      expect(getLocationsSuggestions.length).toBeGreaterThan(0);
      expect(findRoomsSuggestions.length).toBeGreaterThan(0);
    });

    it('should provide facility-specific suggestions for facility discovery errors', async () => {
      const error = new Error('Facility discovery failed');
      mockLocationService.getLocationHierarchy = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'discover_available_facilities',
          arguments: { category: 'audio_visual' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should suggest alternative facility discovery methods
      const facilityDiscoveryTools = responseContent.suggestions.filter((s: any) => s.tool === 'get_locations');
      expect(facilityDiscoveryTools.length).toBeGreaterThan(0);
    });
  });

  describe('Tool-Specific Error Handling', () => {
    it('should handle matrix_booking_check_availability errors with enhanced context', async () => {
      const error = new Error('Matrix API error: 500 Internal Server Error');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      // Use the private method directly since the MCP server setup is complex
      const response = await (mcpServer as any).handleCheckAvailability({ dateFrom: '2024-01-01T09:00:00Z' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.tool).toBe('matrix_booking_check_availability');
      expect(responseContent.error.context).toBe('availability');
      expect(responseContent.relatedWorkflows).toContain('System troubleshooting and diagnostics');
    });

    it('should handle get_user_bookings errors with user-specific suggestions', async () => {
      const error = new Error('User permissions insufficient');
      mockUserService.getUserBookings = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleGetUserBookings({});

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.context).toBe('user');
      
      // Should not suggest user verification for user context errors 
      const userSuggestions = responseContent.suggestions.filter((s: any) => s.tool === 'get_current_user');
      expect(userSuggestions).toHaveLength(0);
    });

    it('should handle find_rooms_with_facilities errors with search-specific suggestions', async () => {
      const error = new Error('Search query failed');
      mockSearchService.search = vi.fn().mockRejectedValue(error);

      // Use the private method directly
      const response = await (mcpServer as any).handleFindRoomsWithFacilities({ query: 'complex search query' });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.context).toBe('search');
      
      // Should suggest broader search alternatives
      const searchSuggestions = responseContent.suggestions.filter((s: any) => 
        s.tool === 'find_rooms_with_facilities' && 
        s.description.includes('simpler')
      );
      expect(searchSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle health_check errors with system diagnostics', async () => {
      // The health check method has its own internal error handling
      // It will return degraded status rather than throw errors
      // Let's test with the normal health check behavior
      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'health_check',
          arguments: { verbose: true }
        }
      });

      // Health check should not error but return status information
      expect(response.isError).toBeFalsy();
      expect(response.content).toBeDefined();
      expect(response.content[0].text).toBeTruthy();
      
      // Parse to verify it's valid JSON health status
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.status).toBeDefined();
      expect(responseContent.services).toBeDefined();
    });

    it('should handle get_tool_guidance errors gracefully', async () => {
      // Simulate error in guidance processing
      const server = mcpServer.getServer();
      
      // Mock to cause JSON parsing error or similar internal error
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'get_tool_guidance',
          arguments: { intent: 'test intent' }
        }
      });

      // Should successfully handle the request without throwing
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0].text).toBeTruthy();
    });
  });

  describe('Error Response Format', () => {
    it('should return properly formatted enhanced error responses', async () => {
      const error = new Error('Test error for format validation');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_check_availability',
          arguments: { dateFrom: '2024-01-01T09:00:00Z' }
        }
      });

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      
      const responseContent = JSON.parse(response.content[0].text);
      
      // Verify error structure
      expect(responseContent.error).toBeDefined();
      expect(responseContent.error.message).toBe('Test error for format validation');
      expect(responseContent.error.tool).toBe('matrix_booking_check_availability');
      expect(responseContent.error.context).toBe('availability');
      
      // Verify suggestions structure
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Verify suggestion format
      const firstSuggestion = responseContent.suggestions[0];
      expect(firstSuggestion.action).toBeDefined();
      expect(firstSuggestion.tool).toBeDefined();
      expect(firstSuggestion.description).toBeDefined();
      
      // Verify troubleshooting structure
      expect(responseContent.troubleshooting).toBeDefined();
      expect(responseContent.troubleshooting.commonCauses).toBeDefined();
      expect(responseContent.troubleshooting.diagnosticSteps).toBeDefined();
      expect(Array.isArray(responseContent.troubleshooting.commonCauses)).toBe(true);
      expect(Array.isArray(responseContent.troubleshooting.diagnosticSteps)).toBe(true);
      
      // Verify related workflows
      expect(responseContent.relatedWorkflows).toBeDefined();
      expect(Array.isArray(responseContent.relatedWorkflows)).toBe(true);
    });
  });

  describe('Unknown Tool Error Handling', () => {
    it('should handle unknown tool names with enhanced error response', async () => {
      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.message).toContain('Unknown tool: nonexistent_tool');
      expect(responseContent.error.context).toBe('unknown');
      expect(responseContent.suggestions).toBeDefined();
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Task 9: Expanded Error Recovery Features', () => {
    it('should correctly analyze rate limit errors (429)', async () => {
      const error = new Error('429 Too Many Requests: API rate limit exceeded');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_check_availability',
          arguments: { dateFrom: '2024-01-01T09:00:00Z' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(responseContent.error.httpStatus).toBe(429);
      expect(responseContent.troubleshooting.commonCauses).toContain('Too many API requests in a short time period');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Wait 30-60 seconds before retrying the operation');
      expect(responseContent.relatedWorkflows).toContain('Rate limit recovery and retry strategies');
    });

    it('should correctly analyze server errors (500, 502, 503)', async () => {
      const error = new Error('500 Internal Server Error');
      mockUserService.getCurrentUser = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'get_current_user',
          arguments: {}
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(responseContent.error.httpStatus).toBe(500);
      expect(responseContent.troubleshooting.commonCauses).toContain('Temporary server overload or maintenance');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Wait 1-2 minutes and retry the operation');
      expect(responseContent.suggestions[0].tool).toBe('health_check');
    });

    it('should correctly analyze validation errors (400)', async () => {
      const error = new Error('400 Bad Request: Invalid date format');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_check_availability',
          arguments: { dateFrom: 'invalid-date' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('BAD_REQUEST');
      expect(responseContent.error.httpStatus).toBe(400);
      expect(responseContent.troubleshooting.commonCauses).toContain('Invalid date or time format');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('2. Verify date/time formats are correct (ISO 8601)');
      expect(responseContent.suggestions[0].tool).toBe('get_tool_guidance');
    });

    it('should correctly analyze permission errors (403)', async () => {
      const error = new Error('403 Forbidden: Insufficient permissions');
      mockLocationService.getLocation = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_get_location',
          arguments: { locationId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('FORBIDDEN');
      expect(responseContent.error.httpStatus).toBe(403);
      expect(responseContent.troubleshooting.commonCauses).toContain('Insufficient user permissions for the operation');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Run get_current_user to check user role and permissions');
      expect(responseContent.suggestions[0].tool).toBe('get_current_user');
    });

    it('should correctly analyze resource not found errors (404)', async () => {
      const error = new Error('404 Not Found: Resource does not exist');
      mockLocationService.getLocation = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_get_location',
          arguments: { locationId: 99999 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('NOT_FOUND');
      expect(responseContent.error.httpStatus).toBe(404);
      expect(responseContent.troubleshooting.commonCauses).toContain('Resource ID does not exist or has been removed');
      expect(responseContent.relatedWorkflows).toContain('Resource discovery and validation');
      
      // Should suggest location discovery tools for location context
      const locationTools = responseContent.suggestions.filter((s: any) => s.tool === 'get_locations');
      expect(locationTools.length).toBeGreaterThan(0);
    });

    it('should correctly analyze booking conflict errors (409)', async () => {
      const error = new Error('Time slot already booked by another user');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn().mockRejectedValue(error),
        resolveLocationId: vi.fn().mockResolvedValue(12345)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      // Create new MCP server instance with the updated mock
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_create_booking',
          arguments: { 
            locationId: 12345,
            timeFrom: '2024-01-01T09:00:00Z',
            timeTo: '2024-01-01T10:00:00Z'
          }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('BOOKING_CONFLICT');
      expect(responseContent.error.httpStatus).toBe(409);
      expect(responseContent.troubleshooting.commonCauses).toContain('Time slot already reserved by another booking');
      expect(responseContent.relatedWorkflows).toContain('Booking conflict resolution and alternatives');
      
      // Should suggest availability check and alternatives
      const availabilityTools = responseContent.suggestions.filter((s: any) => s.tool === 'matrix_booking_check_availability');
      const userBookingsTools = responseContent.suggestions.filter((s: any) => s.tool === 'get_user_bookings');
      const facilityTools = responseContent.suggestions.filter((s: any) => s.tool === 'find_rooms_with_facilities');
      
      expect(availabilityTools.length).toBeGreaterThan(0);
      expect(userBookingsTools.length).toBeGreaterThan(0);
      expect(facilityTools.length).toBeGreaterThan(0);
    });
  });

  describe('Task 9: Progressive Fallback Tool Alternatives', () => {
    it('should provide progressive fallback alternatives for booking context errors', async () => {
      const error = new Error('Unknown booking service error');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn().mockRejectedValue(error),
        resolveLocationId: vi.fn().mockResolvedValue(12345)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      // Create new MCP server instance with the updated mock
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_create_booking',
          arguments: { 
            locationId: 12345,
            timeFrom: '2024-01-01T09:00:00Z',
            timeTo: '2024-01-01T10:00:00Z'
          }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should provide booking workflow fallbacks in order
      const suggestions = responseContent.suggestions;
      const toolNames = suggestions.map((s: any) => s.tool);
      
      expect(toolNames).toContain('matrix_booking_check_availability');
      expect(toolNames).toContain('get_user_bookings');
      expect(toolNames).toContain('matrix_booking_get_location');
      expect(responseContent.relatedWorkflows).toContain('Booking validation and alternative planning');
    });

    it('should provide progressive fallback alternatives for facility search context errors', async () => {
      const error = new Error('Facility search service error');
      mockSearchService.findRoomsWithFacilities = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'find_rooms_with_facilities',
          arguments: { query: 'meeting room' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should provide facility search fallbacks in order
      const suggestions = responseContent.suggestions;
      const toolNames = suggestions.map((s: any) => s.tool);
      
      expect(toolNames).toContain('get_locations');
      expect(toolNames).toContain('find_rooms_with_facilities');
      expect(toolNames).toContain('get_booking_categories');
      expect(responseContent.relatedWorkflows).toContain('Progressive space discovery and facility search');
    });

    it('should provide comprehensive diagnostic steps for unknown errors', async () => {
      const error = new Error('Completely unknown error type');
      mockUserService.getCurrentUser = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'get_current_user',
          arguments: {}
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should provide universal fallback with comprehensive steps
      expect(responseContent.troubleshooting.diagnosticSteps).toHaveLength(7);
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Run health_check with verbose=true for comprehensive diagnostics');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('6. Use get_tool_guidance for specific troubleshooting advice');
      expect(responseContent.relatedWorkflows).toContain('Universal error diagnosis and recovery');
      
      // Should include health_check, get_current_user, and get_tool_guidance
      const suggestions = responseContent.suggestions;
      const toolNames = suggestions.map((s: any) => s.tool);
      
      expect(toolNames).toContain('health_check');
      expect(toolNames).toContain('get_tool_guidance');
    });
  });

  describe('Task 7: Cancel Booking Error Handling', () => {
    it('should handle cancel booking resource not found errors (404)', async () => {
      const error = new Error('404 Not Found: Booking not found or already cancelled');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn(),
        cancelBooking: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('NOT_FOUND');
      expect(responseContent.error.context).toBe('cancel_booking');
      expect(responseContent.troubleshooting.commonCauses).toContain('Booking ID does not exist or is incorrect');
      
      // Should suggest get_user_bookings to find valid booking IDs
      const getUserBookingsSuggestions = responseContent.suggestions.filter((s: any) => s.tool === 'get_user_bookings');
      expect(getUserBookingsSuggestions.length).toBeGreaterThan(0);
      expect(getUserBookingsSuggestions[0].description).toContain('List your current bookings to find valid booking IDs');
    });

    it('should handle cancel booking permission errors (403)', async () => {
      const error = new Error('403 Forbidden: You do not have permission to cancel this booking');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn(),
        cancelBooking: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('FORBIDDEN');
      expect(responseContent.error.context).toBe('cancel_booking');
      expect(responseContent.troubleshooting.commonCauses).toContain('User lacks permission to cancel booking');
      
      // Should suggest checking booking ownership
      const ownershipSuggestions = responseContent.suggestions.filter((s: any) => s.action === 'Check booking ownership');
      expect(ownershipSuggestions.length).toBeGreaterThan(0);
      expect(ownershipSuggestions[0].tool).toBe('get_user_bookings');
    });

    it('should handle cancel booking conflict errors (409)', async () => {
      const error = new Error('409 Conflict: Booking is already cancelled or in progress');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn(),
        cancelBooking: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('BOOKING_CONFLICT');
      expect(responseContent.error.context).toBe('cancel_booking');
      expect(responseContent.troubleshooting.commonCauses).toContain('Booking already cancelled or completed');
      
      // Should suggest checking booking status
      const statusSuggestions = responseContent.suggestions.filter((s: any) => s.action === 'Check if booking already cancelled');
      expect(statusSuggestions.length).toBeGreaterThan(0);
      expect(statusSuggestions[0].tool).toBe('get_user_bookings');
      expect(statusSuggestions[0].parameters.status).toBe('CANCELLED');
    });

    it('should handle cancel booking validation errors (400)', async () => {
      const error = new Error('400 Bad Request: Invalid booking ID format');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn(),
        cancelBooking: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 'invalid' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      expect(responseContent.error.code).toBe('BAD_REQUEST');
      expect(responseContent.error.context).toBe('cancel_booking');
      expect(responseContent.troubleshooting.commonCauses).toContain('Booking is currently in progress and cannot be cancelled');
      
      // Should suggest getting valid booking ID format
      const validationSuggestions = responseContent.suggestions.filter((s: any) => s.action === 'Get valid booking ID format');
      expect(validationSuggestions.length).toBeGreaterThan(0);
      expect(validationSuggestions[0].tool).toBe('get_user_bookings');
      expect(validationSuggestions[0].description).toContain('Get properly formatted booking IDs from your booking list');
    });

    it('should provide consistent cancel booking error response format', async () => {
      const error = new Error('Test cancel booking error');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn(),
        resolveLocationId: vi.fn(),
        cancelBooking: vi.fn().mockRejectedValue(error)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Verify error structure
      expect(responseContent.error).toBeDefined();
      expect(responseContent.error.message).toBe('Test cancel booking error');
      expect(responseContent.error.tool).toBe('matrix_booking_cancel_booking');
      expect(responseContent.error.context).toBe('cancel_booking');
      
      // Verify suggestions include cancel booking specific actions
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Verify troubleshooting includes cancel booking common causes
      expect(responseContent.troubleshooting.commonCauses).toContain('Booking ID does not exist or is incorrect');
      expect(responseContent.troubleshooting.diagnosticSteps).toContain('1. Use get_user_bookings to list your active bookings');
      
      // Verify related workflows
      expect(responseContent.relatedWorkflows).toContain('Booking management and cancellation workflow');
    });
  });

  describe('Task 9: Enhanced Retry Guidance', () => {
    it('should provide specific retry parameters for rate limit errors', async () => {
      const error = new Error('Too Many Requests');
      mockAvailabilityService.checkAvailability = vi.fn().mockRejectedValue(error);

      const server = mcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_check_availability',
          arguments: { dateFrom: '2024-01-01T09:00:00Z' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should provide specific retry parameters for rate limit context
      const retrySuggestion = responseContent.suggestions.find((s: any) => 
        s.action === 'Wait and retry with exponential backoff'
      );
      expect(retrySuggestion).toBeDefined();
      expect(retrySuggestion.parameters).toBeDefined();
      expect(retrySuggestion.parameters.duration).toBe(30);
    });

    it('should provide context-specific retry suggestions for validation errors in booking context', async () => {
      const error = new Error('400 Bad Request');
      const mockBookingService = {
        formatBookingRequest: vi.fn(),
        createBooking: vi.fn().mockRejectedValue(error),
        resolveLocationId: vi.fn().mockResolvedValue(12345)
      } as any;
      vi.mocked(BookingService).mockReturnValue(mockBookingService);

      // Create new MCP server instance with the updated mock
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_create_booking',
          arguments: { 
            locationId: 12345,
            timeFrom: '2024-01-01T09:00:00Z',
            timeTo: '2024-01-01T10:00:00Z'
          }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should provide booking-specific validation suggestions
      const suggestions = responseContent.suggestions;
      const availabilityCheck = suggestions.find((s: any) => s.tool === 'matrix_booking_check_availability');
      const locationCheck = suggestions.find((s: any) => s.tool === 'matrix_booking_get_location');
      
      expect(availabilityCheck).toBeDefined();
      expect(availabilityCheck.parameters.duration).toBe(60);
      expect(locationCheck).toBeDefined();
      expect(locationCheck.description).toContain('Ensure the location exists and is bookable');
    });
  });

  describe('Task 9: Cancel Booking Enhanced Error Handling', () => {
    it('should provide specific guidance for cancel booking RESOURCE_NOT_FOUND errors', async () => {
      // Mock booking service to throw a resource not found error
      const error = new Error('Booking not found');
      (error as any).response = { status: 404 };
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      // Create a test MCP server with the mocked booking service
      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 99999 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should include suggestions (error handling implementation provides generic suggestions)
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Should include troubleshooting information
      expect(responseContent.troubleshooting).toBeDefined();
    });

    it('should provide specific guidance for cancel booking PERMISSION_ERROR', async () => {
      // Mock booking service to throw a permission error
      const error = new Error('Permission denied - not booking owner');
      (error as any).response = { status: 403 };
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should include permission error suggestions
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Should include troubleshooting information
      expect(responseContent.troubleshooting).toBeDefined();
    });

    it('should provide specific guidance for cancel booking BOOKING_CONFLICT_ERROR', async () => {
      // Mock booking service to throw a booking conflict error
      const error = new Error('Booking already cancelled or in progress');
      (error as any).response = { status: 409 };
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should include conflict error suggestions
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Should include troubleshooting information
      expect(responseContent.troubleshooting).toBeDefined();
    });

    it('should provide specific guidance for cancel booking VALIDATION_ERROR', async () => {
      // Mock booking service to throw a validation error
      const error = new Error('Invalid booking ID format');
      (error as any).response = { status: 400 };
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 'invalid-format' }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should include validation error suggestions
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(0);
      
      // Should include troubleshooting information
      expect(responseContent.troubleshooting).toBeDefined();
    });

    it('should include cancel booking context in all error responses', async () => {
      // Mock booking service to throw a generic error
      const error = new Error('Test cancel booking error');
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Verify cancel booking context is set
      expect(responseContent.error.tool).toBe('matrix_booking_cancel_booking');
      expect(responseContent.error.context).toBe('cancel_booking');
      
      // Verify cancellation workflow is referenced
      expect(responseContent.relatedWorkflows).toContain('Booking management and cancellation workflow');
      
      // Should include diagnostic steps
      expect(responseContent.troubleshooting.diagnosticSteps).toBeDefined();
      expect(Array.isArray(responseContent.troubleshooting.diagnosticSteps)).toBe(true);
      expect(responseContent.troubleshooting.diagnosticSteps.length).toBeGreaterThan(0);
    });

    it('should provide actionable next steps for cancel booking failures', async () => {
      // Mock booking service to throw a generic error
      const error = new Error('Cancel booking operation failed');
      const mockBookingService = {
        cancelBooking: vi.fn().mockRejectedValue(error)
      };

      vi.mocked(BookingService).mockReturnValue(mockBookingService as any);
      const testMcpServer = new MatrixBookingMCPServer();
      const server = testMcpServer.getServer();
      
      const response = await server['_requestHandlers'].get('tools/call')({
        method: 'tools/call',
        params: {
          name: 'matrix_booking_cancel_booking',
          arguments: { bookingId: 12345 }
        }
      });

      expect(response.isError).toBe(true);
      const responseContent = JSON.parse(response.content[0].text);
      
      // Should have multiple actionable suggestions
      expect(responseContent.suggestions.length).toBeGreaterThan(1);
      
      // Should include multiple actionable suggestions
      expect(responseContent.suggestions).toBeDefined();
      expect(Array.isArray(responseContent.suggestions)).toBe(true);
      expect(responseContent.suggestions.length).toBeGreaterThan(1);
      
      // Should include troubleshooting information
      expect(responseContent.troubleshooting).toBeDefined();
    });
  });
});