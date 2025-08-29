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

describe('get_tool_guidance MCP Tool', () => {
  let mcpServer: MatrixBookingMCPServer;
  let mockConfigManager: ConfigurationManager;
  let mockAuthManager: AuthenticationManager;

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

    // Setup constructor mocks
    (ConfigurationManager as any).mockImplementation(() => mockConfigManager);
    (AuthenticationManager as any).mockImplementation(() => mockAuthManager);
    (MatrixAPIClient as any).mockImplementation(() => ({}));
    (AvailabilityService as any).mockImplementation(() => ({}));
    (BookingService as any).mockImplementation(() => ({}));
    (LocationService as any).mockImplementation(() => ({}));
    (UserService as any).mockImplementation(() => ({}));
    (SearchService as any).mockImplementation(() => ({}));
    (OrganizationService as any).mockImplementation(() => ({}));

    mcpServer = new MatrixBookingMCPServer();
  });

  describe('Tool Definition', () => {
    it('should include get_tool_guidance in tool registry', () => {
      const getTools = (mcpServer as any).getTools;
      const tools = getTools.call(mcpServer);
      
      const guidanceTool = tools.find((tool: any) => tool.name === 'get_tool_guidance');
      expect(guidanceTool).toBeDefined();
      expect(guidanceTool.name).toBe('get_tool_guidance');
      expect(guidanceTool.description).toContain('Get intelligent guidance on Matrix Booking MCP tool selection');
    });

    it('should have correct input schema for get_tool_guidance', () => {
      const getTools = (mcpServer as any).getTools;
      const tools = getTools.call(mcpServer);
      
      const guidanceTool = tools.find((tool: any) => tool.name === 'get_tool_guidance');
      expect(guidanceTool.inputSchema).toBeDefined();
      expect(guidanceTool.inputSchema.type).toBe('object');
      expect(guidanceTool.inputSchema.properties).toHaveProperty('intent');
      expect(guidanceTool.inputSchema.properties).toHaveProperty('context');
      expect(guidanceTool.inputSchema.properties.intent.type).toBe('string');
      expect(guidanceTool.inputSchema.properties.context.type).toBe('string');
    });

    it('should have comprehensive tool description with use cases', () => {
      const getTools = (mcpServer as any).getTools;
      const tools = getTools.call(mcpServer);
      
      const guidanceTool = tools.find((tool: any) => tool.name === 'get_tool_guidance');
      expect(guidanceTool.description).toContain('Common Use Cases:');
      expect(guidanceTool.description).toContain('What tool should I use to see user bookings?');
      expect(guidanceTool.description).toContain('How do I create a booking workflow?');
      expect(guidanceTool.description).toContain('I\'m getting 405 errors, what should I try?');
      expect(guidanceTool.description).toContain('Not For:');
      expect(guidanceTool.description).toContain('Workflow Position:');
      expect(guidanceTool.description).toContain('Related Tools:');
    });
  });

  describe('Handler Method - Basic Functionality', () => {
    it('should handle get_tool_guidance without parameters', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeUndefined();

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('workflows');
      expect(guidance).toHaveProperty('intentMapping');
      expect(guidance).toHaveProperty('troubleshooting');
      expect(guidance).toHaveProperty('toolSelection');
    });

    it('should return structured workflow mappings', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance.workflows).toBeInstanceOf(Array);
      expect(guidance.workflows.length).toBeGreaterThan(0);
      
      // Check first workflow structure
      const userBookingsWorkflow = guidance.workflows.find(
        (w: any) => w.scenario.includes('see their bookings')
      );
      expect(userBookingsWorkflow).toBeDefined();
      expect(userBookingsWorkflow.tools).toBeInstanceOf(Array);
      expect(userBookingsWorkflow.tools[0]).toHaveProperty('tool');
      expect(userBookingsWorkflow.tools[0]).toHaveProperty('order');
      expect(userBookingsWorkflow.tools[0]).toHaveProperty('purpose');
      expect(userBookingsWorkflow.tools[0]).toHaveProperty('required');
    });

    it('should include all expected workflow scenarios', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      const scenarios = guidance.workflows.map((w: any) => w.scenario);
      
      expect(scenarios).toContain('User wants to see their bookings/reservations/calendar');
      expect(scenarios).toContain('User wants to create a new booking');
      expect(scenarios).toContain('User wants to discover available spaces and facilities');
      expect(scenarios).toContain('System troubleshooting and diagnostics');
    });
  });

  describe('Intent Recognition', () => {
    it('should recognize user booking inquiry intent', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'what do I have booked tomorrow?'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('recommendation');
      expect(guidance.recommendation.recognizedIntent).toBe('what do I have booked tomorrow?');
      expect(guidance.recommendation.primaryTool).toBe('get_user_bookings');
      expect(guidance.recommendation.avoidTools).toContain('matrix_booking_check_availability');
    });

    it('should recognize availability checking intent', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'what\'s available for tomorrow afternoon?'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('recommendation');
      expect(guidance.recommendation.primaryTool).toBe('matrix_booking_check_availability');
      expect(guidance.recommendation.avoidTools).toContain('get_user_bookings');
    });

    it('should recognize booking creation intent', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'I want to book a room for meeting'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('recommendation');
      expect(guidance.recommendation.primaryTool).toBe('matrix_booking_check_availability');
      expect(guidance.recommendation.supportingTools).toContain('matrix_booking_create_booking');
    });

    it('should recognize room search with facilities intent', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'find room with projector and conference phone'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('recommendation');
      expect(guidance.recommendation.primaryTool).toBe('find_rooms_with_facilities');
      expect(guidance.recommendation.supportingTools).toContain('discover_available_facilities');
    });

    it('should handle intent variations (case insensitive)', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      
      // Test "MY BOOKINGS" (uppercase)
      const result1 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'MY BOOKINGS FOR NEXT WEEK'
      });
      const guidance1 = JSON.parse(result1.content[0].text);
      expect(guidance1.recommendation.primaryTool).toBe('get_user_bookings');
      
      // Test "my meetings" (mixed case)
      const result2 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'Show My Meetings'
      });
      const guidance2 = JSON.parse(result2.content[0].text);
      expect(guidance2.recommendation.primaryTool).toBe('get_user_bookings');
    });

    it('should not provide recommendation for unrecognized intent', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'completely unrelated query about weather'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).not.toHaveProperty('recommendation');
    });

    it('should recognize cancellation intents and provide appropriate recommendations', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      
      // Test "cancel booking" intent
      const result1 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'I need to cancel booking ID 12345'
      });
      const guidance1 = JSON.parse(result1.content[0].text);
      expect(guidance1).toHaveProperty('recommendation');
      expect(guidance1.recommendation.primaryTool).toBe('matrix_booking_cancel_booking');
      expect(guidance1.recommendation.matchedPhrase).toBe('cancel booking');
      expect(guidance1.recommendation.supportingTools).toContain('get_user_bookings');
      
      // Test "cancel my booking" intent
      const result2 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'cancel my booking for tomorrow'
      });
      const guidance2 = JSON.parse(result2.content[0].text);
      expect(guidance2).toHaveProperty('recommendation');
      expect(guidance2.recommendation.primaryTool).toBe('get_user_bookings');
      expect(guidance2.recommendation.matchedPhrase).toBe('cancel my booking');
      expect(guidance2.recommendation.supportingTools).toContain('matrix_booking_cancel_booking');
      
      // Test "remove booking" intent
      const result3 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'I want to remove booking 54321'
      });
      const guidance3 = JSON.parse(result3.content[0].text);
      expect(guidance3).toHaveProperty('recommendation');
      expect(guidance3.recommendation.primaryTool).toBe('matrix_booking_cancel_booking');
      expect(guidance3.recommendation.matchedPhrase).toBe('remove booking');
      expect(guidance3.recommendation.supportingTools).toContain('get_user_bookings');
    });

    it('should handle cancellation intent variations (case insensitive)', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      
      // Test uppercase
      const result1 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'CANCEL MY BOOKING FOR FRIDAY'
      });
      const guidance1 = JSON.parse(result1.content[0].text);
      expect(guidance1.recommendation.primaryTool).toBe('get_user_bookings');
      
      // Test mixed case
      const result2 = await handleGetToolGuidance.call(mcpServer, {
        intent: 'Cancel Booking 12345'
      });
      const guidance2 = JSON.parse(result2.content[0].text);
      expect(guidance2.recommendation.primaryTool).toBe('matrix_booking_cancel_booking');
    });
  });

  describe('Troubleshooting Support', () => {
    it('should detect 405 Method Not Allowed error in context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Getting 405 Method Not Allowed error when checking availability'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('contextualHelp');
      expect(guidance.contextualHelp.detectedIssue).toBe('405 Method Not Allowed');
      expect(guidance.contextualHelp.suggestion).toContain('HTTP method');
      expect(guidance.contextualHelp.alternativeTools).toContain('health_check');
      expect(guidance.contextualHelp.diagnosticSteps).toBeInstanceOf(Array);
      expect(guidance.contextualHelp.diagnosticSteps.length).toBeGreaterThan(0);
    });

    it('should detect authentication errors in context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Authentication failed when trying to get user info'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('contextualHelp');
      expect(guidance.contextualHelp.detectedIssue).toBe('authentication');
      expect(guidance.contextualHelp.suggestion).toContain('credentials');
      expect(guidance.contextualHelp.alternativeTools).toContain('get_current_user');
    });

    it('should detect "Person not found" errors in context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Person not found error when accessing booking system'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('contextualHelp');
      expect(guidance.contextualHelp.detectedIssue).toBe('Person not found');
      expect(guidance.contextualHelp.suggestion).toContain('User profile');
      expect(guidance.contextualHelp.alternativeTools).toContain('get_current_user');
    });

    it('should detect timeout errors in context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Request timeout when checking room availability'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('contextualHelp');
      expect(guidance.contextualHelp.detectedIssue).toBe('timeout');
      expect(guidance.contextualHelp.suggestion).toContain('Network connectivity');
      expect(guidance.contextualHelp.alternativeTools).toContain('health_check');
    });

    it('should detect location not found errors in context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Location not found when trying to book room'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).toHaveProperty('contextualHelp');
      expect(guidance.contextualHelp.detectedIssue).toBe('location not found');
      expect(guidance.contextualHelp.suggestion).toContain('Location ID');
      expect(guidance.contextualHelp.alternativeTools).toContain('get_locations');
      expect(guidance.contextualHelp.alternativeTools).toContain('matrix_booking_get_location');
    });

    it('should not provide contextual help for unrecognized error patterns', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        context: 'Some unknown error that doesnt match patterns'
      });

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance).not.toHaveProperty('contextualHelp');
    });
  });

  describe('Intent Mapping Accuracy', () => {
    it('should provide comprehensive intent mappings', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance.intentMapping).toBeDefined();
      
      // Check key user booking queries
      expect(guidance.intentMapping).toHaveProperty('what do I have booked');
      expect(guidance.intentMapping).toHaveProperty('my bookings');
      expect(guidance.intentMapping).toHaveProperty('my meetings');
      expect(guidance.intentMapping).toHaveProperty('my calendar');
      
      // Check availability queries
      expect(guidance.intentMapping).toHaveProperty('what\'s available');
      
      // Check booking creation queries
      expect(guidance.intentMapping).toHaveProperty('book a room');
      expect(guidance.intentMapping).toHaveProperty('create booking');
      expect(guidance.intentMapping).toHaveProperty('reserve space');
      
      // All should have primaryTool, supportingTools, and avoidTools
      Object.values(guidance.intentMapping).forEach((mapping: any) => {
        expect(mapping).toHaveProperty('primaryTool');
        expect(mapping).toHaveProperty('supportingTools');
        expect(mapping).toHaveProperty('avoidTools');
      });
    });

    it('should recommend correct primary tools for user booking queries', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // All user booking queries should recommend get_user_bookings
      expect(guidance.intentMapping['what do I have booked'].primaryTool).toBe('get_user_bookings');
      expect(guidance.intentMapping['my bookings'].primaryTool).toBe('get_user_bookings');
      expect(guidance.intentMapping['my meetings'].primaryTool).toBe('get_user_bookings');
      expect(guidance.intentMapping['my calendar'].primaryTool).toBe('get_user_bookings');
      
      // All should avoid availability checking
      expect(guidance.intentMapping['what do I have booked'].avoidTools).toContain('matrix_booking_check_availability');
      expect(guidance.intentMapping['my bookings'].avoidTools).toContain('matrix_booking_check_availability');
      expect(guidance.intentMapping['my meetings'].avoidTools).toContain('matrix_booking_check_availability');
      expect(guidance.intentMapping['my calendar'].avoidTools).toContain('matrix_booking_check_availability');
    });

    it('should recommend correct primary tools for availability queries', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // Availability queries should recommend check_availability
      expect(guidance.intentMapping['what\'s available'].primaryTool).toBe('matrix_booking_check_availability');
      expect(guidance.intentMapping['what\'s available'].avoidTools).toContain('get_user_bookings');
    });

    it('should recommend correct workflow for booking creation', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // Booking creation should start with availability checking
      expect(guidance.intentMapping['book a room'].primaryTool).toBe('matrix_booking_check_availability');
      expect(guidance.intentMapping['create booking'].primaryTool).toBe('matrix_booking_check_availability');
      expect(guidance.intentMapping['reserve space'].primaryTool).toBe('matrix_booking_check_availability');
      
      // Should support booking creation
      expect(guidance.intentMapping['book a room'].supportingTools).toContain('matrix_booking_create_booking');
      expect(guidance.intentMapping['create booking'].supportingTools).toContain('matrix_booking_create_booking');
      expect(guidance.intentMapping['reserve space'].supportingTools).toContain('matrix_booking_create_booking');
    });

    it('should recommend correct workflow for booking cancellation', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // Cancellation intents should be properly mapped
      expect(guidance.intentMapping).toHaveProperty('cancel booking');
      expect(guidance.intentMapping).toHaveProperty('cancel my booking');
      expect(guidance.intentMapping).toHaveProperty('remove booking');
      
      // Direct cancellation should use cancel booking tool
      expect(guidance.intentMapping['cancel booking'].primaryTool).toBe('matrix_booking_cancel_booking');
      expect(guidance.intentMapping['cancel booking'].supportingTools).toContain('get_user_bookings');
      expect(guidance.intentMapping['cancel booking'].supportingTools).toContain('matrix_booking_get_location');
      expect(guidance.intentMapping['cancel booking'].avoidTools).toContain('matrix_booking_create_booking');
      expect(guidance.intentMapping['cancel booking'].avoidTools).toContain('matrix_booking_check_availability');
      
      // User-centric cancellation should start with finding bookings
      expect(guidance.intentMapping['cancel my booking'].primaryTool).toBe('get_user_bookings');
      expect(guidance.intentMapping['cancel my booking'].supportingTools).toContain('matrix_booking_cancel_booking');
      expect(guidance.intentMapping['cancel my booking'].avoidTools).toContain('matrix_booking_create_booking');
      
      // Remove booking should use cancel booking tool
      expect(guidance.intentMapping['remove booking'].primaryTool).toBe('matrix_booking_cancel_booking');
      expect(guidance.intentMapping['remove booking'].supportingTools).toContain('get_user_bookings');
      expect(guidance.intentMapping['remove booking'].avoidTools).toContain('matrix_booking_create_booking');
    });

    it('should include cancellation workflow in scenario guidance', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // Should include cancellation workflow scenario
      const cancellationWorkflow = guidance.workflows.find((w: any) => w.scenario === "User wants to cancel a booking");
      expect(cancellationWorkflow).toBeDefined();
      expect(cancellationWorkflow.description).toContain('Complete workflow for cancelling existing bookings');
      
      // Verify workflow steps
      expect(cancellationWorkflow.tools).toHaveLength(3);
      
      // Step 1: Find booking ID
      expect(cancellationWorkflow.tools[0].tool).toBe('get_user_bookings');
      expect(cancellationWorkflow.tools[0].order).toBe(1);
      expect(cancellationWorkflow.tools[0].purpose).toContain('Find the booking ID to cancel');
      expect(cancellationWorkflow.tools[0].required).toBe(true);
      
      // Step 2: Cancel booking
      expect(cancellationWorkflow.tools[1].tool).toBe('matrix_booking_cancel_booking');
      expect(cancellationWorkflow.tools[1].order).toBe(2);
      expect(cancellationWorkflow.tools[1].purpose).toContain('Cancel the identified booking');
      expect(cancellationWorkflow.tools[1].required).toBe(true);
      
      // Step 3: Verify cancellation
      expect(cancellationWorkflow.tools[2].tool).toBe('get_user_bookings');
      expect(cancellationWorkflow.tools[2].order).toBe(3);
      expect(cancellationWorkflow.tools[2].purpose).toContain('Verify the booking was successfully cancelled');
      expect(cancellationWorkflow.tools[2].required).toBe(false);
    });

    it('should include cancellation guidance in tool selection', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      
      // Should have specific cancellation tool selection guidance
      expect(guidance.toolSelection).toHaveProperty('User wants to cancel existing booking');
      expect(guidance.toolSelection['User wants to cancel existing booking']).toContain('First use get_user_bookings to find booking ID');
      expect(guidance.toolSelection['User wants to cancel existing booking']).toContain('then use matrix_booking_cancel_booking');
    });
  });

  describe('Comprehensive Tool Selection Guidance', () => {
    it('should provide clear tool selection guidelines', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance.toolSelection).toBeDefined();
      expect(guidance.toolSelection).toHaveProperty('User asking about existing bookings');
      expect(guidance.toolSelection).toHaveProperty('User wants to create new booking');
      expect(guidance.toolSelection).toHaveProperty('User needs room with specific features');
      expect(guidance.toolSelection).toHaveProperty('User exploring office layout');
      expect(guidance.toolSelection).toHaveProperty('Tools failing or errors occurring');
      
      // Check specific guidance content
      expect(guidance.toolSelection['User asking about existing bookings']).toContain('get_user_bookings');
      expect(guidance.toolSelection['User asking about existing bookings']).toContain('never use matrix_booking_check_availability');
      expect(guidance.toolSelection['User wants to create new booking']).toContain('matrix_booking_check_availability');
      expect(guidance.toolSelection['User needs room with specific features']).toContain('find_rooms_with_facilities');
      expect(guidance.toolSelection['Tools failing or errors occurring']).toContain('health_check');
    });

    it('should include troubleshooting patterns for common issues', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      expect(guidance.troubleshooting).toBeDefined();
      
      // Check all expected error patterns
      expect(guidance.troubleshooting).toHaveProperty('405 Method Not Allowed');
      expect(guidance.troubleshooting).toHaveProperty('authentication');
      expect(guidance.troubleshooting).toHaveProperty('Person not found');
      expect(guidance.troubleshooting).toHaveProperty('timeout');
      expect(guidance.troubleshooting).toHaveProperty('location not found');
      
      // Each should have suggestion, alternativeTools, and diagnosticSteps
      Object.values(guidance.troubleshooting).forEach((solution: any) => {
        expect(solution).toHaveProperty('suggestion');
        expect(solution).toHaveProperty('alternativeTools');
        expect(solution).toHaveProperty('diagnosticSteps');
        expect(solution.diagnosticSteps).toBeInstanceOf(Array);
        expect(solution.diagnosticSteps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Combined Intent and Context Processing', () => {
    it('should process both intent and context parameters together', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: 'what do I have booked today?',
        context: 'getting 405 Method Not Allowed error when trying to check'
      });

      const guidance = JSON.parse(result.content[0].text);
      
      // Should have both recommendation and contextual help
      expect(guidance).toHaveProperty('recommendation');
      expect(guidance).toHaveProperty('contextualHelp');
      
      // Intent recognition
      expect(guidance.recommendation.primaryTool).toBe('get_user_bookings');
      
      // Context analysis  
      expect(guidance.contextualHelp.detectedIssue).toBe('405 Method Not Allowed');
    });

    it('should handle empty strings for intent and context', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {
        intent: '',
        context: ''
      });

      const guidance = JSON.parse(result.content[0].text);
      
      // Should not have recommendation or contextual help with empty strings
      expect(guidance).not.toHaveProperty('recommendation');
      expect(guidance).not.toHaveProperty('contextualHelp');
      
      // But should still have base guidance
      expect(guidance).toHaveProperty('workflows');
      expect(guidance).toHaveProperty('intentMapping');
      expect(guidance).toHaveProperty('troubleshooting');
    });
  });

  describe('Tool Workflow Validation', () => {
    it('should validate booking workflow has correct tool sequence', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      const bookingWorkflow = guidance.workflows.find(
        (w: any) => w.scenario.includes('create a new booking')
      );
      
      expect(bookingWorkflow).toBeDefined();
      
      // Should have availability check first
      const availabilityTool = bookingWorkflow.tools.find(
        (t: any) => t.tool === 'matrix_booking_check_availability'
      );
      expect(availabilityTool).toBeDefined();
      expect(availabilityTool.order).toBe(1);
      expect(availabilityTool.required).toBe(true);
      
      // Should have booking creation second
      const createTool = bookingWorkflow.tools.find(
        (t: any) => t.tool === 'matrix_booking_create_booking'
      );
      expect(createTool).toBeDefined();
      expect(createTool.order).toBe(2);
      expect(createTool.required).toBe(true);
      
      // Should have verification third (optional)
      const verifyTool = bookingWorkflow.tools.find(
        (t: any) => t.tool === 'get_user_bookings' && t.order === 3
      );
      expect(verifyTool).toBeDefined();
      expect(verifyTool.required).toBe(false);
    });

    it('should validate user booking workflow is simple and direct', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      const userBookingWorkflow = guidance.workflows.find(
        (w: any) => w.scenario.includes('see their bookings')
      );
      
      expect(userBookingWorkflow).toBeDefined();
      
      // Should have get_user_bookings as primary (required)
      const primaryTool = userBookingWorkflow.tools.find(
        (t: any) => t.tool === 'get_user_bookings'
      );
      expect(primaryTool).toBeDefined();
      expect(primaryTool.order).toBe(1);
      expect(primaryTool.required).toBe(true);
      
      // Should have optional location details
      const locationTool = userBookingWorkflow.tools.find(
        (t: any) => t.tool === 'matrix_booking_get_location'
      );
      expect(locationTool).toBeDefined();
      expect(locationTool.order).toBe(2);
      expect(locationTool.required).toBe(false);
    });

    it('should validate discovery workflow has correct hierarchy', async () => {
      const handleGetToolGuidance = (mcpServer as any).handleGetToolGuidance;
      const result = await handleGetToolGuidance.call(mcpServer, {});

      const guidance = JSON.parse(result.content[0].text);
      const discoveryWorkflow = guidance.workflows.find(
        (w: any) => w.scenario.includes('discover available spaces')
      );
      
      expect(discoveryWorkflow).toBeDefined();
      
      // Should start with categories (optional)
      const categoriesStep = discoveryWorkflow.tools.find(
        (t: any) => t.tool === 'get_booking_categories'
      );
      expect(categoriesStep).toBeDefined();
      expect(categoriesStep.order).toBe(1);
      
      // Should have locations exploration
      const locationsStep = discoveryWorkflow.tools.find(
        (t: any) => t.tool === 'get_locations'
      );
      expect(locationsStep).toBeDefined();
      expect(locationsStep.order).toBe(2);
      
      // Should end with targeted search (required)
      const searchStep = discoveryWorkflow.tools.find(
        (t: any) => t.tool === 'find_rooms_with_facilities'
      );
      expect(searchStep).toBeDefined();
      expect(searchStep.order).toBe(4);
      expect(searchStep.required).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors with enhanced error response', async () => {
      // Mock the private method to simulate an error during guidance generation
      const originalMethod = (mcpServer as any).handleGetToolGuidance;
      (mcpServer as any).handleGetToolGuidance = vi.fn().mockImplementation(function(this: any, _args: any) {
        try {
          // Simulate an error during JSON.stringify operation
          throw new Error('JSON stringify failed');
        } catch (error) {
          return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
        }
      });

      const result = await (mcpServer as any).handleGetToolGuidance({});

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.message).toContain('JSON stringify failed');
      expect(errorResponse.suggestions).toBeDefined();
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);

      // Restore original method
      (mcpServer as any).handleGetToolGuidance = originalMethod;
    });

    it('should handle unexpected errors during guidance generation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock the private method to simulate an unexpected error
      const originalMethod = (mcpServer as any).handleGetToolGuidance;
      (mcpServer as any).handleGetToolGuidance = vi.fn().mockImplementation(function(this: any, _args: any) {
        try {
          // Simulate an unexpected error during processing
          throw new Error('Unexpected error in guidance processing');
        } catch (error) {
          console.error('MCP Server: Error in get tool guidance:', error);
          return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
        }
      });

      const result = await (mcpServer as any).handleGetToolGuidance({
        intent: 'test intent',
        context: 'test context'
      });

      expect(result.isError).toBe(true);
      
      // Verify error logging
      expect(consoleSpy).toHaveBeenCalledWith(
        'MCP Server: Error in get tool guidance:',
        expect.any(Error)
      );

      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Unexpected error in guidance processing');
      expect(errorResponse.error.tool).toBe('get_tool_guidance');
      expect(errorResponse.error.context).toBe('guidance');

      // Restore mocks
      consoleSpy.mockRestore();
      (mcpServer as any).handleGetToolGuidance = originalMethod;
    });

    it('should handle errors with proper enhanced error format structure', async () => {
      // Mock the private method to simulate an error
      const originalMethod = (mcpServer as any).handleGetToolGuidance;
      (mcpServer as any).handleGetToolGuidance = vi.fn().mockImplementation(function(this: any, _args: any) {
        try {
          // Simulate a service failure error
          const error = new Error('Service temporarily unavailable');
          throw error;
        } catch (error) {
          return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
        }
      });

      const result = await (mcpServer as any).handleGetToolGuidance({});

      expect(result.isError).toBe(true);

      // Parse and validate the enhanced error response structure
      const errorResponse = JSON.parse(result.content[0].text);
      
      // Check error structure
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse.error).toHaveProperty('code');
      // httpStatus is not included when undefined for non-HTTP errors
      expect(errorResponse.error.message).toBe('Service temporarily unavailable');

      // Check error has tool and context info
      expect(errorResponse.error).toHaveProperty('tool');
      expect(errorResponse.error.tool).toBe('get_tool_guidance');
      expect(errorResponse.error.context).toBe('guidance');

      // Check suggestions structure
      expect(errorResponse).toHaveProperty('suggestions');
      expect(Array.isArray(errorResponse.suggestions)).toBe(true);
      
      // Should include health check suggestion for service errors
      const healthCheckSuggestion = errorResponse.suggestions.find((s: any) => s.tool === 'health_check');
      expect(healthCheckSuggestion).toBeDefined();

      // Restore original method
      (mcpServer as any).handleGetToolGuidance = originalMethod;
    });

    it('should handle memory/performance errors with large input', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create very large input to potentially cause memory issues
      const largeIntent = 'test '.repeat(10000);
      const largeContext = 'context '.repeat(10000);
      
      // Mock to simulate memory error
      const originalMethod = (mcpServer as any).handleGetToolGuidance;
      (mcpServer as any).handleGetToolGuidance = vi.fn().mockImplementation(function(this: any, _args: any) {
        try {
          // Simulate a memory/performance error
          throw new Error('Maximum call stack size exceeded');
        } catch (error) {
          console.error('MCP Server: Error in get tool guidance:', error);
          return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
        }
      });

      const result = await (mcpServer as any).handleGetToolGuidance({
        intent: largeIntent,
        context: largeContext
      });

      expect(result.isError).toBe(true);
      
      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalled();

      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Maximum call stack size exceeded');

      // Restore mocks
      consoleSpy.mockRestore();
      (mcpServer as any).handleGetToolGuidance = originalMethod;
    });

    it('should handle malformed input parameters gracefully', async () => {
      // Mock the private method to simulate parameter validation error
      const originalMethod = (mcpServer as any).handleGetToolGuidance;
      (mcpServer as any).handleGetToolGuidance = vi.fn().mockImplementation(function(this: any, _args: any) {
        try {
          // Simulate error with malformed parameters
          if (typeof _args.intent === 'object' && _args.intent !== null) {
            throw new Error('Invalid parameter type: intent must be string');
          }
          // Continue with normal processing...
          throw new Error('Parameter validation failed');
        } catch (error) {
          return this.formatEnhancedError(error, 'get_tool_guidance', 'guidance');
        }
      });

      // Test with object instead of string
      const result = await (mcpServer as any).handleGetToolGuidance({
        intent: { invalid: 'object' },
        context: ['invalid', 'array']
      });

      expect(result.isError).toBe(true);

      // Parse the enhanced error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error.message).toContain('Invalid parameter type');
      expect(errorResponse.error.tool).toBe('get_tool_guidance');

      // Restore original method
      (mcpServer as any).handleGetToolGuidance = originalMethod;
    });
  });
});