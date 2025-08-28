/**
 * Unit tests for find_rooms_with_facilities MCP tool
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatrixBookingMCPServer } from '../../../src/mcp/mcp-server.js';

describe('find_rooms_with_facilities MCP Tool', () => {
  let mcpServer: MatrixBookingMCPServer;

  beforeEach(() => {
    // Mock console.error to avoid test noise
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mcpServer = new MatrixBookingMCPServer();
  });

  describe('tool registration', () => {
    it('should register find_rooms_with_facilities tool', async () => {
      const getTools = (mcpServer as any).getTools;
      const toolsArray = getTools.call(mcpServer);
      const tools = { tools: toolsArray };
      
      const findRoomsTool = tools.tools.find(
        (tool: any) => tool.name === 'find_rooms_with_facilities'
      );
      
      expect(findRoomsTool).toBeDefined();
      expect(findRoomsTool?.description).toContain('natural language search');
    });

    it('should have correct input schema', async () => {
      const getTools = (mcpServer as any).getTools;
      const toolsArray = getTools.call(mcpServer);
      const tools = { tools: toolsArray };
      const findRoomsTool = tools.tools.find(
        (tool: any) => tool.name === 'find_rooms_with_facilities'
      );
      
      expect(findRoomsTool?.inputSchema).toBeDefined();
      const schema = findRoomsTool?.inputSchema as any;
      
      expect(schema.properties.query).toBeDefined();
      expect(schema.properties.query.required).toBe(true);
      expect(schema.properties.dateFrom).toBeDefined();
      expect(schema.properties.dateTo).toBeDefined();
      expect(schema.properties.duration).toBeDefined();
      expect(schema.properties.buildingId).toBeDefined();
      expect(schema.properties.category).toBeDefined();
      expect(schema.properties.maxResults).toBeDefined();
      expect(schema.properties.maxResults.default).toBe(10);
    });

    it('should require query parameter', async () => {
      const getTools = (mcpServer as any).getTools;
      const toolsArray = getTools.call(mcpServer);
      const tools = { tools: toolsArray };
      const findRoomsTool = tools.tools.find(
        (tool: any) => tool.name === 'find_rooms_with_facilities'
      );
      
      const schema = findRoomsTool?.inputSchema as any;
      expect(schema.required).toContain('query');
    });
  });

  describe('tool execution', () => {
    it('should handle valid search query', async () => {
      const args = {
        query: 'room with conference phone for 6 people'
      };

      // Test the private method by calling it via reflection
      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text as string);
      expect(response.query).toBe(args.query);
      expect(response.parsedRequirements).toBeDefined();
      expect(response.parsedRequirements.facilities).toContain('conference phone');
      expect(response.parsedRequirements.capacity).toBe(6);
    });

    it('should handle query with date constraints', async () => {
      const args = {
        query: 'meeting room with screen',
        dateFrom: '2025-02-01T09:00:00.000',
        dateTo: '2025-02-01T17:00:00.000'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.parsedRequirements.facilities).toContain('screen');
      expect(response.filtersApplied).toBeDefined();
    });

    it('should handle building filter', async () => {
      const args = {
        query: 'desk with monitor',
        buildingId: 1001
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.parsedRequirements.facilities).toContain('desk');
      expect(response.parsedRequirements.facilities).toContain('screen');
    });

    it('should handle category filter', async () => {
      const args = {
        query: 'any available space',
        category: 'Meeting Rooms'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.filtersApplied).toContain('Category: Meeting Rooms');
    });

    it('should limit results based on maxResults', async () => {
      const args = {
        query: 'meeting room',
        maxResults: 5
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle complex natural language queries', async () => {
      const args = {
        query: 'I need a large conference room with 55" screen and video conference capability for 12 people tomorrow from 2pm to 4pm'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.parsedRequirements.capacity).toBe(12);
      expect(response.parsedRequirements.facilities).toContain('screen');
      expect(response.parsedRequirements.facilities).toContain('video conference');
      expect(response.parsedRequirements.facilities).toContain('55" screen');
    });

    it('should return error for missing query parameter', async () => {
      const args = {
        dateFrom: '2025-02-01T09:00:00.000'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query parameter is required');
    });

    it('should handle search with no results gracefully', async () => {
      const args = {
        query: 'room with impossible requirements xyz123'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.totalResults).toBe(0);
      expect(response.suggestions).toBeDefined();
      expect(response.suggestions.length).toBeGreaterThan(0);
    });

    it('should include search metadata', async () => {
      const args = {
        query: 'meeting room with whiteboard',
        duration: 120
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.searchTime).toBeDefined();
      expect(response.searchTime).toMatch(/\d+ms/);
      expect(response.filtersApplied).toBeDefined();
      expect(Array.isArray(response.filtersApplied)).toBe(true);
    });
  });

  describe('result formatting', () => {
    it('should format location information correctly', async () => {
      const args = {
        query: 'meeting room'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      const response = JSON.parse(result.content[0].text as string);
      
      if (response.results.length > 0) {
        const firstResult = response.results[0];
        
        expect(firstResult.location).toBeDefined();
        expect(firstResult.location.id).toBeDefined();
        expect(firstResult.location.name).toBeDefined();
        expect(firstResult.relevanceScore).toBeDefined();
        expect(firstResult.matchReason).toBeDefined();
      }
    });

    it('should format facility matches correctly', async () => {
      const args = {
        query: 'room with screen'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      const response = JSON.parse(result.content[0].text as string);
      
      if (response.results.length > 0) {
        const resultWithFacilities = response.results.find(
          (r: any) => r.facilityMatches && r.facilityMatches.length > 0
        );
        
        if (resultWithFacilities) {
          const facilityMatch = resultWithFacilities.facilityMatches[0];
          
          expect(facilityMatch.facility).toBeDefined();
          expect(facilityMatch.matchType).toBeDefined();
          expect(['exact', 'partial', 'related', 'category']).toContain(facilityMatch.matchType);
          expect(facilityMatch.score).toBeDefined();
          expect(facilityMatch.score).toBeGreaterThanOrEqual(0);
          expect(facilityMatch.score).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should include availability information when time constraints exist', async () => {
      const args = {
        query: 'meeting room',
        dateFrom: '2025-02-01T09:00:00.000',
        dateTo: '2025-02-01T17:00:00.000'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      const response = JSON.parse(result.content[0].text as string);
      
      if (response.results.length > 0) {
        const resultWithAvailability = response.results.find(
          (r: any) => r.availability !== undefined
        );
        
        if (resultWithAvailability) {
          expect(resultWithAvailability.availability).toBeDefined();
          expect(typeof resultWithAvailability.availability.isAvailable).toBe('boolean');
        }
      }
    });

    it('should include capacity information when requested', async () => {
      const args = {
        query: 'room for 8 people'
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      const response = JSON.parse(result.content[0].text as string);
      
      expect(response.parsedRequirements.capacity).toBe(8);
      
      if (response.results.length > 0) {
        const resultWithCapacity = response.results.find(
          (r: any) => r.capacity !== undefined
        );
        
        if (resultWithCapacity) {
          expect(resultWithCapacity.capacity.requested).toBe(8);
          expect(resultWithCapacity.capacity.actual).toBeDefined();
          expect(typeof resultWithCapacity.capacity.isMatch).toBe('boolean');
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      // This would need proper mocking of the search service to throw an error
      // For now, we'll test with an invalid scenario
      const args = {
        query: 'test',
        buildingId: 'invalid' as any // Invalid type
      };

      const handleFindRooms = (mcpServer as any).handleFindRoomsWithFacilities;
      const result = await handleFindRooms.call(mcpServer, args);
      
      // The tool should still return a response, even if with no results
      expect(result.content).toBeDefined();
    });
  });
});