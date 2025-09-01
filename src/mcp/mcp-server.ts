import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigurationManager } from '../config/index.js';
import { AuthenticationManager } from '../auth/index.js';
import { MatrixAPIClient } from '../api/index.js';
import { 
  AvailabilityService,
  BookingService,
  LocationService,
  OrganizationService,
  UserService
} from '../services/index.js';
import { SearchService } from '../services/search-service.js';
import { FacilityParser } from '../services/facility-parser.js';
import { 
  ILocation, 
  ILocationQueryRequest,
  IBookingSearchRequest 
} from '../types/index.js';
import { ILocationSearchRequest } from '../types/search.types.js';

const MAX_RESULTS = 50;

/**
 * MCP Server for Matrix Booking System integration
 * Provides tools for room/desk availability checking and booking management
 */
export class MatrixBookingMCPServer {
  private server: Server;
  private availabilityService: AvailabilityService;
  private bookingService: BookingService;
  private locationService: LocationService;
  private organizationService: OrganizationService;
  private userService: UserService;
  private searchService: SearchService;
  private configManager: ConfigurationManager;

  constructor() {
    this.server = new Server(
      {
        name: 'matrix-booking-mcp-server',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize services
    this.configManager = new ConfigurationManager();
    const authManager = new AuthenticationManager(this.configManager);
    const apiClient = new MatrixAPIClient(authManager, this.configManager);

    this.availabilityService = new AvailabilityService(
      apiClient,
      this.configManager,
      authManager
    );

    this.locationService = new LocationService(
      apiClient,
      this.configManager,
      authManager
    );

    this.bookingService = new BookingService(
      apiClient,
      authManager,
      this.configManager,
      this.locationService
    );

    this.organizationService = new OrganizationService(
      apiClient,
      this.configManager,
      authManager
    );

    this.userService = new UserService(
      apiClient,
      authManager
    );

    this.searchService = new SearchService(
      this.locationService,
      this.availabilityService,
      apiClient,
      authManager,
      this.configManager
    );

    this.setupHandlers();
  }

  private toolCallCount = new Map<string, number>();
  private lastResetTime = Date.now();

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Reset counters every 5 minutes
      if (Date.now() - this.lastResetTime > 5 * 60 * 1000) {
        this.toolCallCount.clear();
        this.lastResetTime = Date.now();
      }

      // Circuit breaker for browse_locations
      if (name === 'browse_locations') {
        const count = this.toolCallCount.get(name) || 0;
        if (count >= 3) {
          return {
            content: [{
              type: 'text',
              text: '⚠️ Too many browse attempts (3+). Use search_bookings or quick_book_room instead for better performance.\n\nSuggested alternatives:\n• search_bookings - Find available rooms by capacity and time\n• quick_book_room - One-step booking for simple requests'
            }]
          };
        }
        this.toolCallCount.set(name, count + 1);
      }

      try {
        switch (name) {
          case 'check_availability':
            return await this.handleCheckAvailability(args || {});
          
          case 'create_booking':
            return await this.handleCreateBooking(args || {});
          
          case 'cancel_booking':
            return await this.handleCancelBooking(args || {});

          case 'get_user_bookings':
            return await this.handleGetUserBookings();
          
          case 'search_bookings':
            return await this.handleSearchBookings(args || {});

          case 'browse_locations':
            return await this.handleBrowseLocations(args || {});

          case 'search_by_facilities':
            return await this.handleSearchByFacilities(args || {});
          
          case 'find_location_by_requirements':
            return await this.handleFindLocationByRequirements(args || {});

          case 'quick_book_room':
            return await this.handleQuickBookRoom(args || {});

          case 'list_booking_types':
            return await this.handleListBookingTypes();

          case 'list_available_facilities':
            return await this.handleListAvailableFacilities();

          case 'find_location_by_name':
            return await this.handleFindLocationByName(args || {});

          default:
            return {
              content: [{
                type: 'text',
                text: `Unknown tool: ${name}`
              }],
              isError: true
            };
        }
      } catch (error) {
        return this.formatError(error, name);
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'check_availability',
        description: 'Check if a room or desk is available at a specific time. Returns available time slots.',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'number', description: 'ID of the location to check' },
            dateFrom: { type: 'string', description: 'Start date/time (ISO 8601)' },
            dateTo: { type: 'string', description: 'End date/time (ISO 8601)' },
            bookingCategory: { type: 'number', description: 'Category ID from list_booking_types' }
          },
          required: ['locationId', 'dateFrom', 'dateTo']
        }
      },
      {
        name: 'create_booking',
        description: 'Book a room or desk for a specific time period',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'number', description: 'ID of location to book (e.g. 1000001)' },
            timeFrom: { type: 'string', description: 'Start time in ISO 8601 format (e.g. 2025-01-06T08:00:00)' },
            timeTo: { type: 'string', description: 'End time in ISO 8601 format (e.g. 2025-01-06T08:15:00)' },
            description: { type: 'string', description: 'Booking description/purpose' }
          },
          required: ['locationId', 'timeFrom', 'timeTo']
        }
      },
      {
        name: 'cancel_booking',
        description: 'Cancel an existing booking',
        inputSchema: {
          type: 'object',
          properties: {
            bookingId: { type: 'number', description: 'ID of the booking to cancel' },
            reason: { type: 'string', description: 'Reason for cancellation' }
          },
          required: ['bookingId']
        }
      },
      {
        name: 'get_user_bookings',
        description: 'Get all bookings for the current user',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', description: 'Start date (ISO 8601)' },
            dateTo: { type: 'string', description: 'End date (ISO 8601)' },
            includeHistory: { type: 'boolean', description: 'Include past bookings' }
          }
        }
      },
      {
        name: 'search_bookings',
        description: '🎯 PRIMARY TOOL for finding available rooms. Use this FIRST before browsing. Searches for bookable locations by capacity and availability. Returns rooms sorted by best fit (smallest suitable room first). Much faster than browse_locations.',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { 
              type: 'string', 
              description: 'Start date (YYYY-MM-DD or ISO 8601) - Required' 
            },
            dateTo: { 
              type: 'string', 
              description: 'End date (YYYY-MM-DD or ISO 8601) - Required' 
            },
            locationId: { 
              type: 'number', 
              description: 'Filter by specific location/desk/room ID' 
            },
            userName: { 
              type: 'string', 
              description: 'Search for specific colleague by name (partial match)' 
            },
            userEmail: { 
              type: 'string', 
              description: 'Search for specific colleague by email' 
            },
            includeAllUsers: { 
              type: 'boolean', 
              description: 'Show all users bookings, not just your own (default: false)' 
            },
            locationKind: { 
              type: 'string', 
              enum: ['DESK', 'ROOM', 'DESK_BANK'],
              description: 'Filter by location type' 
            },
            includeLocationDetails: {
              type: 'boolean',
              description: 'Include detailed location information (default: false)'
            },
            includeFacilities: {
              type: 'boolean',
              description: 'Include facility information with locations (default: false)'
            },
            groupBy: {
              type: 'string',
              enum: ['user', 'location', 'date'],
              description: 'Group results by user, location, or date'
            }
          },
          required: ['dateFrom', 'dateTo']
        }
      },
      {
        name: 'browse_locations',
        description: '⚠️ SLOW - AVOID for booking flows. Only use for exploring location hierarchy when search_bookings and find_location_by_requirements fail. Requires multiple calls (3-7) to traverse hierarchy. Use search_bookings or quick_book_room instead.',
        inputSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'number', description: 'Parent location ID to browse under' },
            kind: { type: 'string', description: 'Filter by location type (BUILDING, FLOOR, ROOM, DESK)' }
          }
        }
      },
      {
        name: 'search_by_facilities',
        description: '[DEPRECATED - Use find_location_by_requirements instead] Find rooms or desks with specific amenities/features',
        inputSchema: {
          type: 'object',
          properties: {
            facilities: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'List of required facilities (use list_available_facilities to see options)' 
            },
            dateFrom: { type: 'string', description: 'When needed from (ISO 8601)' },
            dateTo: { type: 'string', description: 'When needed until (ISO 8601)' },
            capacity: { type: 'number', description: 'Minimum capacity needed' }
          },
          required: ['facilities']
        }
      },
      {
        name: 'find_location_by_requirements',
        description: '🔧 Advanced search for locations by facilities, capacity, and availability. Automatically optimizes for smallest suitable room. Returns top 3 best-fit options. If this fails, use search_bookings as fallback.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Natural language query (e.g., "desk with adjustable desk for tomorrow 8am-5pm")' 
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific facility requirements (e.g., ["adjustable desk", "27 inch screen"])'
            },
            capacity: { 
              type: 'number', 
              description: 'Minimum capacity/number of people' 
            },
            locationKind: { 
              type: 'string', 
              description: 'Type of location (ROOM, DESK, etc.)' 
            },
            dateFrom: { 
              type: 'string', 
              description: 'Start date/time in ISO format' 
            },
            dateTo: { 
              type: 'string', 
              description: 'End date/time in ISO format' 
            },
            limit: { 
              type: 'number', 
              description: 'Maximum results to return (default: 10)' 
            }
          }
        }
      },
      {
        name: 'quick_book_room',
        description: '🚀 ONE-STEP BOOKING - Best for simple requests like "book a room for 2 people". Automatically finds the best-fit available room and books it. Prevents oversized bookings (won\'t book 16-person room for 1 person).',
        inputSchema: {
          type: 'object',
          properties: {
            capacity: { 
              type: 'number', 
              description: 'Number of people (required)' 
            },
            dateFrom: { 
              type: 'string', 
              description: 'Start time in ISO 8601 format (required)' 
            },
            dateTo: { 
              type: 'string', 
              description: 'End time in ISO 8601 format (required)' 
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional facilities needed (e.g., ["screen", "whiteboard"])'
            },
            description: {
              type: 'string',
              description: 'Booking purpose/description (default: "Quick booking")'
            },
            autoConfirm: {
              type: 'boolean',
              description: 'Auto-confirm the booking (default: true)'
            }
          },
          required: ['capacity', 'dateFrom', 'dateTo']
        }
      },
      {
        name: 'list_booking_types',
        description: 'Get all types of bookable spaces (meeting rooms, desks, etc.) to understand what can be booked',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'list_available_facilities',
        description: 'Get all available amenities and features that can be searched for (projectors, whiteboards, etc.)',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'find_location_by_name',
        description: 'Find a specific room or desk by its name (e.g., "Desk-A1" for a desk, "Meeting Room 1" for a room)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the location to find (e.g., "Desk-A1", "Meeting Room 1")' },
            buildingHint: { type: 'string', description: 'Optional building name hint (e.g., "Main Building", "Building A")' },
            searchType: { type: 'string', description: 'Type to search for: "desk", "room", or "any" (default: "any")' }
          },
          required: ['name']
        }
      }
    ];
  }

  private async handleCheckAvailability(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const request = {
        dateFrom: args['dateFrom'] as string,
        dateTo: args['dateTo'] as string,
        locationId: args['locationId'] as number,
        bookingCategory: (args['bookingCategory'] as number) || 9000001 // Default to desk category
      };

      const result = await this.availabilityService.checkAvailability(request);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in check_availability: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleCreateBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const locationId = args['locationId'] as number;
      const timeFrom = args['timeFrom'] as string;
      const timeTo = args['timeTo'] as string;
      // API expects 'label' field, not 'description'
      const description = (args['description'] as string) || 'Meeting room booking';

      // Get current user to set as owner
      const currentUser = await this.userService.getCurrentUser();
      
      const bookingRequest = {
        locationId,
        timeFrom,
        timeTo,
        label: description, // Use 'label' as the API expects
        attendees: [],
        extraRequests: [],
        owner: {
          id: currentUser.personId, // Use personId, not id
          name: currentUser.name,
          email: currentUser.email
        },
        ownerIsAttendee: true,
        source: 'matrix-booking-mcp'
      };
      
      const result = await this.bookingService.createBooking(bookingRequest);
      
      return {
        content: [{
          type: 'text',
          text: `Booking created successfully!\nID: ${result.id}\nLocation ID: ${result.locationId}\nTime: ${result.timeFrom} - ${result.timeTo}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in create_booking: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleCancelBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const request = {
        bookingId: args['bookingId'] as number,
        reason: args['reason'] as string
      };

      await this.bookingService.cancelBooking(request);
      
      return {
        content: [{
          type: 'text',
          text: `Booking ${request.bookingId} cancelled successfully`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in cancel_booking: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleGetUserBookings(): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const bookings = await this.userService.getUserBookings({});

      const limited = bookings.bookings.slice(0, MAX_RESULTS);
      
      // Fetch location details for bookings that don't have locationName
      const bookingsWithNames = await Promise.all(limited.map(async (b) => {
        let locationName = b.locationName;
        
        // If locationName is not provided, try to fetch it
        if (!locationName && b.locationId) {
          try {
            const location = await this.locationService.getLocation(b.locationId);
            locationName = location.qualifiedName || location.name || `Location ${b.locationId}`;
          } catch {
            // If fetch fails, use fallback
            locationName = `Location ${b.locationId}`;
          }
        }
        
        return {
          ...b,
          displayName: locationName || `Location ${b.locationId}`
        };
      }));
      
      const text = bookingsWithNames.map(b => 
        `• ${b.displayName} - ${new Date(b.timeFrom).toLocaleString()} to ${new Date(b.timeTo).toLocaleString()}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Your bookings (showing ${limited.length} of ${bookings.bookings.length}):\n${text}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in get_user_bookings: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleSearchBookings(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      // Build search request from arguments
      const searchRequest: IBookingSearchRequest = {
        dateFrom: args['dateFrom'] as string,
        dateTo: args['dateTo'] as string
      };
      
      // Add optional fields only if they exist
      if (args['locationId'] !== undefined) {
        searchRequest.locationId = args['locationId'] as number;
      }
      if (args['userName'] !== undefined) {
        searchRequest.userName = args['userName'] as string;
      }
      if (args['userEmail'] !== undefined) {
        searchRequest.userEmail = args['userEmail'] as string;
      }
      if (args['includeAllUsers'] !== undefined) {
        searchRequest.includeAllUsers = args['includeAllUsers'] as boolean;
      }
      if (args['locationKind'] !== undefined) {
        searchRequest.locationKind = args['locationKind'] as 'DESK' | 'ROOM' | 'DESK_BANK';
      }
      if (args['includeLocationDetails'] !== undefined) {
        searchRequest.includeLocationDetails = args['includeLocationDetails'] as boolean;
      }
      if (args['includeFacilities'] !== undefined) {
        searchRequest.includeFacilities = args['includeFacilities'] as boolean;
      }
      if (args['groupBy'] !== undefined) {
        searchRequest.groupBy = args['groupBy'] as 'user' | 'location' | 'date';
      }
      
      // Call the booking service search method
      const searchResults = await this.bookingService.searchBookings(searchRequest);
      
      // Format the response based on grouping
      let text = '';
      
      if (searchRequest.groupBy && searchResults.groupedResults) {
        // Format grouped results
        const groups = Object.entries(searchResults.groupedResults);
        for (const [groupName, bookings] of groups) {
          text += `\n📍 ${groupName} (${bookings.length} bookings):\n`;
          for (const booking of bookings) {
            const timeFrom = new Date(booking.timeFrom).toLocaleString();
            const timeTo = new Date(booking.timeTo).toLocaleString();
            const location = booking.location?.qualifiedName || booking.locationName || `Location ${booking.locationId}`;
            const owner = booking.owner?.name || booking.owner?.email || 'Unknown';
            
            if (searchRequest.includeAllUsers) {
              text += `  • ${owner} - ${location}\n    ${timeFrom} to ${timeTo}\n`;
            } else {
              text += `  • ${location} - ${timeFrom} to ${timeTo}\n`;
            }
            
            if (searchRequest.includeFacilities && booking.location?.facilities) {
              const facilities = booking.location.facilities.map(f => f.text || f.name).join(', ');
              if (facilities) {
                text += `    Facilities: ${facilities}\n`;
              }
            }
          }
        }
      } else {
        // Format flat results
        text = searchResults.bookings.map(booking => {
          const timeFrom = new Date(booking.timeFrom).toLocaleString();
          const timeTo = new Date(booking.timeTo).toLocaleString();
          const location = booking.location?.qualifiedName || booking.locationName || `Location ${booking.locationId}`;
          const owner = booking.owner?.name || booking.owner?.email || 'Unknown';
          
          let line = '• ';
          if (searchRequest.includeAllUsers) {
            line += `${owner} - `;
          }
          line += `${location} - ${timeFrom} to ${timeTo}`;
          
          if (searchRequest.includeFacilities && booking.location?.facilities) {
            const facilities = booking.location.facilities.map(f => f.text || f.name).join(', ');
            if (facilities) {
              line += `\n  Facilities: ${facilities}`;
            }
          }
          
          return line;
        }).join('\n');
      }
      
      // Add summary
      const summary = `\n\n📊 Summary: ${searchResults.summary.totalBookings} bookings, ${searchResults.summary.uniqueUsers} unique users, ${searchResults.summary.uniqueLocations} locations`;
      
      return {
        content: [{
          type: 'text',
          text: `Booking Search Results (${searchResults.summary.dateRange.from} to ${searchResults.summary.dateRange.to}):\n${text}${summary}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching bookings: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
  
  private async handleBrowseLocations(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const parentId = args['parentId'] as number | undefined;
      const kind = args['kind'] as string | undefined;

      const hierarchy = await this.locationService.getLocationHierarchy({
        includeChildren: true,
        includeFacilities: true
      });

      let locations = hierarchy.locations || [];
      
      // If parentId provided, find and return its children
      if (parentId) {
        const findChildren = (locs: ILocation[]): ILocation[] => {
          for (const loc of locs) {
            if (loc.id === parentId) {
              return loc.locations || [];
            }
            if (loc.locations) {
              const children = findChildren(loc.locations);
              if (children.length > 0) return children;
            }
          }
          return [];
        };
        
        locations = findChildren(locations);
        
        if (locations.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No child locations found for parent ID ${parentId}`
            }]
          };
        }
      }
      
      // Filter by kind if specified
      if (kind) {
        locations = locations.filter(loc => loc.kind === kind);
      }

      const limited = locations.slice(0, MAX_RESULTS);
      const text = limited.map(loc => {
        const details = [];
        if (loc.id) details.push(`[${loc.id}]`);
        if (loc.name) details.push(loc.name);
        if (loc.kind) details.push(`(${loc.kind})`);
        if (loc.qualifiedName && loc.qualifiedName !== loc.name) {
          details.push(`- ${loc.qualifiedName}`);
        }
        return `• ${details.join(' ')}`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `${parentId ? `Child locations of ${parentId}` : 'Locations'} (showing ${limited.length} of ${locations.length}):\n${text}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error browsing locations: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleSearchByFacilities(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const facilities = args['facilities'] as string[];
      const dateFrom = args['dateFrom'] as string;
      const dateTo = args['dateTo'] as string;

      // Get locations with facilities
      const hierarchy = await this.locationService.getLocationHierarchy({
        includeFacilities: true,
        includeChildren: true
      });

      // Filter by facilities
      const locations = hierarchy.locations || [];
      const matching = locations.filter(loc => {
      if (!loc.facilities) return false;
      return facilities.every(required => 
        loc.facilities?.some(f => f.name.toLowerCase().includes(required.toLowerCase()))
      );
    });

    // Check availability if dates provided
    let available = matching;
    if (dateFrom && dateTo) {
      available = [];
      for (const loc of matching.slice(0, 10)) { // Check first 10 to avoid timeout
        try {
          const avail = await this.availabilityService.checkAvailability({
            locationId: loc.id,
            dateFrom,
            dateTo,
            bookingCategory: 9000001 // Desk category
          });
          if (avail.available && Array.isArray(avail.available) && avail.available.length > 0) {
            available.push(loc);
          }
        } catch {
          // Skip if availability check fails
        }
      }
    }

    const limited = available.slice(0, MAX_RESULTS);
    const text = limited.map(loc => 
      `• [${loc.id}] ${loc.name} - ${loc.facilities?.map(f => f.name).join(', ')}`
    ).join('\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${available.length} locations with required facilities (showing ${limited.length}):\n${text}`
      }]
    };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching facilities: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async handleFindLocationByRequirements(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const request: ILocationSearchRequest = {};
      
      // Only add properties if they're defined
      if (args['query']) request.query = args['query'] as string;
      if (args['requirements']) request.requirements = args['requirements'] as string[];
      if (args['capacity']) request.capacity = args['capacity'] as number;
      if (args['locationKind']) request.locationKind = args['locationKind'] as string;
      if (args['dateFrom']) request.dateFrom = args['dateFrom'] as string;
      if (args['dateTo']) request.dateTo = args['dateTo'] as string;
      if (args['limit']) request.limit = args['limit'] as number;
      
      // Use preferred location if no parent specified
      if (!args['parentLocationId']) {
        const preferredLocationId = parseInt(this.configManager.getConfig().matrixPreferredLocation, 10);
        if (!isNaN(preferredLocationId)) {
          request.parentLocationId = preferredLocationId;
        }
      }

      // Use the search service
      const searchResults = await this.searchService.searchLocationsByRequirements(request);

      if (searchResults.results.length === 0) {
        // Provide fallback strategy when no results found
        return {
          content: [{
            type: 'text',
            text: '⚠️ No locations found matching your requirements.\n\nFallback strategy:\n• Try search_bookings with just capacity and date parameters\n• Or use quick_book_room for automatic booking\n• Consider removing some facility requirements'
          }]
        };
      }

      // Format results
      const text = searchResults.results.map(result => {
        const lines = [`• [${result.location.id}] ${result.location.qualifiedName || result.location.name}`];
        
        // Add match details
        if (result.matchDetails.length > 0) {
          lines.push(`  ${result.matchDetails.join('\n  ')}`);
        }
        
        // Add availability info
        if (result.availability) {
          if (result.availability.isAvailable) {
            lines.push(`  ✓ Available at requested time`);
          } else {
            lines.push(`  ✗ Not available at requested time`);
          }
        }
        
        // Add facility info summary
        if (result.facilityInfo && result.facilityInfo.matchedFacilities.length > 0) {
          lines.push(`  Matched: ${result.facilityInfo.matchedFacilities.join(', ')}`);
        }
        
        return lines.join('\n');
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${searchResults.totalMatches} matching locations (showing ${searchResults.results.length}):\n\n${text}\n\nSearch completed in ${searchResults.metadata.searchTime}ms`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching locations: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleQuickBookRoom(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const capacity = args['capacity'] as number;
      const dateFrom = args['dateFrom'] as string;
      const dateTo = args['dateTo'] as string;
      const requirements = (args['requirements'] as string[]) || [];
      const description = (args['description'] as string) || 'Quick booking';
      const autoConfirm = (args['autoConfirm'] as boolean) !== false;
      

      // Step 1: Find best-fit room using search service
      // Use preferred location from config if no location specified
      const preferredLocationId = parseInt(this.configManager.getConfig().matrixPreferredLocation, 10);
      
      const searchRequest: ILocationSearchRequest = {
        capacity,
        dateFrom,
        dateTo,
        locationKind: 'ROOM', // This now filters for ZONE/DESK_BANK (bookable spaces)
        requirements,
        parentLocationId: preferredLocationId, // Search within preferred location
        limit: 10 // Get more matches to find available ones
      };

      const searchResults = await this.searchService.searchLocationsByRequirements(searchRequest);
      

      if (searchResults.results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `❌ No available rooms found for ${capacity} people from ${new Date(dateFrom).toLocaleString()} to ${new Date(dateTo).toLocaleString()}.\n\nTry:\n• Different time slot\n• Smaller capacity\n• Removing facility requirements`
          }]
        };
      }
      

      // Find first available room
      const availableRoom = searchResults.results.find(r => 
        r.availability?.isAvailable !== false
      );

      if (!availableRoom) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ Found ${searchResults.results.length} rooms but none are available at the requested time.\n\nTop matches (currently unavailable):\n${searchResults.results.slice(0, 3).map(r => 
              `• ${r.location.name} (capacity: ${r.location.capacity})`
            ).join('\\n')}`
          }]
        };
      }

      // Step 2: Create booking if autoConfirm is true
      if (autoConfirm) {
        try {
          // Format the booking request with defaults
          const bookingRequest = await this.bookingService.formatBookingRequest({
            locationId: availableRoom.location.id,
            timeFrom: dateFrom,
            timeTo: dateTo,
            description
          });
          
          const booking = await this.bookingService.createBooking(bookingRequest);

          return {
            content: [{
              type: 'text',
              text: `✅ Successfully booked!\n\n📍 Room: ${availableRoom.location.qualifiedName || availableRoom.location.name}\n👥 Capacity: ${availableRoom.location.capacity} people\n📅 Time: ${new Date(dateFrom).toLocaleString()} - ${new Date(dateTo).toLocaleString()}\n🎫 Booking ID: ${booking.id}\n\n${availableRoom.matchDetails.join('\\n')}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `⚠️ Found perfect room but booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRoom details:\n• ${availableRoom.location.name} (capacity: ${availableRoom.location.capacity})`
            }]
          };
        }
      } else {
        // Return room details without booking
        return {
          content: [{
            type: 'text',
            text: `Found best-fit room:\n\n📍 ${availableRoom.location.qualifiedName || availableRoom.location.name}\n👥 Capacity: ${availableRoom.location.capacity} people\n✅ Available at requested time\n\n${availableRoom.matchDetails.join('\\n')}\n\nTo book, use create_booking with locationId: ${availableRoom.location.id}`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error in quick booking: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleListBookingTypes(): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const user = await this.userService.getCurrentUser();
    const categories = await this.organizationService.getBookingCategories(user.organisationId);

    const text = categories.map(cat => 
      `• [${cat.id}] ${cat.name} - ${cat.description}`
    ).join('\n');

    return {
      content: [{
        type: 'text',
        text: `Available booking types:\n${text}`
      }]
    };
  }

  private async handleListAvailableFacilities(): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const hierarchy = await this.locationService.getLocationHierarchy({
        includeFacilities: true,
        includeChildren: true
      });

      // Use the facility parser to extract unique facilities
      const parser = new FacilityParser();
      const uniqueFacilities = parser.extractUniqueFacilities(hierarchy.locations || []);
      
      const limited = uniqueFacilities.slice(0, MAX_RESULTS);
      const text = limited.length > 0 
        ? limited.map(f => `• ${f}`).join('\n')
        : 'No facilities found';

      return {
        content: [{
          type: 'text',
          text: `Available facilities to search for (${uniqueFacilities.length} types):\n${text}\n\nUse find_location_by_requirements to search for locations with these facilities`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing facilities: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Parse location search term and identify its type based on patterns
   * @param name Raw search term from user
   * @returns Parsed term with type indicators
   */
  private parseLocationSearchTerm(name: string): {
    searchTerm: string;
    isRoom: boolean;
    isDesk: boolean;
    isDeskBank: boolean;
    patterns: { roomPattern: RegExp; deskPattern: RegExp; deskBankPattern: RegExp };
  } {
    const searchTerm = name.trim().replace(/^(room|desk)\s+/i, '').trim();
    
    // Pattern recognition for different location types
    const roomPattern = /^(\d{3,4})$/;  // 3-4 digit room numbers like 701, 711
    const deskPattern = /^(\d{1,2})-([A-Z])$/i;  // Desk IDs like 37-A, 37-D
    const deskBankPattern = /^(\d{1,2})$/;  // 1-2 digit desk bank numbers
    
    return {
      searchTerm,
      isRoom: roomPattern.test(searchTerm),
      isDesk: deskPattern.test(searchTerm),
      isDeskBank: deskBankPattern.test(searchTerm),
      patterns: { roomPattern, deskPattern, deskBankPattern }
    };
  }

  /**
   * Determine the appropriate Matrix API search kind based on term and type
   * @param searchTerm Cleaned search term
   * @param searchType User-specified type (room/desk/any)
   * @returns Search kind and type flags
   */
  private determineSearchKind(searchTerm: string, searchType: string): {
    kind: string | undefined;
    isRoom: boolean;
    isDesk: boolean;
  } {
    const { isRoom, isDesk, isDeskBank } = this.parseLocationSearchTerm(searchTerm);
    
    if (searchType === 'room' || isRoom) {
      return { kind: 'ROOM', isRoom: true, isDesk: false };
    } else if (searchType === 'desk' || isDesk) {
      return { kind: 'DESK', isRoom: false, isDesk: true };
    } else if (isDeskBank && searchType !== 'room') {
      return { kind: 'DESK_BANK', isRoom: false, isDesk: false };
    } else if (searchType === 'any') {
      return { kind: 'ROOM,DESK', isRoom: false, isDesk: false };
    }
    return { kind: undefined, isRoom: false, isDesk: false };
  }

  /**
   * Match locations against search term with exact and partial matching
   * @param locations List of locations from API
   * @param searchTerm Term to search for
   * @param isDesk Whether searching for desks specifically
   * @returns Categorized matches
   */
  private matchLocations(locations: ILocation[], searchTerm: string, isDesk: boolean): {
    exactMatches: ILocation[];
    partialMatches: ILocation[];
  } {
    const exactMatches: ILocation[] = [];
    const partialMatches: ILocation[] = [];
    const { patterns } = this.parseLocationSearchTerm(searchTerm);
    
    for (const location of locations) {
      const locationName = location.name || '';
      
      // Check for exact match (case-insensitive)
      if (locationName.toLowerCase() === searchTerm.toLowerCase()) {
        exactMatches.push(location);
      }
      // Check for partial match
      else if (locationName.toLowerCase().includes(searchTerm.toLowerCase())) {
        partialMatches.push(location);
      }
      // For desk searches, also check if it matches the pattern
      else if (isDesk && patterns.deskPattern.test(locationName)) {
        const searchMatch = searchTerm.match(patterns.deskPattern);
        const locationMatch = locationName.match(patterns.deskPattern);
        if (searchMatch && locationMatch && 
            searchMatch[1] === locationMatch[1] && 
            searchMatch[2] && locationMatch[2] &&
            searchMatch[2].toUpperCase() === locationMatch[2].toUpperCase()) {
          exactMatches.push(location);
        }
      }
    }
    
    return { exactMatches, partialMatches };
  }

  private async handleFindLocationByName(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const name = args['name'] as string;
      const buildingHint = args['buildingHint'] as string | undefined;
      const searchType = (args['searchType'] as string) || 'any';

      if (!name) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Location name is required'
          }]
        };
      }

      // Parse and analyze the search term
      const { searchTerm } = this.parseLocationSearchTerm(name);
      
      // Determine the search kind based on pattern and type
      const { kind: searchKind, isRoom, isDesk } = this.determineSearchKind(searchTerm, searchType);

      // Get preferred location from config
      const config = this.configManager.getConfig();
      const preferredLocationId = parseInt(config.matrixPreferredLocation, 10);
      
      // Use preferred location or search globally
      let searchLocationId = preferredLocationId;
      
      // If building hint provided, try to resolve it first
      if (buildingHint) {
        // For now, use preferred location
        // In future, could search for building by name
        searchLocationId = preferredLocationId;
      }

      // Build optimized query for the Matrix API
      const queryRequest: ILocationQueryRequest = {
        locationId: searchLocationId,
        includeChildren: false,  // Don't need nested data for search
        includeFacilities: false
      };
      
      // Only add kind if it's defined
      if (searchKind) {
        queryRequest.kind = searchKind;
      }
      
      // Make single API call with targeted parameters
      const hierarchy = await this.locationService.getLocationHierarchy(queryRequest);

      // Find exact matches first, then partial matches
      const locations = hierarchy.locations || [];
      const { exactMatches, partialMatches } = this.matchLocations(locations, searchTerm, isDesk);

      // Combine matches, preferring exact over partial
      const matches = [...exactMatches, ...partialMatches];

      if (matches.length === 0) {
        // Provide helpful message based on what was searched
        let helpText = `No locations found matching "${name}"`;
        if (buildingHint) helpText += ` in ${buildingHint}`;
        
        if (isRoom) {
          helpText += '. Room might not exist or try different floor/building.';
        } else if (isDesk) {
          helpText += '. Desk might not exist or try the desk bank number (e.g., "37" instead of "37-A").';
        } else {
          helpText += '. Try browse_locations to see available options.';
        }
        
        return {
          content: [{
            type: 'text',
            text: helpText
          }]
        };
      }

      // If single exact match, return it directly with clear booking instruction
      if (exactMatches.length === 1) {
        const location = exactMatches[0];
        return {
          content: [{
            type: 'text',
            text: `✅ Found: ${location?.name || 'Unknown'} (${location?.kind || 'Unknown'})\nLocation ID: ${location?.id || 'Unknown'}\n${location?.qualifiedName ? `Full path: ${location.qualifiedName}\n` : ''}Ready to book with ID: ${location?.id || 'Unknown'}`
          }]
        };
      }

      // Format multiple results
      const limited = matches.slice(0, 10);
      const text = limited.map((loc, idx) => {
        const marker = idx < exactMatches.length ? '✓' : '≈';
        return `${marker} [${loc.id}] ${loc.name} (${loc.kind || 'Unknown'})${loc.qualifiedName ? ` - ${loc.qualifiedName}` : ''}`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${matches.length} location(s) matching "${name}"${buildingHint ? ` in ${buildingHint}` : ''}:\n${text}\n\nUse the ID in square brackets for booking.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching for location: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private formatError(error: unknown, tool: string): { content: Array<{ type: string; text: string }>; isError: boolean } {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      content: [{
        type: 'text',
        text: `Error in ${tool}: ${message}`
      }],
      isError: true
    };
  }

  /**
   * Start the MCP server and listen for connections
   */
  async run(): Promise<void> {
    const transport = await this.createTransport();
    await this.server.connect(transport as unknown as Parameters<typeof this.server.connect>[0]);
  }

  private async createTransport(): Promise<unknown> {
    const StdioServerTransport = (await import('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport;
    return new StdioServerTransport();
  }
}