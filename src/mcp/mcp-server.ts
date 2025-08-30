import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigurationManager } from '../config/index.js';
import { AuthenticationManager } from '../auth/index.js';
import { MatrixAPIClient } from '../api/index.js';
import { AvailabilityService } from '../services/availability-service.js';
import { BookingService } from '../services/booking-service.js';
import { LocationService } from '../services/location-service.js';
import { OrganizationService } from '../services/organization-service.js';
import { UserService } from '../services/user-service.js';
import { IFacility } from '../types/facility.types.js';
import { ILocation, ILocationQueryRequest } from '../types/location.types.js';

const MAX_RESULTS = 50;

export class MatrixBookingMCPServer {
  private server: Server;
  private availabilityService: AvailabilityService;
  private bookingService: BookingService;
  private locationService: LocationService;
  private organizationService: OrganizationService;
  private userService: UserService;
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

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

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

          case 'browse_locations':
            return await this.handleBrowseLocations(args || {});

          case 'search_by_facilities':
            return await this.handleSearchByFacilities(args || {});

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
        name: 'browse_locations',
        description: 'Browse the hierarchy of buildings, floors, rooms and desks',
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
        description: 'Find rooms or desks with specific amenities/features',
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

      // Extract unique facilities
      const facilityMap = new Map<string, IFacility>();
      const locations = hierarchy.locations || [];
      
      for (const location of locations) {
        if (location.facilities) {
          for (const facility of location.facilities) {
            if (!facilityMap.has(facility.name)) {
              facilityMap.set(facility.name, facility);
            }
          }
        }
      }

      const facilities = Array.from(facilityMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_RESULTS);

      const text = facilities.length > 0 
        ? facilities.map(f => `• ${f.name}`).join('\n')
        : 'No facilities found';

      return {
        content: [{
          type: 'text',
          text: `Available facilities to search for (${facilities.length} types):\n${text}`
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

      // Clean up the search term
      const searchTerm = name.trim().replace(/^(room|desk)\s+/i, '').trim();
      
      // Pattern recognition for different location types
      const roomPattern = /^(\d{3,4})$/;  // 3-4 digit room numbers like 701, 711
      const deskPattern = /^(\d{1,2})-([A-Z])$/i;  // Desk IDs like 37-A, 37-D
      const deskBankPattern = /^(\d{1,2})$/;  // 1-2 digit desk bank numbers
      
      // Determine search kind based on pattern or explicit type
      let searchKind: string | undefined;
      let isRoom = false;
      let isDesk = false;
      
      if (searchType === 'room' || roomPattern.test(searchTerm)) {
        searchKind = 'ROOM';
        isRoom = true;
      } else if (searchType === 'desk' || deskPattern.test(searchTerm)) {
        searchKind = 'DESK';
        isDesk = true;
      } else if (deskBankPattern.test(searchTerm) && searchType !== 'room') {
        searchKind = 'DESK_BANK';
      } else if (searchType === 'any') {
        // For 'any' type, search both rooms and desks
        searchKind = 'ROOM,DESK';
      }

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
      const exactMatches: ILocation[] = [];
      const partialMatches: ILocation[] = [];
      
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
        else if (isDesk && deskPattern.test(locationName)) {
          const searchMatch = searchTerm.match(deskPattern);
          const locationMatch = locationName.match(deskPattern);
          if (searchMatch && locationMatch && 
              searchMatch[1] === locationMatch[1] && 
              searchMatch[2] && locationMatch[2] &&
              searchMatch[2].toUpperCase() === locationMatch[2].toUpperCase()) {
            exactMatches.push(location);
          }
        }
      }

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

  async run(): Promise<void> {
    const transport = await this.createTransport();
    await this.server.connect(transport as unknown as Parameters<typeof this.server.connect>[0]);
  }

  private async createTransport(): Promise<unknown> {
    const StdioServerTransport = (await import('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport;
    return new StdioServerTransport();
  }
}