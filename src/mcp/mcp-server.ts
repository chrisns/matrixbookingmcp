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

export class MatrixBookingMCPServer {
  private server: Server;
  private availabilityService: AvailabilityService;
  private bookingService: BookingService;
  private locationService: LocationService;

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

    this.bookingService = new BookingService(
      apiClient,
      authManager,
      configManager
    );

    this.locationService = new LocationService(
      apiClient,
      configManager,
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
          case 'matrix_booking_check_availability':
            return await this.handleCheckAvailability(args || {});
          
          case 'matrix_booking_create_booking':
            return await this.handleCreateBooking(args || {});
          
          case 'matrix_booking_get_location':
            return await this.handleGetLocation(args || {});
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`MCP Server error for tool ${name}:`, errorMessage);
        
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'matrix_booking_check_availability',
        description: 'Check room availability for a specific date range and location',
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
            duration: {
              type: 'number',
              description: 'Optional minimum duration in minutes for availability slots'
            }
          }
        }
      },
      {
        name: 'matrix_booking_create_booking',
        description: 'Create a new room booking in Matrix',
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
              description: 'The Matrix location ID for booking. Defaults to configured preferred location.'
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
        description: 'Get details about a specific Matrix location',
        inputSchema: {
          type: 'object',
          properties: {
            locationId: {
              type: 'number',
              description: 'The Matrix location ID to retrieve. If not provided, returns the preferred location.'
            }
          }
        }
      }
    ];
  }

  private async handleCheckAvailability(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling check availability request:', args);

    // Build request object with only defined values to avoid type issues
    const request: Partial<{ dateFrom: string; dateTo: string; locationId: number; duration: number }> = {};
    
    if (args['dateFrom']) {
      request.dateFrom = args['dateFrom'] as string;
    }
    if (args['dateTo']) {
      request.dateTo = args['dateTo'] as string;  
    }
    if (args['locationId']) {
      request.locationId = args['locationId'] as number;
    }
    if (args['duration']) {
      request.duration = args['duration'] as number;
    }

    const response = await this.availabilityService.checkAvailability(request);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  private async handleCreateBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling create booking request:', args);

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
    if (args['locationId']) {
      partialRequest.locationId = args['locationId'] as number;
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

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  private async handleGetLocation(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    console.error('MCP Server: Handling get location request:', args);

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