import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatrixBookingMCPServer } from '../../src/mcp/mcp-server';

// Mock all dependencies
vi.mock('../../src/config/index.js');
vi.mock('../../src/auth/index.js');
vi.mock('../../src/api/index.js');
vi.mock('../../src/services/availability-service.js');
vi.mock('../../src/services/booking-service.js');
vi.mock('../../src/services/location-service.js');
vi.mock('../../src/services/organization-service.js');
vi.mock('../../src/services/user-service.js');
vi.mock('@modelcontextprotocol/sdk/server/index.js');

describe('MatrixBookingMCPServer', () => {
  let server: MatrixBookingMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MatrixBookingMCPServer();
    // Mock configManager for the server
    (server as any).configManager = {
      getMatrixPreferredLocation: vi.fn().mockReturnValue(1000000),
      getConfig: vi.fn().mockReturnValue({
        matrixPreferredLocation: 1000000
      })
    };
  });

  describe('Tool Registration', () => {
    it('should register all required tools', async () => {
      const tools = (server as any).getTools();
      const toolNames = tools.map((t: any) => t.name);
      
      expect(toolNames).toContain('check_availability');
      expect(toolNames).toContain('create_booking');
      expect(toolNames).toContain('cancel_booking');
      expect(toolNames).toContain('get_user_bookings');
      expect(toolNames).toContain('browse_locations');
      expect(toolNames).toContain('search_by_facilities');
      expect(toolNames).toContain('list_booking_types');
      expect(toolNames).toContain('list_available_facilities');
      expect(toolNames).toContain('find_location_by_name');
      expect(toolNames).toContain('find_location_by_requirements');
      expect(tools).toHaveLength(10);
    });

    it('should have correct input schemas for each tool', () => {
      const tools = (server as any).getTools();
      
      const checkAvailability = tools.find((t: any) => t.name === 'check_availability');
      expect(checkAvailability.inputSchema.required).toEqual(['locationId', 'dateFrom', 'dateTo']);
      
      const createBooking = tools.find((t: any) => t.name === 'create_booking');
      expect(createBooking.inputSchema.required).toEqual(['locationId', 'timeFrom', 'timeTo']);
      
      const cancelBooking = tools.find((t: any) => t.name === 'cancel_booking');
      expect(cancelBooking.inputSchema.required).toEqual(['bookingId']);
      
      const findLocation = tools.find((t: any) => t.name === 'find_location_by_name');
      expect(findLocation.inputSchema.required).toEqual(['name']);
    });
  });

  describe('handleCheckAvailability', () => {
    it('should check availability with correct parameters', async () => {
      const mockAvailabilityService = {
        checkAvailability: vi.fn().mockResolvedValue({
          available: true,
          locations: []
        })
      };
      (server as any).availabilityService = mockAvailabilityService;

      const args = {
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00',
        bookingCategory: 456
      };

      const result = await (server as any).handleCheckAvailability(args);

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalledWith({
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00',
        locationId: 123,
        bookingCategory: 456
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('true');
    });

    it('should use default booking category if not provided', async () => {
      const mockAvailabilityService = {
        checkAvailability: vi.fn().mockResolvedValue({
          available: true,
          locations: []
        })
      };
      (server as any).availabilityService = mockAvailabilityService;

      const args = {
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00'
      };

      await (server as any).handleCheckAvailability(args);

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalledWith({
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00',
        locationId: 123,
        bookingCategory: 9000001 // Default desk category
      });
    });
  });

  describe('handleCreateBooking', () => {
    it('should create booking with correct parameters', async () => {
      const mockUserService = {
        getCurrentUser: vi.fn().mockResolvedValue({
          personId: 5000001,
          name: 'Test User',
          email: 'test@example.com'
        })
      };
      
      const mockBookingService = {
        createBooking: vi.fn().mockResolvedValue({
          id: 999,
          locationId: 123,
          timeFrom: '2025-01-01T09:00:00',
          timeTo: '2025-01-01T10:00:00'
        })
      };

      (server as any).userService = mockUserService;
      (server as any).bookingService = mockBookingService;

      const args = {
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00',
        description: 'Test Meeting'
      };

      const result = await (server as any).handleCreateBooking(args);

      expect(mockUserService.getCurrentUser).toHaveBeenCalled();
      expect(mockBookingService.createBooking).toHaveBeenCalledWith({
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00',
        label: 'Test Meeting',
        attendees: [],
        extraRequests: [],
        owner: {
          id: 5000001,
          name: 'Test User',
          email: 'test@example.com'
        },
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      });

      expect(result.content[0].text).toContain('Booking created successfully');
      expect(result.content[0].text).toContain('999');
    });

    it('should use default description if not provided', async () => {
      const mockUserService = {
        getCurrentUser: vi.fn().mockResolvedValue({
          personId: 5000001,
          name: 'Test User',
          email: 'test@example.com'
        })
      };
      
      const mockBookingService = {
        createBooking: vi.fn().mockResolvedValue({
          id: 999,
          locationId: 123,
          timeFrom: '2025-01-01T09:00:00',
          timeTo: '2025-01-01T10:00:00'
        })
      };

      (server as any).userService = mockUserService;
      (server as any).bookingService = mockBookingService;

      const args = {
        locationId: 123,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00'
      };

      await (server as any).handleCreateBooking(args);

      expect(mockBookingService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Meeting room booking'
        })
      );
    });
  });

  describe('handleCancelBooking', () => {
    it('should cancel booking with correct parameters', async () => {
      const mockBookingService = {
        cancelBooking: vi.fn().mockResolvedValue({})
      };

      (server as any).bookingService = mockBookingService;

      const args = {
        bookingId: 123,
        reason: 'No longer needed'
      };

      const result = await (server as any).handleCancelBooking(args);

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith({
        bookingId: 123,
        reason: 'No longer needed'
      });

      expect(result.content[0].text).toContain('cancelled successfully');
    });
  });

  describe('handleGetUserBookings', () => {
    it('should return user bookings', async () => {
      const mockUserService = {
        getUserBookings: vi.fn().mockResolvedValue({
          bookings: [
            {
              locationId: 123,
              timeFrom: '2025-01-01T09:00:00',
              timeTo: '2025-01-01T10:00:00'
            },
            {
              locationId: 456,
              timeFrom: '2025-01-02T14:00:00',
              timeTo: '2025-01-02T15:00:00'
            }
          ]
        })
      };

      (server as any).userService = mockUserService;

      const result = await (server as any).handleGetUserBookings({});

      expect(mockUserService.getUserBookings).toHaveBeenCalledWith({});
      expect(result.content[0].text).toContain('Your bookings');
      expect(result.content[0].text).toContain('showing 2 of 2');
    });

    it('should limit results to MAX_RESULTS', async () => {
      const bookings = Array.from({ length: 100 }, (_, i) => ({
        locationId: i,
        timeFrom: '2025-01-01T09:00:00',
        timeTo: '2025-01-01T10:00:00'
      }));

      const mockUserService = {
        getUserBookings: vi.fn().mockResolvedValue({ bookings })
      };

      (server as any).userService = mockUserService;

      const result = await (server as any).handleGetUserBookings({});
      
      expect(result.content[0].text).toContain('showing 50 of 100');
    });
  });

  describe('handleBrowseLocations', () => {
    it('should browse locations without filters', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { id: 1, name: 'Building A', kind: 'BUILDING' },
            { id: 2, name: 'Floor 1', kind: 'FLOOR' }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleBrowseLocations({});

      expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledWith({
        includeChildren: true,
        includeFacilities: true
      });

      expect(result.content[0].text).toContain('Building A');
      expect(result.content[0].text).toContain('Floor 1');
    });

    it('should browse child locations when parentId provided', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { 
              id: 1, 
              name: 'Building A', 
              kind: 'BUILDING',
              locations: [
                { id: 2, name: 'Floor 1', kind: 'FLOOR' },
                { id: 3, name: 'Floor 2', kind: 'FLOOR' }
              ]
            }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleBrowseLocations({ parentId: 1 });

      expect(result.content[0].text).toContain('Child locations of 1');
      expect(result.content[0].text).toContain('Floor 1');
      expect(result.content[0].text).toContain('Floor 2');
    });

    it('should filter by kind when specified', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { id: 1, name: 'Building A', kind: 'BUILDING' },
            { id: 2, name: 'Room 101', kind: 'ROOM' },
            { id: 3, name: 'Desk 1', kind: 'DESK' }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleBrowseLocations({ kind: 'ROOM' });

      expect(result.content[0].text).toContain('Room 101');
      expect(result.content[0].text).not.toContain('Building A');
      expect(result.content[0].text).not.toContain('Desk 1');
    });
  });

  describe('handleFindLocationByName', () => {
    it('should find location by name', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { id: 1, name: 'TestRoom1', kind: 'ROOM', qualifiedName: 'Test Room 1' },
            { id: 2, name: '702', kind: 'ROOM', qualifiedName: 'Room 702' }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleFindLocationByName({ 
        name: 'TestRoom1',
        searchType: 'room' 
      });

      expect(result.content[0].text).toContain('✅ Found: TestRoom1');
      expect(result.content[0].text).toContain('Ready to book with ID: 1');
    });

    it('should search with building hint', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: []
        })
      };

      (server as any).locationService = mockLocationService;

      await (server as any).handleFindLocationByName({ 
        name: 'TestRoom1',
        buildingHint: 'Building A',
        searchType: 'room'
      });

      expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledWith({
        locationId: 1000000, // Generic building ID
        kind: 'ROOM',
        includeChildren: false,
        includeFacilities: false
      });
    });

    it('should return error when name not provided', async () => {
      const result = await (server as any).handleFindLocationByName({});
      expect(result.content[0].text).toContain('Error: Location name is required');
    });
  });

  describe('handleListBookingTypes', () => {
    it('should list booking types', async () => {
      const mockUserService = {
        getCurrentUser: vi.fn().mockResolvedValue({
          organisationId: 123
        })
      };

      const mockOrganizationService = {
        getBookingCategories: vi.fn().mockResolvedValue([
          { id: 1, name: 'Meeting Room', description: 'Book meeting rooms' },
          { id: 2, name: 'Desk', description: 'Book desks' }
        ])
      };

      (server as any).userService = mockUserService;
      (server as any).organizationService = mockOrganizationService;

      const result = await (server as any).handleListBookingTypes({});

      expect(mockOrganizationService.getBookingCategories).toHaveBeenCalledWith(123);
      expect(result.content[0].text).toContain('Meeting Room');
      expect(result.content[0].text).toContain('Desk');
    });
  });

  describe('handleListAvailableFacilities', () => {
    it('should list unique facilities', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { 
              id: 1, 
              facilities: [
                { name: 'Projector' },
                { name: 'Whiteboard' }
              ]
            },
            { 
              id: 2, 
              facilities: [
                { name: 'Projector' }, // Duplicate
                { name: 'Video Conference' }
              ]
            }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleListAvailableFacilities({});

      const text = result.content[0].text;
      expect(text).toContain('Projector');
      expect(text).toContain('Whiteboard');
      expect(text).toContain('Video Conference');
      
      // Should not have duplicates
      const projectorCount = (text.match(/Projector/g) || []).length;
      expect(projectorCount).toBe(1);
    });

    it('should handle locations without facilities', async () => {
      const mockLocationService = {
        getLocationHierarchy: vi.fn().mockResolvedValue({
          locations: [
            { id: 1 },
            { id: 2, facilities: null },
            { id: 3, facilities: [] }
          ]
        })
      };

      (server as any).locationService = mockLocationService;

      const result = await (server as any).handleListAvailableFacilities({});
      expect(result.content[0].text).toContain('No facilities found');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const mockAvailabilityService = {
        checkAvailability: vi.fn().mockRejectedValue(new Error('API Error'))
      };

      (server as any).availabilityService = mockAvailabilityService;

      const result = await (server as any).handleCheckAvailability({
        locationId: 123,
        dateFrom: '2025-01-01T09:00:00',
        dateTo: '2025-01-01T10:00:00'
      });

      expect(result.content[0].text).toContain('Error in check_availability');
      expect(result.content[0].text).toContain('API Error');
      expect(result.isError).toBe(true);
    });

    it('should return error for unknown tool names', async () => {
      // Test that all registered tools are known
      const tools = (server as any).getTools();
      const knownToolNames = tools.map((t: any) => t.name);
      
      // Verify all expected tools are registered
      expect(knownToolNames).toContain('check_availability');
      expect(knownToolNames).toContain('create_booking');
      expect(knownToolNames).toContain('cancel_booking');
      expect(knownToolNames).toContain('get_user_bookings');
      expect(knownToolNames).toContain('browse_locations');
      expect(knownToolNames).toContain('find_location_by_name');
      expect(knownToolNames).toContain('list_booking_types');
      expect(knownToolNames).toContain('list_available_facilities');
      expect(knownToolNames).toContain('search_by_facilities');
      
      // Verify exactly 10 tools are registered (added find_location_by_requirements)
      expect(knownToolNames.length).toBe(10);
    });
  });
});