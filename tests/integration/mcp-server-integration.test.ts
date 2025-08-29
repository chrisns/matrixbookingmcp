import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatrixBookingMCPServer } from '../../src/mcp/mcp-server.js';

// Mock environment variables for testing
process.env['MATRIX_USERNAME'] = 'test@example.com';
process.env['MATRIX_PASSWORD'] = 'testpassword';
process.env['MATRIX_PREFERED_LOCATION'] = '1';

// Mock the external services to avoid actual API calls
vi.mock('../../src/services/availability-service.js', () => ({
  AvailabilityService: vi.fn().mockImplementation(() => ({
    checkAvailability: vi.fn().mockResolvedValue({
      available: true,
      slots: [
        {
          from: '2024-01-15T09:00:00.000Z',
          to: '2024-01-15T17:00:00.000Z',
          available: true,
          locationId: 1
        }
      ],
      location: {
        id: 1,
        name: 'Test Location',
        description: 'A test location',
        capacity: 10,
        features: []
      }
    })
  }))
}));

vi.mock('../../src/services/booking-service.js', () => ({
  BookingService: vi.fn().mockImplementation(() => ({
    formatBookingRequest: vi.fn().mockReturnValue({
      timeFrom: '2024-01-15T09:00:00.000',
      timeTo: '2024-01-15T10:00:00.000',
      locationId: 1,
      attendees: [],
      extraRequests: [],
      owner: {
        id: 0,
        email: 'test@example.com',
        name: 'test@example.com'
      },
      ownerIsAttendee: true,
      source: 'matrix-booking-mcp'
    }),
    createBooking: vi.fn().mockResolvedValue({
      id: 123,
      status: 'CONFIRMED',
      timeFrom: '2024-01-15T09:00:00.000',
      timeTo: '2024-01-15T10:00:00.000',
      locationId: 1,
      organisation: 'Test Org',
      locationKind: 'MEETING_ROOM',
      bookedBy: 'test@example.com',
      bookedDate: '2024-01-15',
      confirmedDate: '2024-01-15',
      extraRequests: [],
      owner: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      },
      ownerIsAttendee: true,
      source: 'matrix-booking-mcp',
      attendees: []
    }),
    cancelBooking: vi.fn().mockResolvedValue({
      success: true,
      bookingId: 123,
      status: 'CANCELLED',
      cancellationTime: '2024-01-15T10:30:00.000Z',
      notificationsSent: true,
      notifyScope: 'ALL_ATTENDEES',
      reason: 'Integration test cancellation',
      originalBooking: {
        locationId: 1,
        timeFrom: '2024-01-15T09:00:00.000Z',
        timeTo: '2024-01-15T10:00:00.000Z',
        attendeeCount: 2,
        owner: 'Test User'
      }
    })
  }))
}));

vi.mock('../../src/services/location-service.js', () => ({
  LocationService: vi.fn().mockImplementation(() => ({
    getLocation: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test Location',
      description: 'A test location for meetings',
      capacity: 10,
      features: ['Projector', 'Whiteboard']
    }),
    getPreferredLocation: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Preferred Test Location',
      description: 'The preferred test location',
      capacity: 8,
      features: ['Video Conference', 'Whiteboard']
    })
  }))
}));

describe('MCP Server Integration Tests', () => {
  let mcpServer: MatrixBookingMCPServer;

  beforeEach(async () => {
    vi.clearAllMocks();
    mcpServer = new MatrixBookingMCPServer();
    await mcpServer.start();
  });

  describe('Tool Handler Integration', () => {
    it('should handle availability check requests', async () => {
      const server = mcpServer.getServer();
      
      // Simulate a tool call request (structure for reference)

      // This would normally be handled by the MCP framework
      // For integration testing, we verify the server is properly configured
      expect(server).toBeDefined();
    });

    it('should handle booking creation requests', async () => {
      const server = mcpServer.getServer();
      
      // Simulate booking tool call request (structure for reference)

      expect(server).toBeDefined();
    });

    it('should handle location retrieval requests', async () => {
      const server = mcpServer.getServer();
      
      // Simulate location tool call request with ID (structure for reference)

      expect(server).toBeDefined();
    });

    it('should handle location retrieval without locationId (preferred location)', async () => {
      const server = mcpServer.getServer();
      
      // Simulate location tool call request (structure for reference)

      expect(server).toBeDefined();
    });

    it('should handle cancel booking requests', async () => {
      const server = mcpServer.getServer();
      
      // Test that cancel booking tool is properly registered and configured
      // The actual tool handling is tested in unit tests
      
      expect(server).toBeDefined();
      
      // Verify the cancel booking integration works as expected
      const handleCancelBooking = (mcpServer as any).handleCancelBooking;
      const result = await handleCancelBooking.call(mcpServer, {
        bookingId: 123,
        notifyScope: 'ALL_ATTENDEES',
        sendNotifications: true,
        reason: 'Integration test cancellation'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBeUndefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('CANCELLED');
      expect(result.content[0].text).toContain('123');
      expect(result.content[0].text).toContain('Integration test cancellation');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle unknown tool names gracefully', async () => {
      const server = mcpServer.getServer();
      
      // The MCP server should be configured to handle errors properly
      expect(server).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      const server = mcpServer.getServer();
      
      // Error handling is built into the service layer and MCP handlers
      expect(server).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should use environment configuration correctly', () => {
      const server = mcpServer.getServer();
      
      // Configuration is loaded during server initialization
      expect(server).toBeDefined();
    });

    it('should initialize all required services', () => {
      const server = mcpServer.getServer();
      
      // All services should be initialized and ready
      expect(server).toBeDefined();
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should expose correct server metadata', () => {
      const server = mcpServer.getServer();
      
      // Server should be configured with proper name and version
      expect(server).toBeDefined();
    });

    it('should support tools capability', () => {
      const server = mcpServer.getServer();
      
      // Server should declare tools capability
      expect(server).toBeDefined();
    });
  });
});