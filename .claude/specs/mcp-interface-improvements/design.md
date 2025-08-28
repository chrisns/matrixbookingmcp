# Matrix Booking MCP Interface Improvements - Design Document

## Executive Summary

This document outlines the architectural design and implementation plan to improve the Matrix Booking MCP server interface, addressing critical usability issues identified through AI assistant usage analysis. The primary issue is AI assistants incorrectly calling `matrix_booking_check_availability` when users ask about their existing bookings instead of using a dedicated user booking retrieval tool.

## Problem Analysis

### Current State Assessment

**Critical Issues Identified:**
1. **Missing Tool**: No MCP tool exists to retrieve user's existing bookings
2. **Tool Description Ambiguity**: Current descriptions don't clearly guide AI assistants to correct tool selection
3. **API Endpoint Issues**: 405 errors suggest potential endpoint configuration problems
4. **Poor Error Guidance**: Error messages don't suggest correct alternative actions

**Impact:**
- User queries like "what desk do I have booked tomorrow?" fail completely
- AI assistants cannot distinguish between availability checking and booking retrieval
- Poor user experience and loss of functionality

## Architecture Overview

### Current Architecture
```
AI Assistant Request
     ↓
MCP Server (MatrixBookingMCPServer)
     ↓
Service Layer (AvailabilityService, BookingService, etc.)
     ↓
Matrix API Client
     ↓
Matrix Booking API
```

### Enhanced Architecture Components

#### 1. Expanded Tool Registry
```
Current Tools:          Enhanced Tools:
- check_availability    - check_availability (improved descriptions)
- create_booking       - create_booking
- get_location         - get_location
- get_current_user     - get_current_user
- get_locations        + get_user_bookings (NEW)
- health_check         + get_tool_guidance (NEW)
...                    - Enhanced error handling across all tools
```

#### 2. Intelligent Tool Guidance System
```
User Intent Analysis
     ↓
Tool Selection Guidance
     ↓
Contextual Error Recovery
     ↓
Cross-tool Workflow Orchestration
```

## Detailed Component Specifications

### 1. New Tool: `get_user_bookings`

**Purpose**: Retrieve authenticated user's existing bookings with flexible filtering

**API Contract:**
```typescript
interface GetUserBookingsArgs {
  dateFrom?: string;        // ISO 8601 date filter start
  dateTo?: string;          // ISO 8601 date filter end  
  status?: string;          // 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
  includeDetails?: boolean; // Full booking details vs summary
  page?: number;            // Pagination support
  pageSize?: number;        // Results per page
}

interface GetUserBookingsResponse {
  bookings: Array<{
    id: number;
    locationName: string;
    locationId: number;
    timeFrom: string;
    timeTo: string;
    status: string;
    attendees?: Array<{name: string; email: string}>;
    organizer?: {name: string; email: string};
    created: string;
    description?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}
```

**Tool Definition:**
```json
{
  "name": "get_user_bookings",
  "description": "Retrieve current user's existing room and desk bookings. Use this tool when users ask about their scheduled bookings, reservations, or meetings.",
  "useCases": [
    "What meetings do I have tomorrow?",
    "Show my desk bookings for this week", 
    "Do I have any room conflicts?",
    "What's my booking schedule?"
  ],
  "notFor": [
    "Checking room availability (use matrix_booking_check_availability)",
    "Creating new bookings (use matrix_booking_create_booking)"
  ],
  "relatedTools": [
    "matrix_booking_get_location (for location details)",
    "matrix_booking_check_availability (for availability checking)"
  ],
  "inputSchema": {
    "type": "object",
    "properties": {
      "dateFrom": {
        "type": "string",
        "format": "date-time",
        "description": "Start date for booking filter (ISO 8601). Defaults to current date."
      },
      "dateTo": {
        "type": "string", 
        "format": "date-time",
        "description": "End date for booking filter (ISO 8601). Defaults to 30 days from start date."
      },
      "status": {
        "type": "string",
        "enum": ["ACTIVE", "CANCELLED", "COMPLETED"],
        "description": "Filter by booking status. Defaults to 'ACTIVE'."
      },
      "includeDetails": {
        "type": "boolean",
        "description": "Include full booking details including attendees and organizer info. Defaults to true.",
        "default": true
      },
      "page": {
        "type": "number",
        "description": "Page number for pagination. Defaults to 1.",
        "minimum": 1,
        "default": 1
      },
      "pageSize": {
        "type": "number", 
        "description": "Number of bookings per page. Defaults to 50.",
        "minimum": 1,
        "maximum": 100,
        "default": 50
      }
    }
  }
}
```

### 2. New Tool: `get_tool_guidance`

**Purpose**: Provide AI assistants with intelligent tool selection guidance

**API Contract:**
```typescript
interface ToolGuidanceArgs {
  intent?: string;          // Optional user intent description
  context?: string;         // Optional additional context
}

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
  intentMapping: {
    [userPhrase: string]: {
      primaryTool: string;
      supportingTools: string[];
      avoidTools: string[];
    };
  };
  troubleshooting: {
    [errorPattern: string]: {
      suggestion: string;
      alternativeTools: string[];
    };
  };
}
```

**Tool Definition:**
```json
{
  "name": "get_tool_guidance",
  "description": "Get guidance on which Matrix Booking MCP tools to use for specific user intents and workflows.",
  "useCases": [
    "Understanding tool selection for user queries",
    "Workflow orchestration guidance",
    "Error recovery suggestions"
  ],
  "inputSchema": {
    "type": "object",
    "properties": {
      "intent": {
        "type": "string",
        "description": "Optional: Describe the user's intent or query to get specific tool recommendations"
      },
      "context": {
        "type": "string",
        "description": "Optional: Additional context about the current situation"
      }
    }
  }
}
```

### 3. Enhanced Tool Descriptions

**Improvement Strategy:**
1. **Clear Primary Purpose**: Single sentence describing main function
2. **Specific Use Cases**: 3-4 concrete examples of when to use
3. **Anti-patterns**: Clear examples of when NOT to use
4. **Related Tools**: Cross-references to complementary tools
5. **Workflow Context**: Position within common workflows

**Example Enhanced Description (check_availability):**
```json
{
  "name": "matrix_booking_check_availability",
  "description": "Check available rooms and spaces for potential booking at specific times. Use this to find open slots before creating bookings.",
  "useCases": [
    "Are there rooms available at 2pm tomorrow?",
    "What spaces are free Friday morning?", 
    "Pre-booking availability verification",
    "Finding alternative time slots"
  ],
  "notFor": [
    "Retrieving user's existing bookings (use get_user_bookings)",
    "Getting user's calendar (use get_user_bookings)",
    "Checking what you have booked (use get_user_bookings)"
  ],
  "workflowContext": "Step 1 of booking creation workflow, before matrix_booking_create_booking",
  "relatedTools": [
    "get_user_bookings (for existing bookings)",
    "matrix_booking_create_booking (after finding availability)",
    "find_rooms_with_facilities (for facility-based search)"
  ]
}
```

### 4. Enhanced Error Handling System

**Error Response Enhancement:**
```typescript
interface EnhancedErrorResponse {
  error: {
    message: string;
    code: string;
    httpStatus?: number;
    context: string;
  };
  suggestions: Array<{
    action: string;
    tool: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
  relatedWorkflows: string[];
  troubleshooting: {
    commonCauses: string[];
    diagnosticSteps: string[];
  };
}
```

**Error Handling Patterns:**
1. **405 Method Not Allowed**: Suggest correct tool and parameters
2. **User Booking Context**: Redirect to `get_user_bookings`
3. **Location Resolution**: Provide location discovery guidance
4. **Authentication Issues**: Clear re-authentication steps

### 5. API Endpoint Verification & Fixes

**Investigation Required:**
1. **Availability Check Endpoint**: Verify HTTP method (GET vs POST)
2. **User Bookings Endpoint**: Ensure proper implementation
3. **Error Response Formats**: Standardize across all endpoints

**Potential Fixes:**
```typescript
// Current (potentially incorrect)
POST /api/v1/availability/check

// Investigate if should be:
GET /api/v1/availability?dateFrom=...&dateTo=...&locationId=...

// User bookings endpoint (implement if missing)
GET /api/v1/user/current/bookings?startDate=...&endDate=...&status=...
```

## Implementation Plan

### Phase 1: Core Tool Implementation (Priority: High)
**Timeline: 1-2 days**

**Tasks:**
1. **Add `get_user_bookings` MCP Tool Handler**
   - Implement handler in `MatrixBookingMCPServer`
   - Connect to existing `UserService.getUserBookings()`
   - Add comprehensive error handling
   - Test with various parameter combinations

2. **API Endpoint Verification**
   - Test availability check endpoint (resolve 405 errors)
   - Verify user bookings endpoint functionality
   - Update endpoint configurations if needed

3. **Enhanced Tool Descriptions** 
   - Update all existing tool descriptions with new format
   - Add use cases, anti-patterns, and related tools
   - Test with AI assistant interactions

**Code Changes Required:**

```typescript
// In MatrixBookingMCPServer.setupHandlers()
case 'get_user_bookings':
  return await this.handleGetUserBookings(args || {});

// New handler method
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

    // Format response for better readability
    const formattedResponse = {
      summary: {
        totalBookings: response.total,
        page: response.page || 1,
        pageSize: response.pageSize || 50,
        hasNext: (response.total > ((response.page || 1) * (response.pageSize || 50)))
      },
      bookings: response.bookings.map(booking => ({
        id: booking.id,
        location: booking.locationName || `Location ${booking.locationId}`,
        timeSlot: `${booking.timeFrom} to ${booking.timeTo}`,
        status: booking.status,
        duration: this.calculateDuration(booking.timeFrom, booking.timeTo),
        attendeeCount: booking.attendees?.length || 0,
        organizer: booking.organizer?.name,
        created: booking.created
      }))
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
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving user bookings: ${error instanceof Error ? error.message : 'Unknown error'}\n\nSuggestion: Ensure you are authenticated and have proper permissions to view your bookings.`
        }
      ],
      isError: true
    };
  }
}
```

### Phase 2: Intelligence & Guidance (Priority: Medium)
**Timeline: 1 day**

**Tasks:**
1. **Implement `get_tool_guidance` Tool**
   - Create comprehensive workflow mappings
   - Build intent recognition patterns
   - Add troubleshooting guidance

2. **Enhanced Error Messages**
   - Implement enhanced error response format
   - Add contextual suggestions for common errors
   - Create error recovery workflows

**Code Changes Required:**

```typescript
// Add to tool list
{
  name: 'get_tool_guidance',
  description: 'Get intelligent guidance on Matrix Booking MCP tool selection and workflows',
  // ... (full schema as defined above)
}

// Handler implementation
private async handleGetToolGuidance(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const intent = args['intent'] as string;
  const context = args['context'] as string;

  const guidance = {
    workflows: [
      {
        scenario: "User wants to see their existing bookings",
        description: "Retrieve and display user's current and future bookings",
        tools: [
          { tool: "get_user_bookings", order: 1, purpose: "Retrieve user's bookings", required: true },
          { tool: "matrix_booking_get_location", order: 2, purpose: "Get location details if needed", required: false }
        ]
      },
      {
        scenario: "User wants to create a new booking",
        description: "Find available space and create booking",
        tools: [
          { tool: "matrix_booking_check_availability", order: 1, purpose: "Find available times", required: true },
          { tool: "find_rooms_with_facilities", order: 2, purpose: "Find suitable spaces", required: false },
          { tool: "matrix_booking_create_booking", order: 3, purpose: "Create the booking", required: true }
        ]
      }
      // ... more workflows
    ],
    intentMapping: {
      "what do I have booked": { primaryTool: "get_user_bookings", supportingTools: [], avoidTools: ["matrix_booking_check_availability"] },
      "my bookings": { primaryTool: "get_user_bookings", supportingTools: [], avoidTools: ["matrix_booking_check_availability"] },
      "what's available": { primaryTool: "matrix_booking_check_availability", supportingTools: ["find_rooms_with_facilities"], avoidTools: ["get_user_bookings"] }
      // ... more mappings
    },
    troubleshooting: {
      "405 Method Not Allowed": { 
        suggestion: "The API endpoint may be using the wrong HTTP method. Try using a different tool or check API configuration.",
        alternativeTools: ["get_tool_guidance", "health_check"]
      }
      // ... more troubleshooting
    }
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(guidance, null, 2)
      }
    ]
  };
}
```

### Phase 3: Testing & Optimization (Priority: Medium)
**Timeline: 1 day**

**Tasks:**
1. **Comprehensive Testing Suite**
   - Unit tests for new tools
   - Integration tests for workflows
   - AI assistant interaction tests

2. **Performance Optimization**
   - Response time optimization
   - Caching for frequent queries
   - Error handling performance

## Testing Strategy

### 1. Unit Tests

**New Test Files:**
- `tests/unit/mcp/get-user-bookings-tool.test.ts`
- `tests/unit/mcp/get-tool-guidance-tool.test.ts`
- `tests/unit/mcp/enhanced-error-handling.test.ts`

**Test Scenarios:**
```typescript
describe('get_user_bookings tool', () => {
  it('should retrieve user bookings with default parameters', async () => {
    // Test default behavior
  });

  it('should filter bookings by date range', async () => {
    // Test date filtering
  });

  it('should handle pagination correctly', async () => {
    // Test pagination
  });

  it('should return enhanced error messages for authentication failures', async () => {
    // Test error handling
  });
});
```

### 2. Integration Tests

**Test Scenarios:**
```typescript
describe('MCP Tool Workflows', () => {
  it('should correctly handle "what do I have booked tomorrow" query', async () => {
    const result = await mcpServer.handleToolCall({
      name: 'get_user_bookings',
      arguments: {
        dateFrom: tomorrow.toISOString(),
        dateTo: endOfTomorrow.toISOString(),
        status: 'ACTIVE'
      }
    });
    
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('bookings');
  });

  it('should provide correct tool guidance for booking queries', async () => {
    const result = await mcpServer.handleToolCall({
      name: 'get_tool_guidance',
      arguments: {
        intent: 'show my bookings for tomorrow'
      }
    });
    
    const guidance = JSON.parse(result.content[0].text);
    expect(guidance.intentMapping['my bookings'].primaryTool).toBe('get_user_bookings');
  });
});
```

### 3. User Acceptance Tests

**Test Cases:**
1. **Booking Retrieval Scenarios**
   - "What meetings do I have tomorrow?"
   - "Show my desk bookings for this week"
   - "Do I have any room conflicts?"

2. **Tool Selection Accuracy**
   - Measure correct tool selection percentage
   - Track error reduction rates
   - Monitor user satisfaction

3. **Error Recovery**
   - Test error message clarity
   - Verify alternative action suggestions
   - Validate workflow continuation after errors

## Success Metrics

### Quantitative Metrics
1. **Tool Selection Accuracy**: Target >95% correct tool selection for user booking queries
2. **Error Rate Reduction**: Target 80% reduction in 405 errors and tool misuse
3. **Response Time**: Target <2 seconds for booking retrieval
4. **User Query Success**: Target >90% successful completion of booking-related queries

### Qualitative Metrics
1. **AI Assistant Experience**: Improved tool discovery and selection
2. **Error Message Quality**: Clear, actionable error guidance
3. **Workflow Completeness**: End-to-end scenario coverage

## Risk Assessment & Mitigation

### High Risk
**Risk**: API endpoint changes break existing functionality  
**Mitigation**: 
- Maintain backward compatibility during transition
- Comprehensive testing before deployment
- Gradual rollout with monitoring

**Risk**: Performance degradation with new tools  
**Mitigation**:
- Performance testing for all new tools
- Caching strategy for frequent operations
- Resource utilization monitoring

### Medium Risk
**Risk**: AI assistants require adaptation time  
**Mitigation**:
- Clear migration documentation
- Examples and training materials
- Gradual feature introduction

**Risk**: Increased complexity in error scenarios  
**Mitigation**:
- Simplified error handling patterns
- Comprehensive test coverage
- Clear troubleshooting documentation

## Future Enhancements

### Phase 4: Advanced Features (Low Priority)
1. **Smart Scheduling Assistant**
   - Conflict detection and resolution
   - Automatic alternative suggestions
   - Calendar integration improvements

2. **Usage Analytics**
   - Tool usage patterns analysis
   - Performance metrics dashboard
   - User behavior insights

3. **Advanced Error Recovery**
   - Automatic retry mechanisms
   - Circuit breaker patterns
   - Degraded mode operations

## Conclusion

This design provides a comprehensive solution to the identified MCP interface issues. The implementation focuses on:

1. **Immediate Problem Resolution**: Adding missing `get_user_bookings` tool
2. **AI Assistant Guidance**: Clear tool descriptions and selection guidance
3. **Error Handling**: Enhanced error messages with actionable suggestions
4. **Future Scalability**: Extensible architecture for additional improvements

The phased approach ensures rapid delivery of critical fixes while building foundation for long-term improvements. Success will be measured through reduced error rates, improved AI assistant tool selection accuracy, and enhanced user experience.

Implementation should begin immediately with Phase 1 to address the critical missing functionality and API issues identified in the requirements analysis.