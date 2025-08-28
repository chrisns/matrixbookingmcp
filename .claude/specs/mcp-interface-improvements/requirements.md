# MCP Interface Improvements - Requirements Document

## Problem Statement

AI assistants using the Matrix Booking MCP server are unable to properly navigate the interface when users ask about their existing bookings. Analysis of logs shows:

1. **Missing User Booking Retrieval**: When asked "what desk I have booked tomorrow", the AI incorrectly calls `matrix_booking_check_availability` instead of retrieving existing user bookings
2. **Poor Tool Discovery**: Current tool descriptions don't clearly indicate the appropriate use cases and workflows
3. **API Error Handling**: The availability check returns a 405 error, suggesting potential API endpoint issues

## Root Cause Analysis

### Log Analysis Findings
- **Line 117**: AI calls `matrix_booking_check_availability` for retrieving user's existing bookings
- **Line 141**: API returns 405 Method Not Allowed error
- **Missing Tool**: No MCP tool exists to retrieve user's current/future bookings

### Current Tool Gap
The MCP server has these tools:
- `matrix_booking_check_availability` - checks room availability (not user bookings)  
- `matrix_booking_create_booking` - creates new bookings
- `get_current_user` - gets user profile
- Various discovery tools

**Missing**: Tool to retrieve user's existing bookings

## Requirements

### 1. Add User Booking Retrieval Tool

**Tool Name**: `get_user_bookings`

**Description**: Retrieve current user's existing bookings with optional date filtering

**Parameters**:
- `dateFrom` (optional): Start date for booking filter (ISO 8601)
- `dateTo` (optional): End date for booking filter (ISO 8601)  
- `status` (optional): Filter by booking status (upcoming, completed, cancelled)
- `includeDetails` (boolean, default: true): Include full booking details vs summary

**Implementation Requirements**:
- Leverage existing `UserService.getUserBookings()` method
- Add MCP tool handler in `MatrixBookingMCPServer`
- Return structured booking data with location names, times, and attendees

### 2. Improve Tool Descriptions

**Current Issues**:
- Tool descriptions don't clearly indicate primary use cases
- Missing workflow guidance for common scenarios
- Ambiguous parameter descriptions

**Requirements**:
- Add "Common Use Cases" section to each tool description
- Include workflow examples ("To find your existing bookings, use get_user_bookings")
- Clarify parameter purpose and defaults
- Add cross-references between related tools

### 3. Add Tool Usage Guidance

**New Tool**: `get_tool_guidance`

**Purpose**: Help AI assistants understand when to use which tools

**Returns**:
- Workflow mapping (user intent → appropriate tools)
- Common scenarios and tool sequences
- Tool relationship matrix

### 4. Enhanced Error Handling

**Requirements**:
- Return actionable error messages with suggested alternatives
- When availability check fails, suggest booking retrieval tools
- Include HTTP status codes in error context
- Add retry guidance for transient errors

### 5. API Endpoint Verification

**Investigation Required**:
- Verify availability check endpoint and HTTP method
- Ensure all API endpoints are correctly implemented
- Test tool workflows end-to-end

## Success Criteria

1. **User Story Completion**: "What desk do I have booked tomorrow?" returns correct booking information
2. **Tool Discovery**: AI assistants correctly identify appropriate tools for user intents
3. **Error Reduction**: Eliminate 405 errors from tool misuse
4. **Workflow Clarity**: Clear documentation of tool usage patterns

## Implementation Priority

### High Priority
1. Add `get_user_bookings` tool
2. Fix availability check API endpoint
3. Improve tool descriptions

### Medium Priority  
1. Add tool usage guidance
2. Enhanced error handling

### Low Priority
1. Cross-tool workflow optimization
2. Performance monitoring

## Testing Requirements

### Unit Tests
- `get_user_bookings` tool handler
- UserService booking retrieval
- Error handling scenarios

### Integration Tests  
- End-to-end booking retrieval workflow
- Tool discovery scenarios
- Error handling workflows

### User Acceptance Tests
- "Show my bookings" scenarios
- "What's booked tomorrow" scenarios
- Error recovery scenarios

## Timeline Estimate

- **Phase 1** (1-2 days): Add user booking tool, fix API issues
- **Phase 2** (1 day): Improve tool descriptions and guidance  
- **Phase 3** (1 day): Enhanced error handling and testing

## Dependencies

- Existing UserService implementation (already available)
- Matrix API user booking endpoints
- MCP SDK tool registration patterns

## Risks & Mitigations

**Risk**: API endpoint changes required
**Mitigation**: Test current endpoints, document required changes

**Risk**: Breaking existing tool usage  
**Mitigation**: Maintain backward compatibility, add new tools

**Risk**: AI assistant adaptation time
**Mitigation**: Clear documentation and examples