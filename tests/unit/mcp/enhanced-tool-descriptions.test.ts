import { describe, it, expect, beforeEach } from 'vitest';
import { MatrixBookingMCPServer } from '../../../src/mcp/mcp-server.js';

describe('Enhanced Tool Descriptions', () => {
  let mcpServer: MatrixBookingMCPServer;
  let tools: any[];

  beforeEach(() => {
    mcpServer = new MatrixBookingMCPServer();
    // Access the private getTools method through the server's request handler
    tools = (mcpServer as any).getTools();
  });

  describe('Tool Description Format', () => {
    const requiredTools = [
      'matrix_booking_check_availability',
      'matrix_booking_create_booking', 
      'matrix_booking_get_location',
      'get_current_user',
      'get_booking_categories',
      'get_locations',
      'discover_available_facilities',
      'find_rooms_with_facilities',
      'get_user_bookings',
      'health_check'
    ];

    requiredTools.forEach(toolName => {
      it(`should have enhanced description format for ${toolName}`, () => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(100); // Enhanced descriptions should be detailed
      });

      it(`should include use cases for ${toolName}`, () => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool.description).toContain('Common Use Cases:');
        // Should have at least 3 use case examples
        const useCaseMatches = tool.description.match(/- "/g);
        expect(useCaseMatches).toBeDefined();
        expect(useCaseMatches!.length).toBeGreaterThanOrEqual(3);
      });

      it(`should include anti-patterns for ${toolName}`, () => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool.description).toContain('Not For:');
        // Should have anti-patterns explaining what not to use the tool for
        const notForSection = tool.description.split('Not For:')[1];
        expect(notForSection).toBeDefined();
        expect(notForSection.length).toBeGreaterThan(20);
      });

      it(`should include related tools for ${toolName}`, () => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool.description).toContain('Related Tools:');
        // Should reference other tools in the system
        const relatedSection = tool.description.split('Related Tools:')[1];
        expect(relatedSection).toBeDefined();
        expect(relatedSection.length).toBeGreaterThan(20);
      });
    });
  });

  describe('Tool Usage Guidance', () => {
    it('should provide clear guidance for availability checking vs booking retrieval', () => {
      const availabilityTool = tools.find(t => t.name === 'matrix_booking_check_availability');
      const bookingsTool = tools.find(t => t.name === 'get_user_bookings');

      // Availability tool should direct users away from getting existing bookings
      expect(availabilityTool.description).toContain('get_user_bookings');
      expect(availabilityTool.description).toContain('personal calendar');
      
      // Bookings tool should direct users away from availability checking
      expect(bookingsTool.description).toContain('matrix_booking_check_availability');
      expect(bookingsTool.description).toContain('availability');
    });

    it('should provide clear workflow guidance for booking creation', () => {
      const createTool = tools.find(t => t.name === 'matrix_booking_create_booking');
      const availabilityTool = tools.find(t => t.name === 'matrix_booking_check_availability');

      // Create booking should reference checking availability first
      expect(createTool.description).toContain('matrix_booking_check_availability');
      expect(createTool.description).toContain('availability');

      // Availability should reference creating bookings after
      expect(availabilityTool.description).toContain('matrix_booking_create_booking');
      expect(availabilityTool.description).toContain('Create booking after finding availability');
    });

    it('should distinguish between location discovery and specific location details', () => {
      const locationsTool = tools.find(t => t.name === 'get_locations');
      const locationTool = tools.find(t => t.name === 'matrix_booking_get_location');

      // get_locations should be for hierarchy and discovery
      expect(locationsTool.description).toContain('hierarchy');
      expect(locationsTool.description).toContain('discovery');
      expect(locationsTool.description).toContain('specific location');

      // matrix_booking_get_location should be for detailed info
      expect(locationTool.description).toContain('detailed information');
      expect(locationTool.description).toContain('specific location');
    });

    it('should provide guidance for facility search vs discovery', () => {
      const discoverTool = tools.find(t => t.name === 'discover_available_facilities');
      const searchTool = tools.find(t => t.name === 'find_rooms_with_facilities');

      // Discover should be about listing facilities
      expect(discoverTool.description).toContain('available facility types');
      expect(discoverTool.description).toContain('find_rooms_with_facilities');

      // Search should be about finding specific rooms
      expect(searchTool.description).toContain('specific facilities');
      expect(searchTool.description).toContain('discover_available_facilities');
    });
  });

  describe('Use Case Examples Quality', () => {
    it('should include realistic user queries in examples', () => {
      tools.forEach(tool => {
        if (tool.description.includes('Common Use Cases:')) {
          const useCases = tool.description.split('Common Use Cases:')[1].split('Not For:')[0];
          
          // Should include quoted examples that look like natural user queries
          expect(useCases).toMatch(/"[^"]+"/);
          
          // Examples should be specific and actionable
          const quotedExamples = useCases.match(/"([^"]+)"/g);
          if (quotedExamples) {
            quotedExamples.forEach((example: string) => {
              expect(example.length).toBeGreaterThan(10); // Not too short
              expect(example.length).toBeLessThan(100); // Not too long
            });
          }
        }
      });
    });

    it('should have distinct use cases for each tool', () => {
      const allUseCases: string[] = [];
      
      tools.forEach(tool => {
        if (tool.description.includes('Common Use Cases:')) {
          const useCases = tool.description.split('Common Use Cases:')[1].split('Not For:')[0];
          const quotedExamples = useCases.match(/"([^"]+)"/g) || [];
          allUseCases.push(...quotedExamples);
        }
      });

      // Should have diverse examples, not too much repetition
      const uniqueUseCases = new Set(allUseCases);
      expect(uniqueUseCases.size).toBeGreaterThan(allUseCases.length * 0.7); // At least 70% unique
    });
  });

  describe('Anti-Pattern Guidance Quality', () => {
    it('should provide specific anti-patterns with tool references', () => {
      tools.forEach(tool => {
        if (tool.description.includes('Not For:')) {
          const notForSection = tool.description.split('Not For:')[1].split('Related Tools:')[0];
          
          // Should reference other tools by name
          const toolReferences = notForSection.match(/\(use [^)]+\)/g);
          expect(toolReferences).toBeDefined();
          expect(toolReferences!.length).toBeGreaterThan(0);

          // Each anti-pattern should be specific
          const antiPatterns = notForSection.split('\n-').filter((pattern: string) => pattern.trim().length > 0);
          antiPatterns.forEach((pattern: string) => {
            expect(pattern.length).toBeGreaterThan(20); // Should be descriptive
          });
        }
      });
    });
  });

  describe('Cross-Tool Workflow Guidance', () => {
    const requiredTools = [
      'matrix_booking_check_availability',
      'matrix_booking_create_booking', 
      'matrix_booking_get_location',
      'get_current_user',
      'get_booking_categories',
      'get_locations',
      'discover_available_facilities',
      'find_rooms_with_facilities',
      'get_user_bookings',
      'health_check'
    ];

    requiredTools.forEach(toolName => {
      it(`should include workflow positioning for ${toolName}`, () => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool.description).toContain('Workflow Position:');
        
        // Should describe the tool's position in workflows
        const workflowSection = tool.description.split('Workflow Position:')[1]?.split('Related Tools:')[0];
        expect(workflowSection).toBeDefined();
        expect(workflowSection.length).toBeGreaterThan(20);
        expect(workflowSection).toMatch(/(Step \d+|Primary|Foundation|Alternative|Support|Diagnostic)/);
      });
    });

    it('should define clear workflow sequences', () => {
      // Booking Creation Workflow
      const availabilityTool = tools.find(t => t.name === 'matrix_booking_check_availability');
      const createTool = tools.find(t => t.name === 'matrix_booking_create_booking');
      
      expect(availabilityTool.description).toContain('Step 1 of booking creation workflow');
      expect(createTool.description).toContain('Step 2 of booking creation workflow');
    });

    it('should define space discovery workflow sequence', () => {
      // Space Discovery Workflow
      const categoriesTool = tools.find(t => t.name === 'get_booking_categories');
      const locationsTool = tools.find(t => t.name === 'get_locations');
      const facilitiesTool = tools.find(t => t.name === 'discover_available_facilities');
      
      expect(categoriesTool.description).toContain('Step 1 of space discovery workflow');
      expect(locationsTool.description).toContain('Step 2 of space discovery workflow');
      expect(facilitiesTool.description).toContain('Step 3 of space discovery workflow');
    });

    it('should identify primary workflow tools', () => {
      const userBookingsTool = tools.find(t => t.name === 'get_user_bookings');
      expect(userBookingsTool.description).toContain('Primary tool for user booking inquiry workflow');
    });

    it('should identify foundation tools', () => {
      const userTool = tools.find(t => t.name === 'get_current_user');
      expect(userTool.description).toContain('Foundation tool for all workflows');
    });

    it('should identify alternative workflow paths', () => {
      const facilitySearchTool = tools.find(t => t.name === 'find_rooms_with_facilities');
      expect(facilitySearchTool.description).toContain('Alternative Step 1 of booking creation workflow');
    });

    it('should identify diagnostic tools', () => {
      const healthTool = tools.find(t => t.name === 'health_check');
      expect(healthTool.description).toContain('Diagnostic tool for all workflows');
    });

    it('should provide clear prerequisites and next steps', () => {
      tools.forEach(tool => {
        const relatedSection = tool.description.split('Related Tools:')[1];
        if (relatedSection) {
          // Should include prerequisite, next step, alternative, or support tools
          const hasWorkflowGuidance = relatedSection.match(/(Prerequisite|Next step|Alternative|Follow-up|Support)/i);
          expect(hasWorkflowGuidance).toBeTruthy();
        }
      });
    });

    it('should have bidirectional references between related tools', () => {
      const toolPairs = [
        ['matrix_booking_check_availability', 'get_user_bookings'],
        ['matrix_booking_check_availability', 'matrix_booking_create_booking'],
        ['matrix_booking_create_booking', 'matrix_booking_get_location'],
        ['discover_available_facilities', 'find_rooms_with_facilities'],
        ['get_locations', 'matrix_booking_get_location']
      ];

      toolPairs.forEach(([tool1Name, tool2Name]) => {
        const tool1 = tools.find(t => t.name === tool1Name);
        const tool2 = tools.find(t => t.name === tool2Name);

        expect(tool1.description).toContain(tool2Name);
        expect(tool2.description).toContain(tool1Name);
      });
    });

  });

  describe('Cross-Tool References', () => {
    it('should reference valid tool names only', () => {
      const validToolNames = tools.map(t => t.name);
      
      tools.forEach(tool => {
        // Extract tool names mentioned in the description
        const toolMentions = tool.description.match(/([a-z_]+_[a-z_]+|get_[a-z_]+|health_check)/g) || [];
        
        toolMentions.forEach((mention: string) => {
          if (mention !== tool.name) { // Don't check self-references
            expect(validToolNames).toContain(mention);
          }
        });
      });
    });
  });

  describe('Description Structure', () => {
    it('should follow consistent format across all tools', () => {
      tools.forEach(tool => {
        if (tool.description.includes('Common Use Cases:')) {
          // Should have the expected sections in order including Workflow Position
          expect(tool.description).toMatch(/.*Common Use Cases:.*Not For:.*Workflow Position:.*Related Tools:.*/s);
          
          // Each section should be properly formatted (handle both \n and \\n)
          expect(tool.description).toMatch(/Common Use Cases:[\s\\n]*-/);
          expect(tool.description).toMatch(/Not For:[\s\\n]*-/);
          expect(tool.description).toMatch(/Workflow Position:[\s\\n]*\w+/);
          expect(tool.description).toMatch(/Related Tools:[\s\\n]*-/);
        }
      });
    });

    it('should have proper newline formatting', () => {
      tools.forEach(tool => {
        // Should not have carriage returns
        expect(tool.description).not.toMatch(/\r\n/);
        // Should use either literal newlines or escaped newlines consistently
        const hasLiteralNewlines = tool.description.includes('\n');
        const hasEscapedNewlines = tool.description.includes('\\n');
        expect(hasLiteralNewlines || hasEscapedNewlines).toBe(true);
      });
    });
  });

  describe('Tool-Specific Validations', () => {
    it('should have specific validation for get_user_bookings tool', () => {
      const tool = tools.find(t => t.name === 'get_user_bookings');
      
      // Should emphasize this is for user's own bookings
      expect(tool.description).toContain('user\'s existing');
      expect(tool.description).toContain('scheduled bookings');
      expect(tool.description).toContain('reservations');
      expect(tool.description).toContain('meetings');

      // Should clearly state it's not for availability
      expect(tool.description).toContain('Not For:');
      expect(tool.description).toContain('availability');
    });

    it('should have specific validation for matrix_booking_check_availability tool', () => {
      const tool = tools.find(t => t.name === 'matrix_booking_check_availability');
      
      // Should emphasize this is for availability checking
      expect(tool.description).toContain('availability');
      expect(tool.description).toContain('available');
      
      // Should clearly state it's not for personal bookings
      expect(tool.description).toContain('existing bookings');
      expect(tool.description).toContain('personal calendar');
    });

    it('should have specific validation for health_check tool', () => {
      const tool = tools.find(t => t.name === 'health_check');
      
      // Should emphasize this is for system diagnostics
      expect(tool.description).toContain('health');
      expect(tool.description).toContain('status');
      expect(tool.description).toContain('diagnose');
    });
  });
});