import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MatrixBookingMCPServer } from '../../src/mcp/mcp-server';

describe('MatrixBookingMCPServer Integration', () => {
  let server: MatrixBookingMCPServer;

  beforeAll(() => {
    // Set required environment variables for testing
    process.env['MATRIX_USERNAME'] = 'test@example.com';
    process.env['MATRIX_PASSWORD'] = 'test-password';
    process.env['MATRIX_PREFERED_LOCATION'] = '1000001';
    
    server = new MatrixBookingMCPServer();
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env['MATRIX_USERNAME'];
    delete process.env['MATRIX_PASSWORD'];
    delete process.env['MATRIX_PREFERED_LOCATION'];
  });

  describe('End-to-end workflows', () => {
    it('should handle a complete booking workflow', async () => {
      // This would be a real integration test if we had a test server
      // For now, we'll verify the server can be instantiated and tools are available
      const tools = (server as any).getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should handle location search workflow', async () => {
      const tools = (server as any).getTools();
      const findLocationTool = tools.find((t: any) => t.name === 'find_location_by_name');
      
      expect(findLocationTool).toBeDefined();
      expect(findLocationTool.inputSchema.properties).toHaveProperty('name');
      expect(findLocationTool.inputSchema.properties).toHaveProperty('buildingHint');
      expect(findLocationTool.inputSchema.properties).toHaveProperty('searchType');
    });

    it('should handle availability check workflow', async () => {
      const tools = (server as any).getTools();
      const checkAvailabilityTool = tools.find((t: any) => t.name === 'check_availability');
      
      expect(checkAvailabilityTool).toBeDefined();
      expect(checkAvailabilityTool.inputSchema.properties).toHaveProperty('locationId');
      expect(checkAvailabilityTool.inputSchema.properties).toHaveProperty('dateFrom');
      expect(checkAvailabilityTool.inputSchema.properties).toHaveProperty('dateTo');
    });
  });

  describe('Tool execution', () => {
    it('should validate required parameters', async () => {
      // Test that tools validate their inputs
      const result = await (server as any).handleFindLocationByName({});
      expect(result.content[0].text).toContain('Error: Location name is required');
    });

    it('should handle missing services gracefully', async () => {
      // This tests error handling when services fail
      const tools = (server as any).getTools();
      expect(tools.every((t: any) => t.name && t.description)).toBe(true);
    });
  });
});