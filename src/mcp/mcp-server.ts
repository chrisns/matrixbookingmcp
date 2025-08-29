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
import { SearchService } from '../services/search-service.js';
import { ISearchQuery } from '../types/search.types.js';
import { IUserBookingsRequest } from '../types/user.types.js';
import { IFacility } from '../types/facility.types.js';

// Enhanced MCP Error Response Interfaces
interface MCPErrorSuggestion {
  action: string;
  tool: string;
  description: string;
  parameters?: Record<string, unknown>;
}

interface MCPErrorContext {
  httpStatus?: number;
  errorCode?: string;
  errorType?: string;
  suggestions: MCPErrorSuggestion[];
  relatedWorkflows?: string[];
  troubleshooting?: {
    commonCauses: string[];
    diagnosticSteps: string[];
  };
}

interface EnhancedMCPErrorResponse {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
  errorContext?: MCPErrorContext;
}

export class MatrixBookingMCPServer {
  private server: Server;
  private availabilityService: AvailabilityService;
  private bookingService: BookingService;
  private locationService: LocationService;
  private organizationService: OrganizationService;
  private userService: UserService;
  private searchService: SearchService;

  constructor() {
    this.server = new Server(
      {
        name: 'matrix-booking-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize services
    const configManager = new ConfigurationManager();
    const authManager = new AuthenticationManager(configManager);
    const apiClient = new MatrixAPIClient(authManager, configManager);

    this.availabilityService = new AvailabilityService(
      apiClient,
      configManager,
      authManager
    );

    this.locationService = new LocationService(
      apiClient,
      configManager,
      authManager
    );

    this.bookingService = new BookingService(
      apiClient,
      authManager,
      configManager,
      this.locationService
    );

    this.organizationService = new OrganizationService(
      apiClient,
      configManager,
      authManager
    );

    this.userService = new UserService(
      apiClient,
      configManager,
      authManager
    );


    this.searchService = new SearchService(
      this.organizationService,
      this.locationService,
      this.availabilityService
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
          case 'matrix_booking_check_availability':
            return await this.handleCheckAvailability(args || {});
          
          case 'matrix_booking_create_booking':
            return await this.handleCreateBooking(args || {});
          
          case 'matrix_booking_get_location':
            return await this.handleGetLocation(args || {});

          case 'get_current_user':
            return await this.handleGetCurrentUser(args || {});

          case 'get_booking_categories':
            return await this.handleGetBookingCategories(args || {});

          case 'get_locations':
            return await this.handleGetLocations(args || {});

          case 'discover_available_facilities':
            return await this.handleDiscoverAvailableFacilities(args || {});

          case 'find_rooms_with_facilities':
            return await this.handleFindRoomsWithFacilities(args || {});

          case 'get_user_bookings':
            return await this.handleGetUserBookings(args || {});

          case 'health_check':
            return await this.handleHealthCheck(args || {});
          
          case 'matrix_booking_cancel_booking':
            return await this.handleCancelBooking(args || {});

          case 'get_tool_guidance':
            return await this.handleGetToolGuidance(args || {});
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`MCP Server error for tool ${name}:`, error);
        
        // Use enhanced error handling for unknown tools
        return this.formatEnhancedError(error, name, 'unknown');
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'matrix_booking_check_availability',
        description: 'Check room and space availability for a specific date range and location. Use this tool to find available meeting rooms, desks, or other bookable spaces.\n\nCommon Use Cases:\n- "Are there any meeting rooms available at 2pm tomorrow?"\n- "What spaces are free Friday morning from 9-11 AM?"\n- "Check if Conference Room A is available next week"\n- "Show me all available desks for the afternoon"\n- "Find rooms available for a 2-hour meeting"\n\nNot For:\n- Retrieving existing bookings or reservations (use get_user_bookings)\n- Getting your personal calendar or schedule (use get_user_bookings)\n- Creating new bookings (use matrix_booking_create_booking)\n- Getting location details without availability (use matrix_booking_get_location)\n\nWorkflow Position: Step 1 of booking creation workflow - Use this tool first to identify available spaces before creating bookings\n\nRelated Tools:\n- matrix_booking_create_booking: Next step - Create booking after finding availability\n- find_rooms_with_facilities: Alternative - Search with specific facility requirements\n- get_user_bookings: Prerequisite check - Verify no conflicts with existing schedule\n- matrix_booking_get_location: Support tool - Get location details for found spaces',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: {
              type: 'string',
              description: 'Start date and time in ISO 8601 format (e.g., 2024-01-15T09:00:00.000Z). Defaults to current date.'
            },
            dateTo: {
              type: 'string',
              description: 'End date and time in ISO 8601 format (e.g., 2024-01-15T17:00:00.000Z). Defaults to end of current day.'
            },
            locationId: {
              type: 'number',
              description: 'The Matrix location ID to check. Defaults to configured preferred location.'
            },
            locationName: {
              type: 'string',
              description: 'Location name or room number to check (e.g., "Room 701", "Conference Room A"). Alternative to locationId. Searches within preferred building first, then organization-wide.'
            },
            duration: {
              type: 'number',
              description: 'Optional minimum duration in minutes for availability slots'
            }
          }
        }
      },
      {
        name: 'matrix_booking_create_booking',
        description: 'Create a new room or desk booking in the Matrix system. Use this tool to reserve meeting rooms, desks, or other bookable spaces after checking availability.\n\nCommon Use Cases:\n- "Book Conference Room B for tomorrow 2-4 PM"\n- "Reserve a desk for the whole day Friday"\n- "Create a team meeting reservation with 5 attendees"\n- "Schedule a private call booth for 30 minutes"\n- "Book room 701 for weekly standup meeting"\n\nNot For:\n- Checking room availability first (use matrix_booking_check_availability)\n- Viewing existing bookings (use get_user_bookings)\n- Getting location information (use matrix_booking_get_location)\n- Modifying existing bookings (contact administrator)\n\nWorkflow Position: Step 2 of booking creation workflow - Final step to confirm reservation after availability check\n\nRelated Tools:\n- matrix_booking_check_availability: Prerequisite - Check availability before booking\n- find_rooms_with_facilities: Alternative prerequisite - Find suitable spaces with requirements\n- get_user_bookings: Follow-up - Verify booking appears in your schedule\n- matrix_booking_get_location: Support tool - Get location ID if using location name',
        inputSchema: {
          type: 'object',
          properties: {
            timeFrom: {
              type: 'string',
              description: 'Start time in ISO 8601 format (e.g., 2024-01-15T09:00:00.000). Defaults to 9 AM today.'
            },
            timeTo: {
              type: 'string',
              description: 'End time in ISO 8601 format (e.g., 2024-01-15T10:00:00.000). Defaults to 10 AM today.'
            },
            locationId: {
              type: 'number',
              description: 'The Matrix location ID for booking (≥100000). Defaults to configured preferred location if neither locationId nor locationName provided.'
            },
            locationName: {
              type: 'string',
              description: 'Location name or room number for booking (e.g., "Room 701", "Conference Room A"). Searches within preferred building first, then organization-wide. Alternative to locationId.'
            },
            attendees: {
              type: 'array',
              description: 'Array of attendee objects with name and email',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' }
                },
                required: ['name', 'email']
              },
              default: []
            },
            extraRequests: {
              type: 'array',
              description: 'Array of additional requests or requirements',
              items: { type: 'string' },
              default: []
            },
            owner: {
              type: 'object',
              description: 'Booking owner details',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            },
            ownerIsAttendee: {
              type: 'boolean',
              description: 'Whether the owner should be included as an attendee',
              default: true
            },
            source: {
              type: 'string',
              description: 'Source identifier for the booking',
              default: 'matrix-booking-mcp'
            }
          }
        }
      },
      {
        name: 'matrix_booking_get_location',
        description: 'Get detailed information about a specific location, including facilities, capacity, and booking requirements. Use this tool to understand location capabilities and constraints.\\n\\nCommon Use Cases:\\n- "What facilities does Conference Room A have?"\\n- "Get details about the 5th floor meeting rooms"\\n- "What\'s the capacity of room 701?"\\n- "Show me information about the preferred location"\\n- "Find the location ID for booking room XYZ"\\n\\nNot For:\\n- Checking room availability or schedule (use matrix_booking_check_availability)\\n- Making bookings (use matrix_booking_create_booking)\\n- Getting your personal bookings (use get_user_bookings)\\n- Searching for rooms with specific facilities (use find_rooms_with_facilities)\\n\\nWorkflow Position: Support tool in space discovery workflow - Use to understand location capabilities before booking\\n\\nRelated Tools:\\n- get_locations: Prerequisite - Discover locations first in hierarchy\\n- matrix_booking_check_availability: Next step - Check this location\'s availability\\n- matrix_booking_create_booking: Next step - Book this location using location ID\\n- find_rooms_with_facilities: Alternative - Search for locations with specific requirements',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'number',
              description: 'The Matrix location ID to retrieve. If not provided, returns the preferred location.'
            }
          }
        }
      },
      {
        name: 'get_current_user',
        description: 'Get current user profile information, organization context, and account settings. Use this tool to understand user permissions and organizational structure.\\n\\nCommon Use Cases:\\n- "What\'s my user ID and organization?"\\n- "Show my profile information"\\n- "What organization am I part of?"\\n- "Get my account details for booking setup"\\n- "Verify my authentication status"\\n\\nNot For:\\n- Getting your booking schedule or reservations (use get_user_bookings)\\n- Checking room availability (use matrix_booking_check_availability)\\n- Creating bookings (use matrix_booking_create_booking)\\n- Getting organization-wide location info (use get_locations)\\n\\nWorkflow Position: Foundation tool for all workflows - Provides organization context for other operations\\n\\nRelated Tools:\\n- get_booking_categories: Next step - Get organization\'s available booking types\\n- get_locations: Next step - Explore organization\'s location hierarchy\\n- get_user_bookings: Next step - View your personal booking schedule\\n- health_check: Alternative - Verify authentication and system status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_booking_categories',
        description: 'Get available booking categories and room types for your organization. Use this tool to understand what types of spaces can be booked and their characteristics.\\n\\nCommon Use Cases:\\n- "What types of rooms can I book?"\\n- "Show me all available booking categories"\\n- "What meeting room options are there?"\\n- "List desk and workspace categories"\\n- "Get room type information for planning"\\n\\nNot For:\\n- Checking availability of specific rooms (use matrix_booking_check_availability)\\n- Getting actual location details (use matrix_booking_get_location)\\n- Making bookings (use matrix_booking_create_booking)\\n- Viewing your existing bookings (use get_user_bookings)\\n\\nWorkflow Position: Step 1 of space discovery workflow - Understand available space types before searching\\n\\nRelated Tools:\\n- get_locations: Next step - Explore specific locations within categories\\n- find_rooms_with_facilities: Next step - Search within specific categories\\n- matrix_booking_check_availability: Next step - Check availability for specific categories\\n- get_current_user: Prerequisite - Get organization context for categories',
        inputSchema: {
          type: 'object',
          properties: {
            organizationId: {
              type: 'number',
              description: 'The organization ID. If not provided, will extract from current user.'
            }
          }
        }
      },
      {
        name: 'get_locations',
        description: 'Get location hierarchy, building structure, and discovery information for your organization. Use this tool to explore and navigate the office layout and find bookable spaces.\\n\\nCommon Use Cases:\\n- "Show me all buildings and floors"\\n- "Get the location hierarchy for our office"\\n- "List all meeting rooms on the 3rd floor"\\n- "Find bookable spaces in Building A"\\n- "Show me room facilities and capacity info"\\n\\nNot For:\\n- Checking room availability or schedules (use matrix_booking_check_availability)\\n- Getting detailed info about one specific location (use matrix_booking_get_location)\\n- Making bookings (use matrix_booking_create_booking)\\n- Getting your personal bookings (use get_user_bookings)\\n\\nWorkflow Position: Step 2 of space discovery workflow - Explore location hierarchy after understanding categories\\n\\nRelated Tools:\\n- get_booking_categories: Prerequisite - Understand space types before exploring\\n- matrix_booking_get_location: Next step - Get details about specific discovered locations\\n- discover_available_facilities: Next step - Understand facilities in discovered locations\\n- find_rooms_with_facilities: Alternative - Direct search with requirements',
        inputSchema: {
          type: 'object',
          properties: {
            parentId: {
              type: 'number',
              description: 'Parent location ID to filter by'
            },
            kind: {
              type: 'string',
              description: 'Location kind/type to filter by (e.g. "Building", "Floor", "Room")'
            },
            includeAncestors: {
              type: 'boolean',
              description: 'Include ancestor path information',
              default: false
            },
            includeFacilities: {
              type: 'boolean', 
              description: 'Include facility information',
              default: true
            },
            includeChildren: {
              type: 'boolean',
              description: 'Include child locations',
              default: true
            },
            isBookable: {
              type: 'boolean',
              description: 'Filter by bookable status'
            }
          }
        }
      },
      {
        name: 'discover_available_facilities',
        description: 'Discover and list all available facility types across your organization for location filtering and search. Use this tool to understand what amenities and equipment are available.\\n\\nCommon Use Cases:\\n- "What facilities are available in our offices?"\\n- "List all audio-visual equipment available"\\n- "Show me connectivity options (WiFi, ethernet, etc.)"\\n- "What furniture types are available?"\\n- "Find all facilities by category"\\n\\nNot For:\\n- Searching for specific rooms with facilities (use find_rooms_with_facilities)\\n- Checking availability of rooms (use matrix_booking_check_availability)\\n- Getting location-specific facility info (use matrix_booking_get_location)\\n- Making bookings (use matrix_booking_create_booking)\\n\\nWorkflow Position: Step 3 of space discovery workflow - Understand facility options before targeted search\\n\\nRelated Tools:\\n- get_locations: Prerequisite - Know locations before discovering their facilities\\n- find_rooms_with_facilities: Next step - Search for rooms with discovered facilities\\n- matrix_booking_get_location: Support - Get facility details for specific locations\\n- matrix_booking_check_availability: Final step - Check availability of suitable spaces',
        inputSchema: {
          type: 'object',
          properties: {
            location_type: {
              type: 'string',
              description: 'Optional: Filter facilities by location type (ROOM, DESK, etc.)'
            },
            building_id: {
              type: 'number',
              description: 'Optional: Filter facilities in specific building'
            },
            category: {
              type: 'string',
              description: 'Optional: Filter by facility category (audio_visual, connectivity, furniture, etc.)'
            }
          }
        }
      },
      {
        name: 'find_rooms_with_facilities',
        description: 'Find rooms and spaces with specific facilities using natural language search queries. Use this tool when you need spaces with particular equipment, capacity, or features.\\n\\nCommon Use Cases:\\n- "Find a room with a conference phone for 6 people"\\n- "Room with projector and whiteboard for tomorrow 2-4 PM"\\n- "Private booth with good WiFi for calls"\\n- "Meeting room with video conference setup"\\n- "Desk with dual monitors in Building A"\\n\\nNot For:\\n- Basic availability checking without facility requirements (use matrix_booking_check_availability)\\n- Just browsing facility types available (use discover_available_facilities)\\n- Making the actual booking (use matrix_booking_create_booking)\\n- Getting your existing bookings (use get_user_bookings)\\n\\nWorkflow Position: Alternative Step 1 of booking creation workflow - Targeted search with requirements before booking\\n\\nRelated Tools:\\n- discover_available_facilities: Prerequisite - Understand available facilities first\\n- matrix_booking_create_booking: Next step - Book rooms found through facility search\\n- matrix_booking_check_availability: Alternative - Basic availability without facility filters\\n- matrix_booking_get_location: Follow-up - Get details about found locations',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query (e.g., "room with conference phone for 6 people on 2025-02-01")',
              required: true
            },
            dateFrom: {
              type: 'string',
              description: 'Optional: Start date and time in ISO 8601 format'
            },
            dateTo: {
              type: 'string',
              description: 'Optional: End date and time in ISO 8601 format'
            },
            duration: {
              type: 'number',
              description: 'Optional: Required duration in minutes'
            },
            buildingId: {
              type: 'number',
              description: 'Optional: Limit search to specific building'
            },
            category: {
              type: 'string',
              description: 'Optional: Filter by booking category (Meeting Rooms, Desks, Privacy Pods, etc.)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_user_bookings',
        description: 'Retrieve current user\'s existing room and desk bookings with optional date filtering. Use this tool when users ask about their scheduled bookings, reservations, or meetings.\n\nCommon Use Cases:\n- "What meetings do I have tomorrow?"\n- "Show my desk bookings for this week"\n- "Do I have any room conflicts?"\n- "What\'s on my calendar for next Monday?"\n- "List all my active bookings"\n\nNot For:\n- Checking room availability (use matrix_booking_check_availability)\n- Creating new bookings (use matrix_booking_create_booking)\n- Getting location details (use matrix_booking_get_location)\n\nWorkflow Position: Primary tool for user booking inquiry workflow - First step to answer "what do I have booked"\n\nRelated Tools:\n- get_current_user: Prerequisite - Get user context and authentication\n- matrix_booking_get_location: Follow-up - Get details about booked locations\n- matrix_booking_check_availability: Next workflow - Find additional available spaces\n- matrix_booking_create_booking: Next workflow - Create new bookings after viewing existing',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: {
              type: 'string',
              description: 'Start date for booking filter in ISO 8601 format (e.g., 2024-01-15T00:00:00.000Z). Defaults to current date if not provided.'
            },
            dateTo: {
              type: 'string',
              description: 'End date for booking filter in ISO 8601 format (e.g., 2024-01-15T23:59:59.999Z). Defaults to 30 days from start date if not provided.'
            },
            status: {
              type: 'string',
              description: 'Filter by booking status. Options: ACTIVE (default), CANCELLED, COMPLETED.',
              enum: ['ACTIVE', 'CANCELLED', 'COMPLETED']
            },
            page: {
              type: 'number',
              description: 'Page number for pagination (starts from 1). Defaults to 1.',
              minimum: 1,
              default: 1
            },
            pageSize: {
              type: 'number',
              description: 'Number of bookings per page (1-100). Defaults to 50.',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          }
        }
      },
      {
        name: 'health_check',
        description: 'Check the health status and connectivity of all Matrix Booking MCP services and dependencies. Use this tool to diagnose connection issues or verify system status.\\n\\nCommon Use Cases:\\n- "Is the Matrix booking system working?"\\n- "Check if all services are connected properly"\\n- "Diagnose authentication or API issues"\\n- "Verify system health before important bookings"\\n- "Get detailed service status information"\\n\\nNot For:\\n- Getting user information (use get_current_user)\\n- Checking room availability (use matrix_booking_check_availability)\\n- Viewing bookings (use get_user_bookings)\\n- Making bookings (use matrix_booking_create_booking)\\n\\nWorkflow Position: Diagnostic tool for all workflows - Use when other tools fail or before critical operations\\n\\nRelated Tools:\\n- get_current_user: Next step - Verify authentication after health check\\n- All other tools: Support - Use after health check confirms system operational\\n- None: Prerequisite - Use as first step when troubleshooting any workflow failures',
        inputSchema: {
          type: 'object',
          properties: {
            verbose: {
              type: 'boolean',
              description: 'Return detailed service status information',
              default: false
            }
          }
        }
      },
      {
        name: 'matrix_booking_cancel_booking',
        description: 'Cancel an existing room or desk booking with notification options. Use this tool to cancel bookings you own or have permission to cancel.\n\nCommon Use Cases:\n- "Cancel my 3pm meeting room booking"\n- "Cancel booking ID 12345 and notify attendees"\n- "Remove my desk reservation for tomorrow"\n- "Cancel the conference room booking for project meeting"\n\nNot For:\n- Creating new bookings (use matrix_booking_create_booking)\n- Checking availability (use matrix_booking_check_availability)\n- Viewing existing bookings (use get_user_bookings)\n- Modifying booking details (contact administrator)\n\nWorkflow Position: Final action in booking management workflow - Use after identifying booking to cancel\n\nPrerequisites:\n- Use get_user_bookings to find the booking ID to cancel\n- Verify booking ownership and permissions\n- Consider notifying attendees about cancellation\n\nRelated Tools:\n- get_user_bookings: Prerequisite - Find booking ID to cancel\n- matrix_booking_check_availability: Follow-up - Find alternative time slots\n- matrix_booking_create_booking: Follow-up - Create replacement booking\n- matrix_booking_get_location: Support - Get location details for cancelled booking',
        inputSchema: {
          type: 'object',
          properties: {
            bookingId: {
              type: ['string', 'number'],
              description: 'The booking ID to cancel. Can be string or number format. Required parameter.'
            },
            notifyScope: {
              type: 'string',
              enum: ['ALL_ATTENDEES', 'OWNER_ONLY', 'NONE'],
              description: 'Who to notify about the cancellation. Defaults to \'ALL_ATTENDEES\'.',
              default: 'ALL_ATTENDEES'
            },
            sendNotifications: {
              type: 'boolean',
              description: 'Whether to send cancellation notifications. Defaults to true.',
              default: true
            },
            reason: {
              type: 'string',
              description: 'Optional cancellation reason for attendee notification and audit trail. Maximum 500 characters.',
              maxLength: 500
            }
          },
          required: ['bookingId'],
          additionalProperties: false
        }
      },
      {
        name: 'get_tool_guidance',
        description: 'Get intelligent guidance on Matrix Booking MCP tool selection and workflows. Provides tool recommendations, workflow sequences, and troubleshooting support for AI assistants.\\n\\nCommon Use Cases:\\n- "What tool should I use to see user bookings?"\\n- "How do I create a booking workflow?"\\n- "I\'m getting 405 errors, what should I try?"\\n- "What\'s the correct sequence for booking a room?"\\n- "Which tool handles user calendar queries?"\\n\\nNot For:\\n- Actually executing booking operations (use specific booking tools)\\n- Getting real data from the system (use functional tools)\\n- Making API calls (this is guidance only)\\n- Replacing proper tool usage (use appropriate tools after getting guidance)\\n\\nWorkflow Position: Meta-tool for workflow planning - Use before other tools to ensure correct selection\\n\\nRelated Tools:\\n- All Matrix Booking tools: Support - Use guidance to select appropriate tool\\n- health_check: Prerequisite - Use first if tools are failing\\n- get_current_user: Support - Use to verify context before following guidance',
        inputSchema: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              description: 'Optional: Describe the user\'s intent or query to get specific tool recommendations'
            },
            context: {
              type: 'string',
              description: 'Optional: Additional context about the current situation or error'
            }
          }
        }
      }
    ];
  }

  private async handleCheckAvailability(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling check availability request:', args);

    try {
      // Build request object with only defined values to avoid type issues
      const request: Partial<{ dateFrom: string; dateTo: string; locationId: number; duration: number }> = {};
      
      if (args['dateFrom']) {
        request.dateFrom = args['dateFrom'] as string;
      }
      if (args['dateTo']) {
        request.dateTo = args['dateTo'] as string;  
      }
      // Handle location resolution - either locationId or locationName
      if (args['locationId']) {
        request.locationId = args['locationId'] as number;
      } else if (args['locationName']) {
        // Resolve location name to ID
        const locationName = args['locationName'] as string;
        console.error('MCP Server: Resolving location name for availability:', locationName);
        
        try {
          const resolvedLocationId = await this.bookingService.resolveLocationId(locationName);
          request.locationId = resolvedLocationId;
          console.error('MCP Server: Resolved location ID for availability:', resolvedLocationId);
        } catch (error) {
          console.error('MCP Server: Location resolution failed for availability:', error);
          return this.formatEnhancedError(error, 'matrix_booking_check_availability', 'availability');
        }
      }
      
      if (args['duration']) {
        request.duration = args['duration'] as number;
      }

      const response = await this.availabilityService.checkAvailability(request);
      
      // Add location names to time slots if available
      if (response.slots && response.slots.length > 0) {
        const locationIds = response.slots.map(slot => slot.locationId);
        const locationMap = await this.resolveLocationNames(locationIds);
        
        response.slots = response.slots.map(slot => ({
          ...slot,
          locationName: locationMap.get(slot.locationId)?.name || `Location ID: ${slot.locationId}`
        }));
      }
      
      // Add location name to main location if available
      if (response.location && response.location.id) {
        const locationMap = await this.resolveLocationNames([response.location.id]);
        response.location.name = locationMap.get(response.location.id)?.name || response.location.name;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in check availability:', error);
      return this.formatEnhancedError(error, 'matrix_booking_check_availability', 'availability');
    }
  }

  private async handleCreateBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling create booking request:', args);

    try {
      // Build partial request object with only defined values
      const partialRequest: Partial<{ 
        timeFrom: string; 
        timeTo: string; 
        locationId: number; 
        attendees: Array<{ name: string; email: string }>; 
        extraRequests: string[]; 
        owner: { id: number; name: string; email: string }; 
        ownerIsAttendee: boolean; 
        source: string 
      }> = {};

      if (args['timeFrom']) {
        partialRequest.timeFrom = args['timeFrom'] as string;
      }
      if (args['timeTo']) {
        partialRequest.timeTo = args['timeTo'] as string;
      }

      // Handle location resolution - either locationId or locationName
      if (args['locationId']) {
        partialRequest.locationId = args['locationId'] as number;
      } else if (args['locationName']) {
        // Resolve location name to ID using hierarchical search
        const locationName = args['locationName'] as string;
        console.error('MCP Server: Resolving location name:', locationName);
        
        try {
          const resolvedLocationId = await this.bookingService.resolveLocationId(locationName);
          partialRequest.locationId = resolvedLocationId;
          console.error('MCP Server: Resolved location ID:', resolvedLocationId);
        } catch (error) {
          console.error('MCP Server: Location resolution failed:', error);
          return this.formatEnhancedError(error, 'matrix_booking_create_booking', 'booking');
        }
      }

      if (args['attendees']) {
        partialRequest.attendees = args['attendees'] as Array<{ name: string; email: string }>;
      }
      if (args['extraRequests']) {
        partialRequest.extraRequests = args['extraRequests'] as string[];
      }
      if (args['owner']) {
        partialRequest.owner = args['owner'] as { id: number; name: string; email: string };
      }
      if (args['ownerIsAttendee'] !== undefined) {
        partialRequest.ownerIsAttendee = args['ownerIsAttendee'] as boolean;
      }
      if (args['source']) {
        partialRequest.source = args['source'] as string;
      }

      const formattedRequest = await this.bookingService.formatBookingRequest(partialRequest);
      const response = await this.bookingService.createBooking(formattedRequest);
      
      // Add location name to booking response
      if (response.locationId) {
        const locationMap = await this.resolveLocationNames([response.locationId]);
        response.locationName = locationMap.get(response.locationId)?.name || `Location ID: ${response.locationId}`;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error('MCP Server: Error creating booking:', error);
      return this.formatEnhancedError(error, 'matrix_booking_create_booking', 'booking');
    }
  }

  private async handleGetLocation(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get location request:', args);

    try {
      let response;
      if (args['locationId']) {
        response = await this.locationService.getLocation(args['locationId'] as number);
      } else {
        response = await this.locationService.getPreferredLocation();
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in get location:', error);
      return this.formatEnhancedError(error, 'matrix_booking_get_location', 'location');
    }
  }

  private async handleGetCurrentUser(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get current user request:', args);

    try {
      const response = await this.userService.getCurrentUser();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in get current user:', error);
      return this.formatEnhancedError(error, 'get_current_user', 'user');
    }
  }

  private async handleGetBookingCategories(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get booking categories request:', args);

    try {
      let organizationId: number;

      if (args['organizationId']) {
        organizationId = args['organizationId'] as number;
      } else {
        // Get organization ID from current user
        const currentUser = await this.userService.getCurrentUser();
        if (!currentUser.organisationId) {
          throw new Error('Unable to determine organization ID from current user');
        }
        organizationId = currentUser.organisationId;
      }

      const response = await this.organizationService.getBookingCategories(organizationId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in get booking categories:', error);
      return this.formatEnhancedError(error, 'get_booking_categories', 'organization');
    }
  }

  private async handleGetLocations(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get locations request:', args);

    try {
      // Build query request with only defined values
      const queryRequest: { 
        parentId?: number;
        kind?: string;
        includeAncestors?: boolean;
        includeFacilities?: boolean;
        includeChildren?: boolean;
        isBookable?: boolean;
      } = {};

      if (args['parentId']) {
        queryRequest.parentId = args['parentId'] as number;
      }
      if (args['kind']) {
        queryRequest.kind = args['kind'] as string;
      }
      if (args['includeAncestors'] !== undefined) {
        queryRequest.includeAncestors = args['includeAncestors'] as boolean;
      }
      if (args['includeFacilities'] !== undefined) {
        queryRequest.includeFacilities = args['includeFacilities'] as boolean;
      }
      if (args['includeChildren'] !== undefined) {
        queryRequest.includeChildren = args['includeChildren'] as boolean;
      }
      if (args['isBookable'] !== undefined) {
        queryRequest.isBookable = args['isBookable'] as boolean;
      }

      const response = await this.locationService.getLocationHierarchy(queryRequest);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in get locations:', error);
      return this.formatEnhancedError(error, 'get_locations', 'location');
    }
  }

  private async handleDiscoverAvailableFacilities(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling discover available facilities request:', args);
    
    try {
      // Get location hierarchy to discover facilities
      const hierarchyResponse = await this.locationService.getLocationHierarchy({
        includeChildren: true,
        includeFacilities: true,
        includeAncestors: false
      });

      // Extract all facilities from locations
      const allFacilities = new Map<string, { facility: IFacility; locations: string[] }>();
      
      for (const location of hierarchyResponse.locations) {
        if (location.facilities && location.facilities.length > 0) {
          for (const facility of location.facilities) {
            const facilityKey = facility.name.toLowerCase();
            
            if (allFacilities.has(facilityKey)) {
              allFacilities.get(facilityKey)!.locations.push(location.name);
            } else {
              allFacilities.set(facilityKey, {
                facility: facility,
                locations: [location.name]
              });
            }
          }
        }
      }

      // Apply filters if provided
      let facilitiesArray = Array.from(allFacilities.values());
      
      if (args['category']) {
        const categoryFilter = args['category'] as string;
        facilitiesArray = facilitiesArray.filter(item => 
          item.facility.category === categoryFilter
        );
      }

      if (args['location_type']) {
        const locationTypeFilter = args['location_type'] as string;
        facilitiesArray = facilitiesArray.filter(item => {
          const hasMatchingType = hierarchyResponse.locations
            .filter(loc => item.locations.includes(loc.name))
            .some(loc => loc.kind === locationTypeFilter);
          return hasMatchingType;
        });
      }

      // Group facilities by category
      const facilitiesByCategory: Record<string, unknown[]> = {};
      
      for (const item of facilitiesArray) {
        const category = item.facility.category || 'uncategorized';
        if (!facilitiesByCategory[category]) {
          facilitiesByCategory[category] = [];
        }
        facilitiesByCategory[category].push({
          name: item.facility.name,
          id: item.facility.id,
          category: item.facility.category,
          availableIn: item.locations,
          locationCount: item.locations.length
        });
      }

      const summary = {
        totalFacilities: facilitiesArray.length,
        totalLocations: hierarchyResponse.locations.length,
        facilitiesByCategory,
        categories: Object.keys(facilitiesByCategory),
        filters: {
          category: args['category'] || null,
          location_type: args['location_type'] || null,
          building_id: args['building_id'] || null
        }
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error discovering available facilities:', error);
      return this.formatEnhancedError(error, 'discover_available_facilities', 'facility');
    }
  }

  private async handleFindRoomsWithFacilities(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling find rooms with facilities request:', args);

    try {
      // Validate required query parameter
      if (!args['query']) {
        throw new Error('Query parameter is required');
      }

      // Build search query
      const searchQuery: ISearchQuery = {
        query: args['query'] as string
      };
      
      if (args['dateFrom']) searchQuery.dateFrom = args['dateFrom'] as string;
      if (args['dateTo']) searchQuery.dateTo = args['dateTo'] as string;
      if (args['duration']) searchQuery.duration = args['duration'] as number;
      if (args['buildingId']) searchQuery.buildingId = args['buildingId'] as number;
      if (args['category']) searchQuery.category = args['category'] as string;

      // Perform the search
      const searchResponse = await this.searchService.search(searchQuery);

      // Limit results if specified
      const maxResults = (args['maxResults'] as number) || 10;
      const limitedResults = searchResponse.results.slice(0, maxResults);

      // Format response for better readability
      const formattedResponse = {
        query: searchResponse.metadata.query,
        parsedRequirements: searchResponse.metadata.parsedRequirements,
        totalResults: searchResponse.totalResults,
        results: limitedResults.map(result => ({
          location: {
            id: result.location.id,
            name: result.location.name,
            description: result.location.description,
            kind: result.location.kind,
            building: result.location.buildingName,
            floor: result.location.floorName
          },
          relevanceScore: result.relevanceScore,
          matchReason: result.matchReason,
          facilityMatches: result.facilityMatches.map(match => ({
            facility: match.facility.name,
            matchType: match.matchType,
            score: match.score
          })),
          capacity: result.capacity,
          availability: result.availability,
          alternatives: result.alternatives
        })),
        suggestions: searchResponse.suggestions,
        filtersApplied: searchResponse.metadata.filtersApplied,
        searchTime: `${searchResponse.metadata.searchTime}ms`
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedResponse, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error finding rooms with facilities:', error);
      return this.formatEnhancedError(error, 'find_rooms_with_facilities', 'search');
    }
  }

  private async handleHealthCheck(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const verbose = args['verbose'] as boolean || false;
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {} as Record<string, { status: string; details?: unknown }>
    };

    try {
      // Test UserService
      try {
        await this.userService.getCurrentUser();
        healthStatus.services['userService'] = { status: 'healthy' };
      } catch (error) {
        healthStatus.services['userService'] = { 
          status: 'degraded', 
          details: verbose ? (error instanceof Error ? error.message : 'Unknown error') : undefined 
        };
        healthStatus.status = 'degraded';
      }

      // Test OrganizationService
      try {
        const user = await this.userService.getCurrentUser();
        if (user.organisationId) {
          await this.organizationService.getBookingCategories(user.organisationId);
          healthStatus.services['organizationService'] = { status: 'healthy' };
        } else {
          healthStatus.services['organizationService'] = { status: 'unknown', details: 'No organization ID available' };
        }
      } catch (error) {
        healthStatus.services['organizationService'] = { 
          status: 'degraded', 
          details: verbose ? (error instanceof Error ? error.message : 'Unknown error') : undefined 
        };
        healthStatus.status = 'degraded';
      }

      // Test LocationService  
      try {
        await this.locationService.getPreferredLocation();
        healthStatus.services['locationService'] = { status: 'healthy' };
      } catch (error) {
        healthStatus.services['locationService'] = { 
          status: 'degraded', 
          details: verbose ? (error instanceof Error ? error.message : 'Unknown error') : undefined 
        };
        healthStatus.status = 'degraded';
      }

      // Test AvailabilityService
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await this.availabilityService.checkAvailability({
          dateFrom: tomorrow.toISOString(),
          dateTo: tomorrow.toISOString()
        });
        healthStatus.services['availabilityService'] = { status: 'healthy' };
      } catch (error) {
        healthStatus.services['availabilityService'] = { 
          status: 'degraded', 
          details: verbose ? (error instanceof Error ? error.message : 'Unknown error') : undefined 
        };
        healthStatus.status = 'degraded';
      }

      // Test SearchService
      try {
        await this.searchService.search({ query: 'test health check' });
        healthStatus.services['searchService'] = { status: 'healthy' };
      } catch (error) {
        healthStatus.services['searchService'] = { 
          status: 'degraded', 
          details: verbose ? (error instanceof Error ? error.message : 'Unknown error') : undefined 
        };
        healthStatus.status = 'degraded';
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(healthStatus, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error('MCP Server: Error in health check:', error);
      return this.formatEnhancedError(error, 'health_check', 'system');
    }
  }

  private async handleGetUserBookings(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get user bookings request:', args);

    try {
      // Build request from args
      const request: IUserBookingsRequest = {};
      
      if (args['dateFrom']) request.startDate = args['dateFrom'] as string;
      if (args['dateTo']) request.endDate = args['dateTo'] as string;
      if (args['status']) request.status = args['status'] as ('ACTIVE' | 'CANCELLED' | 'COMPLETED');
      if (args['page']) request.page = args['page'] as number;
      if (args['pageSize']) request.pageSize = args['pageSize'] as number;

      const response = await this.userService.getUserBookings(request);

      // Extract all unique location IDs from bookings
      const locationIds = response.bookings.map(booking => booking.locationId);
      const locationMap = await this.resolveLocationNames(locationIds);

      // Format response for better readability
      const formattedResponse = {
        summary: {
          totalBookings: response.total,
          page: response.page || 1,
          pageSize: response.pageSize || 50,
          hasNext: (response.total > ((response.page || 1) * (response.pageSize || 50)))
        },
        bookings: response.bookings.map(booking => {
          const locationInfo = locationMap.get(booking.locationId);
          return {
            id: booking.id,
            locationId: booking.locationId,
            locationName: locationInfo?.name || `Location ID: ${booking.locationId}`,
            timeSlot: `${booking.timeFrom} to ${booking.timeTo}`,
            status: booking.status,
            duration: this.calculateDuration(booking.timeFrom, booking.timeTo),
            attendeeCount: booking.attendeeCount || 0,
            owner: booking.owner?.name || 'Unknown',
            locationKind: booking.locationKind,
            organisation: booking.organisation?.name || 'Unknown',
            isPrivate: booking.isPrivate,
            hasStarted: booking.hasStarted,
            hasEnded: booking.hasEnded
          };
        })
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedResponse, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error('MCP Server: Error getting user bookings:', error);
      return this.formatEnhancedError(error, 'get_user_bookings', 'user');
    }
  }

  private async handleCancelBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling cancel booking request:', args);

    try {
      // Build request object with validated parameters
      const request: {
        bookingId: string | number;
        notifyScope?: 'ALL_ATTENDEES' | 'OWNER_ONLY' | 'NONE';
        sendNotifications?: boolean;
        reason?: string;
      } = {
        bookingId: args['bookingId'] as string | number
      };

      // Optional parameters with defaults
      if (args['notifyScope']) {
        request.notifyScope = args['notifyScope'] as 'ALL_ATTENDEES' | 'OWNER_ONLY' | 'NONE';
      }

      if (args['sendNotifications'] !== undefined) {
        request.sendNotifications = args['sendNotifications'] as boolean;
      }

      if (args['reason']) {
        request.reason = args['reason'] as string;
      }

      const response = await this.bookingService.cancelBooking(request);

      // Enhance response with location name if available
      if (response.originalBooking?.locationId) {
        try {
          const location = await this.locationService.getLocation(response.originalBooking.locationId);
          response.originalBooking.locationName = location.name;
        } catch (error) {
          console.warn('Failed to resolve location name for cancelled booking:', error);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error('MCP Server: Error cancelling booking:', error);
      return this.formatEnhancedError(error, 'matrix_booking_cancel_booking', 'cancel_booking');
    }
  }

  private async handleGetToolGuidance(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get tool guidance request:', args);

    try {
      const intent = args['intent'] as string || '';
      const context = args['context'] as string || '';

    // Create comprehensive tool guidance response
    interface ToolGuidanceResponse {
      workflows: Array<{
        scenario: string;
        description: string;
        tools: Array<{
          tool: string;
          order: number;
          purpose: string;
          required: boolean;
        }>;
      }>;
      intentMapping: Record<string, {
        primaryTool: string;
        supportingTools: string[];
        avoidTools: string[];
      }>;
      troubleshooting: Record<string, {
        suggestion: string;
        alternativeTools: string[];
        diagnosticSteps: string[];
      }>;
      toolSelection: Record<string, string>;
      recommendation?: {
        recognizedIntent: string;
        matchedPhrase: string;
        primaryTool: string;
        supportingTools: string[];
        avoidTools: string[];
        reasoning: string;
      };
      contextualHelp?: {
        detectedIssue: string;
        suggestion: string;
        alternativeTools: string[];
        diagnosticSteps: string[];
      };
    }

    const guidance: ToolGuidanceResponse = {
      workflows: [
        {
          scenario: "User wants to see their bookings/reservations/calendar",
          description: "When users ask about 'what do I have booked', 'my meetings', 'my calendar', or 'show my bookings'",
          tools: [
            {
              tool: "get_user_bookings",
              order: 1,
              purpose: "Retrieve user's existing bookings and reservations",
              required: true
            },
            {
              tool: "matrix_booking_get_location", 
              order: 2,
              purpose: "Get details about booked locations if needed",
              required: false
            }
          ]
        },
        {
          scenario: "User wants to create a new booking",
          description: "Complete workflow for booking rooms, desks, or spaces",
          tools: [
            {
              tool: "matrix_booking_check_availability",
              order: 1,
              purpose: "Check if desired space/time is available",
              required: true
            },
            {
              tool: "find_rooms_with_facilities",
              order: 1,
              purpose: "Alternative: Find suitable rooms with specific requirements",
              required: false
            },
            {
              tool: "matrix_booking_create_booking",
              order: 2,
              purpose: "Create the actual booking reservation",
              required: true
            },
            {
              tool: "get_user_bookings",
              order: 3,
              purpose: "Verify booking appears in user's schedule",
              required: false
            }
          ]
        },
        {
          scenario: "User wants to discover available spaces and facilities",
          description: "Explore office layout, find rooms with specific amenities",
          tools: [
            {
              tool: "get_booking_categories",
              order: 1,
              purpose: "Understand available space types in organization",
              required: false
            },
            {
              tool: "get_locations",
              order: 2,
              purpose: "Explore building/floor hierarchy and bookable spaces",
              required: false
            },
            {
              tool: "discover_available_facilities",
              order: 3,
              purpose: "List all facility types and equipment available",
              required: false
            },
            {
              tool: "find_rooms_with_facilities",
              order: 4,
              purpose: "Search for specific rooms matching requirements",
              required: true
            }
          ]
        },
        {
          scenario: "User wants to cancel a booking",
          description: "Complete workflow for cancelling existing bookings with proper verification",
          tools: [
            {
              tool: "get_user_bookings",
              order: 1,
              purpose: "Find the booking ID to cancel and verify ownership",
              required: true
            },
            {
              tool: "matrix_booking_cancel_booking",
              order: 2,
              purpose: "Cancel the identified booking with notification options",
              required: true
            },
            {
              tool: "get_user_bookings",
              order: 3,
              purpose: "Verify the booking was successfully cancelled",
              required: false
            }
          ]
        },
        {
          scenario: "System troubleshooting and diagnostics",
          description: "Diagnose issues, verify authentication, check system health",
          tools: [
            {
              tool: "health_check",
              order: 1,
              purpose: "Verify all services and connections are working",
              required: true
            },
            {
              tool: "get_current_user",
              order: 2,
              purpose: "Verify authentication and user context",
              required: false
            }
          ]
        }
      ],
      
      intentMapping: {
        "what do I have booked": {
          primaryTool: "get_user_bookings",
          supportingTools: ["matrix_booking_get_location"],
          avoidTools: ["matrix_booking_check_availability", "matrix_booking_create_booking"]
        },
        "my bookings": {
          primaryTool: "get_user_bookings", 
          supportingTools: ["matrix_booking_get_location"],
          avoidTools: ["matrix_booking_check_availability", "matrix_booking_create_booking"]
        },
        "my meetings": {
          primaryTool: "get_user_bookings",
          supportingTools: ["matrix_booking_get_location"],
          avoidTools: ["matrix_booking_check_availability", "matrix_booking_create_booking"]
        },
        "my calendar": {
          primaryTool: "get_user_bookings",
          supportingTools: ["matrix_booking_get_location"], 
          avoidTools: ["matrix_booking_check_availability", "matrix_booking_create_booking"]
        },
        "what's available": {
          primaryTool: "matrix_booking_check_availability",
          supportingTools: ["find_rooms_with_facilities", "get_locations"],
          avoidTools: ["get_user_bookings"]
        },
        "book a room": {
          primaryTool: "matrix_booking_check_availability",
          supportingTools: ["matrix_booking_create_booking", "find_rooms_with_facilities"],
          avoidTools: ["get_user_bookings"]
        },
        "create booking": {
          primaryTool: "matrix_booking_check_availability", 
          supportingTools: ["matrix_booking_create_booking", "find_rooms_with_facilities"],
          avoidTools: ["get_user_bookings"]
        },
        "reserve space": {
          primaryTool: "matrix_booking_check_availability",
          supportingTools: ["matrix_booking_create_booking", "find_rooms_with_facilities"],
          avoidTools: ["get_user_bookings"]
        },
        "find room with": {
          primaryTool: "find_rooms_with_facilities",
          supportingTools: ["discover_available_facilities", "matrix_booking_check_availability"],
          avoidTools: ["get_user_bookings", "matrix_booking_create_booking"]
        },
        "room details": {
          primaryTool: "matrix_booking_get_location",
          supportingTools: ["get_locations", "discover_available_facilities"],
          avoidTools: ["get_user_bookings", "matrix_booking_create_booking"]
        },
        "system not working": {
          primaryTool: "health_check",
          supportingTools: ["get_current_user"],
          avoidTools: []
        },
        "cancel booking": {
          primaryTool: "matrix_booking_cancel_booking",
          supportingTools: ["get_user_bookings", "matrix_booking_get_location"],
          avoidTools: ["matrix_booking_create_booking", "matrix_booking_check_availability"]
        },
        "cancel my booking": {
          primaryTool: "get_user_bookings",
          supportingTools: ["matrix_booking_cancel_booking"],
          avoidTools: ["matrix_booking_create_booking"]
        },
        "remove booking": {
          primaryTool: "matrix_booking_cancel_booking",
          supportingTools: ["get_user_bookings"],
          avoidTools: ["matrix_booking_create_booking"]
        }
      },
      
      troubleshooting: {
        "405 Method Not Allowed": {
          suggestion: "API endpoint configuration issue. The HTTP method (GET/POST) may be incorrect for the availability check endpoint.",
          alternativeTools: ["health_check", "get_current_user"],
          diagnosticSteps: [
            "1. Run health_check to verify service connectivity",
            "2. Try get_current_user to verify authentication",
            "3. Check if the issue persists with other tools",
            "4. Contact administrator if availability service continues failing"
          ]
        },
        "authentication": {
          suggestion: "Authentication credentials may be invalid or expired.",
          alternativeTools: ["health_check", "get_current_user"],
          diagnosticSteps: [
            "1. Run health_check with verbose=true to see detailed error info",
            "2. Verify authentication configuration",
            "3. Check if credentials need to be refreshed",
            "4. Try get_current_user to test authentication"
          ]
        },
        "Person not found": {
          suggestion: "User profile or organization context issue. The user may not be properly registered in the Matrix system.",
          alternativeTools: ["get_current_user", "health_check"],
          diagnosticSteps: [
            "1. Run get_current_user to verify user profile exists",
            "2. Check if user has proper organization association", 
            "3. Verify user has booking permissions",
            "4. Contact administrator for user setup assistance"
          ]
        },
        "timeout": {
          suggestion: "Network connectivity or API performance issue.",
          alternativeTools: ["health_check"],
          diagnosticSteps: [
            "1. Run health_check to verify service availability",
            "2. Try again with a shorter time range or fewer parameters",
            "3. Check network connectivity to Matrix API",
            "4. Consider trying the operation during off-peak hours"
          ]
        },
        "location not found": {
          suggestion: "Location ID or name resolution failed.",
          alternativeTools: ["get_locations", "matrix_booking_get_location"],
          diagnosticSteps: [
            "1. Use get_locations to browse available locations",
            "2. Verify location ID is correct and ≥100000",
            "3. Check if location name exists in your organization",
            "4. Try matrix_booking_get_location without parameters for preferred location"
          ]
        }
      },
      
      toolSelection: {
        "User asking about existing bookings": "Always use get_user_bookings, never use matrix_booking_check_availability",
        "User wants to create new booking": "Start with matrix_booking_check_availability or find_rooms_with_facilities, then use matrix_booking_create_booking",
        "User wants to cancel existing booking": "First use get_user_bookings to find booking ID, then use matrix_booking_cancel_booking",
        "User needs room with specific features": "Use find_rooms_with_facilities with natural language query",
        "User exploring office layout": "Start with get_locations or get_booking_categories",
        "Tools failing or errors occurring": "Start with health_check, then get_current_user for authentication verification"
      }
    };

    // If specific intent provided, try to give targeted guidance
    if (intent) {
      const lowerIntent = intent.toLowerCase();
      let matchedMapping = null;
      
      for (const [phrase, mapping] of Object.entries(guidance.intentMapping)) {
        if (lowerIntent.includes(phrase.toLowerCase())) {
          matchedMapping = { 
            phrase, 
            primaryTool: mapping.primaryTool,
            supportingTools: mapping.supportingTools,
            avoidTools: mapping.avoidTools
          };
          break;
        }
      }
      
      if (matchedMapping) {
        guidance.recommendation = {
          recognizedIntent: intent,
          matchedPhrase: matchedMapping.phrase,
          primaryTool: matchedMapping.primaryTool,
          supportingTools: matchedMapping.supportingTools,
          avoidTools: matchedMapping.avoidTools,
          reasoning: `Based on your intent "${intent}", I recommend using ${matchedMapping.primaryTool} as the primary tool.`
        };
      }
    }

    // If context provided, check for error patterns
    if (context) {
      const lowerContext = context.toLowerCase();
      for (const [errorPattern, solution] of Object.entries(guidance.troubleshooting)) {
        if (lowerContext.includes(errorPattern.toLowerCase())) {
          guidance.contextualHelp = {
            detectedIssue: errorPattern,
            suggestion: solution.suggestion,
            alternativeTools: solution.alternativeTools,
            diagnosticSteps: solution.diagnosticSteps
          };
          break;
        }
      }
    }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(guidance, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('MCP Server: Error in get tool guidance:', error);
      return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
    }
  }

  private async resolveLocationNames(locationIds: number[]): Promise<Map<number, { id: number; name: string }>> {
    const uniqueLocationIds = [...new Set(locationIds)];
    const locationMap = new Map<number, { id: number; name: string }>();
    
    // Batch fetch location details for all unique location IDs
    const locationPromises = uniqueLocationIds.map(async (locationId) => {
      try {
        const location = await this.locationService.getLocation(locationId);
        locationMap.set(locationId, { id: locationId, name: location.name });
      } catch (error) {
        console.warn(`Failed to resolve location ID ${locationId}:`, error);
        locationMap.set(locationId, { id: locationId, name: `Location ID: ${locationId}` });
      }
    });
    
    await Promise.all(locationPromises);
    return locationMap;
  }

  private calculateDuration(timeFrom: string, timeTo: string): string {
    try {
      const startTime = new Date(timeFrom);
      const endTime = new Date(timeTo);
      
      // Check if dates are valid
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return 'Unknown duration';
      }
      
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      // Check if duration is negative or invalid
      if (durationMinutes < 0 || isNaN(durationMinutes)) {
        return 'Unknown duration';
      }
      
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      
      if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
      }
      return `${minutes}m`;
    } catch {
      return 'Unknown duration';
    }
  }

  // Enhanced Error Handling Helper Methods
  private analyzeError(error: unknown): {
    message: string;
    code?: string;
    httpStatus?: number;
    type: string;
  } {
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      // HTTP Status Code detection
      const httpMatch = errorMessage.match(/(\d{3})/);
      let httpStatus: number | undefined = httpMatch && httpMatch[1] ? parseInt(httpMatch[1], 10) : undefined;
      
      // Error type classification
      let type = 'UNKNOWN_ERROR';
      let code = 'UNKNOWN_ERROR';
      
      if (errorMessage.includes('timeout')) {
        type = 'TIMEOUT_ERROR';
        code = 'REQUEST_TIMEOUT';
      } else if (errorMessage.includes('405')) {
        type = 'HTTP_METHOD_ERROR';
        code = 'METHOD_NOT_ALLOWED';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        type = 'RATE_LIMIT_ERROR';
        code = 'RATE_LIMIT_EXCEEDED';
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        type = 'SERVER_ERROR';
        code = 'INTERNAL_SERVER_ERROR';
      } else if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
        type = 'SERVER_ERROR';
        code = 'BAD_GATEWAY';
      } else if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
        type = 'SERVER_ERROR';
        code = 'SERVICE_UNAVAILABLE';
      } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        type = 'VALIDATION_ERROR';
        code = 'BAD_REQUEST';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        type = 'PERMISSION_ERROR';
        code = 'FORBIDDEN';
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        type = 'RESOURCE_NOT_FOUND';
        code = 'NOT_FOUND';
      } else if (errorMessage.includes('409') || errorMessage.includes('Conflict') || errorMessage.includes('already booked')) {
        type = 'BOOKING_CONFLICT_ERROR';
        code = 'BOOKING_CONFLICT';
        httpStatus = 409;
      } else if (errorMessage.includes('Person not found')) {
        type = 'USER_PROFILE_ERROR';
        code = 'PERSON_NOT_FOUND';
      } else if (errorMessage.includes('Location') && errorMessage.includes('not found')) {
        type = 'LOCATION_ERROR';
        code = 'LOCATION_NOT_FOUND';
      } else if (errorMessage.includes('Network') || errorMessage.includes('ECONNREFUSED')) {
        type = 'NETWORK_ERROR';
        code = 'NETWORK_CONNECTION_FAILED';
      } else if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        type = 'AUTHENTICATION_ERROR';
        code = 'AUTH_FAILED';
      }
      
      const result: {
        message: string;
        code?: string;
        httpStatus?: number;
        type: string;
      } = {
        message: errorMessage,
        type
      };
      
      if (code) result.code = code;
      if (httpStatus !== undefined) result.httpStatus = httpStatus;
      
      return result;
    }
    
    return {
      message: error ? String(error) : 'Unknown error occurred',
      type: 'UNKNOWN_ERROR'
    };
  }

  private getErrorSuggestions(errorType: string, _errorCode: string | undefined, toolContext: string): {
    actions: MCPErrorSuggestion[];
    workflows: string[];
    commonCauses: string[];
    diagnosticSteps: string[];
  } {
    const suggestions = {
      actions: [] as MCPErrorSuggestion[],
      workflows: [] as string[],
      commonCauses: [] as string[],
      diagnosticSteps: [] as string[]
    };

    switch (errorType) {
      case 'HTTP_METHOD_ERROR':
        suggestions.actions.push({
          action: "Verify system health and connectivity",
          tool: "health_check",
          description: "Run health check to verify service status and API connectivity",
          parameters: { verbose: true }
        });
        suggestions.actions.push({
          action: "Check authentication status",
          tool: "get_current_user", 
          description: "Verify user authentication and permissions"
        });
        suggestions.workflows = ['System troubleshooting and diagnostics'];
        suggestions.commonCauses = [
          'API endpoint configuration issue',
          'HTTP method mismatch (GET/POST)',
          'Service temporarily unavailable'
        ];
        suggestions.diagnosticSteps = [
          '1. Run health_check to verify service connectivity',
          '2. Try get_current_user to verify authentication',  
          '3. Check if issue persists with other tools',
          '4. Contact administrator if availability service continues failing'
        ];
        break;

      case 'USER_PROFILE_ERROR':
        suggestions.actions.push({
          action: "Verify user profile and authentication",
          tool: "get_current_user",
          description: "Check if user profile exists and is properly configured"
        });
        suggestions.actions.push({
          action: "Run system health check",
          tool: "health_check",
          description: "Verify authentication and service connectivity",
          parameters: { verbose: true }
        });
        suggestions.workflows = ['System troubleshooting and diagnostics'];
        suggestions.commonCauses = [
          'User not properly registered in Matrix system',
          'Missing organization association', 
          'Insufficient user permissions',
          'Authentication token issues'
        ];
        suggestions.diagnosticSteps = [
          '1. Run get_current_user to verify user profile exists',
          '2. Check if user has proper organization association',
          '3. Verify user has booking permissions', 
          '4. Contact administrator for user setup assistance'
        ];
        break;

      case 'LOCATION_ERROR':
        if (toolContext === 'availability' || toolContext === 'booking' || toolContext === 'location') {
          suggestions.actions.push({
            action: "Explore available locations",
            tool: "get_locations",
            description: "Browse location hierarchy to find valid location IDs"
          });
          suggestions.actions.push({
            action: "Search for rooms with facilities",
            tool: "find_rooms_with_facilities", 
            description: "Find rooms using natural language instead of specific location IDs",
            parameters: { query: "meeting room" }
          });
        }
        suggestions.actions.push({
          action: "Get preferred location",
          tool: "matrix_booking_get_location",
          description: "Get details about default/preferred location"
        });
        suggestions.workflows = ['User wants to discover available spaces and facilities'];
        suggestions.commonCauses = [
          'Invalid location ID format',
          'Location not accessible to user',
          'Location name misspelled or not found',
          'Location ID below minimum threshold (100000)'
        ];
        suggestions.diagnosticSteps = [
          '1. Use get_locations to browse available locations',
          '2. Verify location ID is correct and ≥100000', 
          '3. Check if location name exists in your organization',
          '4. Try matrix_booking_get_location without parameters for preferred location'
        ];
        break;

      case 'TIMEOUT_ERROR':
        suggestions.actions.push({
          action: "Check system health",
          tool: "health_check",
          description: "Verify service availability and response times"
        });
        if (toolContext === 'availability') {
          suggestions.actions.push({
            action: "Try with shorter time range",
            tool: "matrix_booking_check_availability",
            description: "Reduce date range or specify specific location to improve performance",
            parameters: { duration: 60 }
          });
        }
        suggestions.workflows = ['System troubleshooting and diagnostics'];
        suggestions.commonCauses = [
          'Network connectivity issues',
          'Matrix API performance problems',
          'Large query size causing timeouts',
          'Peak usage times causing delays'
        ];
        suggestions.diagnosticSteps = [
          '1. Run health_check to verify service availability',
          '2. Try again with shorter time range or fewer parameters',
          '3. Check network connectivity to Matrix API',
          '4. Consider trying operation during off-peak hours'
        ];
        break;

      case 'AUTHENTICATION_ERROR':
        suggestions.actions.push({
          action: "Verify user authentication",
          tool: "get_current_user",
          description: "Test authentication status and user permissions"
        });
        suggestions.actions.push({
          action: "Run comprehensive health check",
          tool: "health_check", 
          description: "Check authentication configuration and service status",
          parameters: { verbose: true }
        });
        suggestions.workflows = ['System troubleshooting and diagnostics'];
        suggestions.commonCauses = [
          'Invalid or expired authentication credentials',
          'Authentication configuration issues',
          'User permissions insufficient for operation',
          'Session timeout or token refresh needed'
        ];
        suggestions.diagnosticSteps = [
          '1. Run health_check with verbose=true to see detailed error info',
          '2. Verify authentication configuration',
          '3. Check if credentials need to be refreshed',
          '4. Try get_current_user to test authentication'
        ];
        break;

      case 'NETWORK_ERROR':
        suggestions.actions.push({
          action: "Verify system connectivity",
          tool: "health_check",
          description: "Test network connectivity to Matrix API services" 
        });
        suggestions.workflows = ['System troubleshooting and diagnostics'];
        suggestions.commonCauses = [
          'Network connectivity issues',
          'Matrix API services unavailable',
          'Firewall or proxy blocking connections',
          'DNS resolution problems'
        ];
        suggestions.diagnosticSteps = [
          '1. Run health_check to verify service availability',
          '2. Check network connectivity to external services',
          '3. Verify firewall and proxy settings',
          '4. Contact network administrator if connectivity issues persist'
        ];
        break;

      case 'RATE_LIMIT_ERROR':
        suggestions.actions.push({
          action: "Wait and retry with exponential backoff",
          tool: toolContext === 'availability' ? "matrix_booking_check_availability" : "health_check",
          description: "Retry the operation after a brief wait to respect rate limits",
          parameters: toolContext === 'availability' ? { duration: 30 } : {}
        });
        suggestions.workflows = ['Rate limit recovery and retry strategies'];
        suggestions.commonCauses = [
          'Too many API requests in a short time period',
          'Concurrent operations exceeding API rate limits',
          'Bulk operations without proper throttling',
          'Peak usage times causing rate limit hits'
        ];
        suggestions.diagnosticSteps = [
          '1. Wait 30-60 seconds before retrying the operation',
          '2. Reduce the scope of your request (smaller date range, fewer locations)',
          '3. Implement exponential backoff for repeated requests',
          '4. Consider spreading requests over time during peak hours',
          '5. Check if other applications are making concurrent API calls'
        ];
        break;

      case 'SERVER_ERROR':
        suggestions.actions.push({
          action: "Verify service health and retry",
          tool: "health_check",
          description: "Check overall service status before retrying the operation",
          parameters: { verbose: true }
        });
        if (toolContext === 'booking') {
          suggestions.actions.push({
            action: "Check alternative booking approach",
            tool: "matrix_booking_check_availability",
            description: "Verify availability before retrying booking creation",
            parameters: { duration: 60 }
          });
        } else if (toolContext === 'availability') {
          suggestions.actions.push({
            action: "Try with simpler parameters",
            tool: "matrix_booking_check_availability",
            description: "Reduce complexity of availability request",
            parameters: { duration: 30 }
          });
        }
        suggestions.workflows = toolContext === 'availability' ? 
          ['System troubleshooting and diagnostics'] : 
          ['Server error recovery and retry strategies'];
        suggestions.commonCauses = [
          'Temporary server overload or maintenance',
          'Database connectivity issues',
          'Internal service configuration problems',
          'Upstream service failures'
        ];
        suggestions.diagnosticSteps = [
          '1. Wait 1-2 minutes and retry the operation',
          '2. Run health_check to verify overall service status',
          '3. Try a simpler operation first (like get_current_user)',
          '4. Check if the issue is specific to certain operations',
          '5. Contact support if server errors persist'
        ];
        break;

      case 'VALIDATION_ERROR':
        suggestions.actions.push({
          action: "Verify request parameters",
          tool: "get_tool_guidance",
          description: "Get specific parameter guidance for the failing tool",
          parameters: { intent: "parameter validation", context: `${toolContext} operation failed` }
        });
        if (toolContext === 'booking') {
          suggestions.actions.push({
            action: "Check availability first",
            tool: "matrix_booking_check_availability", 
            description: "Verify the time slot and location before booking",
            parameters: { duration: 60 }
          });
          suggestions.actions.push({
            action: "Verify location details",
            tool: "matrix_booking_get_location",
            description: "Ensure the location exists and is bookable"
          });
        }
        suggestions.workflows = ['Parameter validation and correction strategies'];
        suggestions.commonCauses = [
          'Invalid date or time format',
          'Missing required parameters',
          'Parameter values outside allowed ranges',
          'Conflicting parameter combinations'
        ];
        suggestions.diagnosticSteps = [
          '1. Check all required parameters are provided',
          '2. Verify date/time formats are correct (ISO 8601)',
          '3. Ensure numeric parameters are within valid ranges',
          '4. Check for conflicting parameter combinations',
          '5. Use get_tool_guidance for parameter examples'
        ];
        break;

      case 'PERMISSION_ERROR':
        suggestions.actions.push({
          action: "Verify user permissions",
          tool: "get_current_user",
          description: "Check user role and organization permissions"
        });
        suggestions.actions.push({
          action: "Check system health",
          tool: "health_check",
          description: "Verify authentication and authorization configuration",
          parameters: { verbose: true }
        });
        suggestions.workflows = ['Permission troubleshooting and access verification'];
        suggestions.commonCauses = [
          'Insufficient user permissions for the operation',
          'User not authorized for specific location or resource',
          'Organization-level access restrictions',
          'Role-based permission limitations'
        ];
        suggestions.diagnosticSteps = [
          '1. Run get_current_user to check user role and permissions',
          '2. Verify user has access to the specific location/resource',
          '3. Check if organization-level restrictions apply',
          '4. Try a less restrictive operation first',
          '5. Contact administrator for permission adjustments'
        ];
        break;

      case 'RESOURCE_NOT_FOUND':
        if (toolContext === 'location') {
          suggestions.actions.push({
            action: "Browse available locations",
            tool: "get_locations",
            description: "Explore location hierarchy to find valid locations"
          });
          suggestions.actions.push({
            action: "Search for locations",
            tool: "find_rooms_with_facilities",
            description: "Use search to find locations by name or features",
            parameters: { query: "meeting room" }
          });
        } else if (toolContext === 'booking') {
          suggestions.actions.push({
            action: "Check user bookings",
            tool: "get_user_bookings",
            description: "Verify which bookings exist for the user"
          });
        }
        suggestions.actions.push({
          action: "Get current user context",
          tool: "get_current_user",
          description: "Verify user organization and available resources"
        });
        suggestions.workflows = ['Resource discovery and validation'];
        suggestions.commonCauses = [
          'Resource ID does not exist or has been removed',
          'Resource not accessible to current user/organization',
          'Incorrect resource identifier format',
          'Resource exists but in different organization'
        ];
        suggestions.diagnosticSteps = [
          '1. Verify the resource ID format is correct',
          '2. Use browse/search tools to find available resources',
          '3. Check if resource exists in your organization',
          '4. Try accessing related or similar resources',
          '5. Contact administrator if resource should be accessible'
        ];
        break;

      case 'BOOKING_CONFLICT_ERROR':
        suggestions.actions.push({
          action: "Check availability around the requested time",
          tool: "matrix_booking_check_availability",
          description: "Find alternative time slots near your original request",
          parameters: { duration: 60 }
        });
        suggestions.actions.push({
          action: "View existing bookings",
          tool: "get_user_bookings",
          description: "Check your current bookings for conflicts"
        });
        suggestions.actions.push({
          action: "Find alternative locations",
          tool: "find_rooms_with_facilities",
          description: "Search for similar rooms that might be available",
          parameters: { query: "meeting room" }
        });
        suggestions.workflows = ['Booking conflict resolution and alternatives'];
        suggestions.commonCauses = [
          'Time slot already reserved by another booking',
          'Overlapping booking with existing reservation',
          'Location not available during requested time',
          'Double-booking attempt detected'
        ];
        suggestions.diagnosticSteps = [
          '1. Check availability for alternative time slots',
          '2. Review existing bookings that might conflict',
          '3. Search for similar locations that are available',
          '4. Consider adjusting booking duration or timing',
          '5. Contact meeting organizer to resolve scheduling conflicts'
        ];
        break;

      default:
        // Progressive fallback alternatives based on context
        if (toolContext === 'facility' || toolContext === 'search') {
          // Space discovery workflow fallbacks
          suggestions.actions.push({
            action: "Browse available locations hierarchically",
            tool: "get_locations",
            description: "Start with location hierarchy to understand available spaces"
          });
          suggestions.actions.push({
            action: "Try simplified facility search",
            tool: "find_rooms_with_facilities",
            description: "Use simpler keywords or try different search approach",
            parameters: { query: "room" }
          });
          suggestions.actions.push({
            action: "Check booking categories",
            tool: "get_booking_categories",
            description: "Explore available space types and categories"
          });
          suggestions.workflows = ['Progressive space discovery and facility search'];
        } else if (toolContext === 'booking') {
          // Booking workflow fallbacks
          suggestions.actions.push({
            action: "Verify availability first",
            tool: "matrix_booking_check_availability",
            description: "Check if the desired time slot is available",
            parameters: { duration: 60 }
          });
          suggestions.actions.push({
            action: "Review existing bookings",
            tool: "get_user_bookings",
            description: "Check current bookings for potential conflicts"
          });
          suggestions.actions.push({
            action: "Validate location accessibility",
            tool: "matrix_booking_get_location",
            description: "Ensure the location exists and is bookable"
          });
          suggestions.workflows = ['Booking validation and alternative planning'];
        } else if (toolContext === 'availability') {
          // Availability check fallbacks
          suggestions.actions.push({
            action: "Try simplified availability check",
            tool: "matrix_booking_check_availability",
            description: "Use basic parameters with shorter duration",
            parameters: { duration: 30 }
          });
          suggestions.actions.push({
            action: "Check location details",
            tool: "matrix_booking_get_location", 
            description: "Verify location exists and is accessible"
          });
          suggestions.actions.push({
            action: "Browse alternative locations",
            tool: "get_locations",
            description: "Find similar locations if primary choice unavailable"
          });
          suggestions.workflows = ['Availability troubleshooting and alternatives'];
        } else if (toolContext === 'guidance') {
          // Guidance tool fallbacks
          suggestions.actions.push({
            action: "Check system health for diagnostics",
            tool: "health_check",
            description: "Verify system status if guidance tool is failing",
            parameters: { verbose: true }
          });
          suggestions.actions.push({
            action: "Get user context for guidance",
            tool: "get_current_user",
            description: "Establish user context for better guidance"
          });
          suggestions.workflows = ['System troubleshooting and diagnostics'];
        } else {
          // Universal fallback workflow
          suggestions.actions.push({
            action: "Run comprehensive system diagnostic",
            tool: "health_check",
            description: "Check overall system health and connectivity",
            parameters: { verbose: true }
          });
          if (toolContext !== 'user') {
            suggestions.actions.push({
              action: "Verify user authentication and context",
              tool: "get_current_user",
              description: "Ensure user session and permissions are valid"
            });
          }
          suggestions.actions.push({
            action: "Get intelligent troubleshooting guidance",
            tool: "get_tool_guidance",
            description: "Get specific guidance for the failing operation",
            parameters: { context: `${toolContext} operation failed with unknown error` }
          });
          suggestions.workflows = ['Universal error diagnosis and recovery'];
        }
        
        suggestions.commonCauses = [
          'Unexpected system error or service disruption',
          'Service configuration or connectivity issue',
          'Invalid or malformed request parameters',
          'Temporary database or API service problems',
          'Network connectivity or timeout issues'
        ];
        suggestions.diagnosticSteps = [
          '1. Run health_check with verbose=true for comprehensive diagnostics',
          '2. Verify all required parameters are provided and correctly formatted',
          '3. Check user authentication and permissions with get_current_user',
          '4. Try a simplified version of the operation with minimal parameters',
          '5. Wait 30-60 seconds and retry the operation',
          '6. Use get_tool_guidance for specific troubleshooting advice',
          '7. Contact support with error details if problem persists'
        ];
    }

    // Handle cancel booking specific errors
    if (toolContext === 'cancel_booking') {
      switch (errorType) {
        case 'RESOURCE_NOT_FOUND':
          suggestions.actions.push({
            action: "Verify booking exists and get valid booking ID",
            tool: "get_user_bookings",
            description: "List your current bookings to find valid booking IDs to cancel"
          });
          suggestions.actions.push({
            action: "Check booking status",
            tool: "get_user_bookings",
            description: "Verify the booking hasn't already been cancelled",
            parameters: { status: 'ACTIVE' }
          });
          break;

        case 'PERMISSION_ERROR':
          suggestions.actions.push({
            action: "Check booking ownership",
            tool: "get_user_bookings",
            description: "Verify you own the booking you're trying to cancel"
          });
          suggestions.actions.push({
            action: "Contact booking owner for cancellation",
            tool: "get_tool_guidance",
            description: "Get guidance on booking ownership and cancellation permissions",
            parameters: { intent: "booking cancellation permissions" }
          });
          break;

        case 'BOOKING_CONFLICT_ERROR':
          suggestions.actions.push({
            action: "Check if booking already cancelled",
            tool: "get_user_bookings",
            description: "Verify current status of the booking",
            parameters: { status: 'CANCELLED' }
          });
          suggestions.actions.push({
            action: "Check if booking is in progress",
            tool: "get_user_bookings",
            description: "Active bookings may not be cancellable"
          });
          break;

        case 'VALIDATION_ERROR':
          suggestions.actions.push({
            action: "Get valid booking ID format",
            tool: "get_user_bookings",
            description: "Get properly formatted booking IDs from your booking list"
          });
          suggestions.actions.push({
            action: "Verify cancellation parameters",
            tool: "get_tool_guidance",
            description: "Get parameter validation guidance for booking cancellation",
            parameters: { intent: "cancel booking parameters" }
          });
          break;
      }

      // Common cancel booking suggestions
      suggestions.commonCauses.push(
        'Booking ID does not exist or is incorrect',
        'Booking already cancelled or completed',
        'User lacks permission to cancel booking',
        'Booking is currently in progress and cannot be cancelled'
      );

      suggestions.diagnosticSteps.push(
        '1. Use get_user_bookings to list your active bookings',
        '2. Verify the booking ID exists and is cancellable',
        '3. Check booking ownership and permissions',
        '4. Ensure booking is not already cancelled or in progress'
      );

      suggestions.workflows = ['Booking management and cancellation workflow'];
    }

    return suggestions;
  }

  private formatEnhancedError(error: unknown, toolName: string, toolContext: string): EnhancedMCPErrorResponse {
    const errorInfo = this.analyzeError(error);
    const suggestions = this.getErrorSuggestions(errorInfo.type, errorInfo.code, toolContext);
    
    const errorContext: MCPErrorContext = {
      suggestions: suggestions.actions,
      relatedWorkflows: suggestions.workflows,
      troubleshooting: {
        commonCauses: suggestions.commonCauses,
        diagnosticSteps: suggestions.diagnosticSteps
      }
    };
    
    if (errorInfo.httpStatus !== undefined) errorContext.httpStatus = errorInfo.httpStatus;
    if (errorInfo.code) errorContext.errorCode = errorInfo.code;
    if (errorInfo.type) errorContext.errorType = errorInfo.type;

    const enhancedMessage = {
      error: {
        message: errorInfo.message,
        code: errorInfo.code,
        httpStatus: errorInfo.httpStatus,
        context: toolContext,
        tool: toolName
      },
      suggestions: suggestions.actions,
      relatedWorkflows: suggestions.workflows,
      troubleshooting: {
        commonCauses: suggestions.commonCauses,
        diagnosticSteps: suggestions.diagnosticSteps
      }
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(enhancedMessage, null, 2)
      }],
      isError: true,
      errorContext
    };
  }

  async start(): Promise<void> {
    console.error('Matrix Booking MCP Server: Starting MCP server...');
    // The server will be connected via stdio transport by the runtime
  }

  async stop(): Promise<void> {
    console.error('Matrix Booking MCP Server: Stopping MCP server...');
    await this.server.close();
  }

  getServer(): Server {
    return this.server;
  }
}