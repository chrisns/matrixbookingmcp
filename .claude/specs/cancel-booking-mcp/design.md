# Design Document

## Overview

The cancel booking MCP tool extends the existing Matrix Booking MCP server with the ability to cancel existing bookings through a DELETE API call. This feature integrates seamlessly with the current architecture, following established patterns for authentication, error handling, and tool guidance.

## Architecture

### Component Integration

The cancel booking functionality will integrate with existing components:

- **MCP Server**: Add new tool definition and handler method
- **API Client**: Add DELETE request method for booking cancellation
- **Booking Service**: Add cancellation method with validation
- **Error Handler**: Leverage existing error handling patterns
- **Tool Guidance**: Extend guidance system with cancellation workflows

### Request Flow

1. User calls `cancel_booking` tool with booking ID
2. MCP Server validates input parameters
3. Booking Service validates booking ID format and user permissions
4. API Client makes DELETE request to Matrix API
5. Response is processed and formatted for user
6. Enhanced error handling provides actionable feedback

## Components and Interfaces

### New MCP Tool Definition

```typescript
{
  name: 'cancel_booking',
  description: 'Cancel an existing booking by booking ID. This action is irreversible and will notify all attendees.',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'number',
        description: 'The booking ID to cancel (required)'
      }
    },
    required: ['bookingId']
  }
}
```

### API Client Extension

```typescript
async cancelBooking(bookingId: number, credentials: ICredentials): Promise<ICancelBookingResponse> {
  const config = this.configManager.getConfig();
  const headers = this.authManager.createAuthHeader(credentials);
  
  const apiRequest: IAPIRequest = {
    method: 'DELETE',
    url: `${config.apiBaseUrl}/booking/${bookingId}?notifyScope=ALL_ATTENDEES&sendNotifications=true`,
    headers
  };

  const response = await this.makeRequest<ICancelBookingResponse>(apiRequest);
  return response.data;
}
```

### Booking Service Extension

```typescript
async cancelBooking(bookingId: number): Promise<ICancelBookingResponse> {
  // Validate booking ID format
  const validationResult = this.validateBookingId(bookingId);
  if (!validationResult.isValid) {
    throw new Error(`Invalid booking ID: ${validationResult.errors.join(', ')}`);
  }

  const credentials = await this.authManager.getCredentials();
  return await this.apiClient.cancelBooking(bookingId, credentials);
}
```

## Data Models

### Cancel Booking Response Interface

```typescript
interface ICancelBookingResponse {
  success: boolean;
  bookingId: number;
  status: 'CANCELLED';
  message: string;
  cancelledAt: string; // ISO 8601 timestamp
  notificationsSent: boolean;
  attendeesNotified: number;
}
```

### Validation Types

```typescript
interface IBookingIdValidation {
  isValid: boolean;
  errors: string[];
}
```

## Error Handling

### Validation Errors

- **Missing booking ID**: Clear message requesting the required parameter
- **Invalid booking ID format**: Guidance on expected format (positive integer)
- **Booking not found**: Helpful message with suggestions to verify booking ID
- **Permission denied**: Clear explanation of authorization requirements

### API Errors

- **404 Not Found**: "Booking not found. Please verify the booking ID is correct."
- **403 Forbidden**: "You don't have permission to cancel this booking. Only the booking owner or administrators can cancel bookings."
- **409 Conflict**: "This booking cannot be cancelled (may already be cancelled or completed)."
- **500 Server Error**: "Server error occurred. Please try again or contact support."

### Enhanced Error Context

```typescript
interface CancelBookingErrorContext extends MCPErrorContext {
  bookingId?: number;
  suggestions: MCPErrorSuggestion[];
  relatedWorkflows: string[];
  troubleshooting: {
    commonCauses: string[];
    diagnosticSteps: string[];
  };
}
```

## Testing Strategy

### Unit Tests

1. **Tool Definition Tests**
   - Verify tool appears in tool list
   - Validate input schema requirements
   - Test tool description and guidance

2. **Handler Tests**
   - Valid booking ID cancellation
   - Invalid booking ID handling
   - Missing parameter validation
   - Error response formatting

3. **API Client Tests**
   - DELETE request construction
   - URL parameter formatting
   - Authentication header inclusion
   - Response parsing

4. **Booking Service Tests**
   - Booking ID validation
   - Credential management
   - Error propagation

### Integration Tests

1. **End-to-End Cancellation Flow**
   - Create booking → Cancel booking → Verify cancellation
   - Test with different booking types
   - Verify notification behavior

2. **Error Handling Integration**
   - Test various error scenarios
   - Verify enhanced error responses
   - Test error context and suggestions

### Tool Guidance Integration

Extend existing tool guidance with cancellation workflows:

```typescript
{
  scenario: "User wants to cancel an existing booking",
  description: "When users ask to 'cancel my meeting', 'remove booking', or 'delete reservation'",
  tools: [
    {
      tool: "get_user_bookings",
      order: 1,
      purpose: "Find the booking ID to cancel",
      required: false
    },
    {
      tool: "cancel_booking", 
      order: 2,
      purpose: "Cancel the specific booking by ID",
      required: true
    }
  ]
}
```

### Intent Recognition Patterns

- "cancel my booking"
- "remove reservation"
- "delete meeting"
- "cancel room booking"
- "I need to cancel"

### Troubleshooting Guidance

- **Booking ID not found**: Suggest using `get_user_bookings` to find correct ID
- **Permission denied**: Explain ownership requirements and suggest contacting booking owner
- **Already cancelled**: Inform user and suggest checking current bookings
- **Network errors**: Standard connectivity troubleshooting steps