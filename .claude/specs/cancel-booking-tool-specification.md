# Cancel Booking Tool - Technical Specification

## Tool Definition

### Tool Name
`matrix_booking_cancel_booking`

### Tool Description
```
Cancel an existing room or desk booking with notification options. Use this tool to cancel bookings you own or have permission to cancel.

Common Use Cases:
- "Cancel my 3pm meeting room booking"
- "Cancel booking ID 12345 and notify attendees" 
- "Remove my desk reservation for tomorrow"
- "Cancel the conference room booking for project meeting"

Not For:
- Creating new bookings (use matrix_booking_create_booking)
- Checking availability (use matrix_booking_check_availability)
- Viewing existing bookings (use get_user_bookings)
- Modifying booking details (contact administrator)

Workflow Position: Final action in booking management workflow - Use after identifying booking to cancel

Prerequisites:
- Use get_user_bookings to find the booking ID to cancel
- Verify booking ownership and permissions
- Consider notifying attendees about cancellation

Related Tools:
- get_user_bookings: Prerequisite - Find booking ID to cancel
- matrix_booking_check_availability: Follow-up - Find alternative time slots
- matrix_booking_create_booking: Follow-up - Create replacement booking
- matrix_booking_get_location: Support - Get location details for cancelled booking
```

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "bookingId": {
      "type": ["string", "number"],
      "description": "The booking ID to cancel. Can be string or number format. Required parameter."
    },
    "notifyScope": {
      "type": "string",
      "enum": ["ALL_ATTENDEES", "OWNER_ONLY", "NONE"],
      "description": "Who to notify about the cancellation. Defaults to 'ALL_ATTENDEES'.",
      "default": "ALL_ATTENDEES"
    },
    "sendNotifications": {
      "type": "boolean",
      "description": "Whether to send cancellation notifications. Defaults to true.",
      "default": true
    },
    "reason": {
      "type": "string",
      "description": "Optional cancellation reason for attendee notification and audit trail. Maximum 500 characters.",
      "maxLength": 500
    }
  },
  "required": ["bookingId"],
  "additionalProperties": false
}
```

## Implementation Specification

### Service Layer Method
```typescript
// In src/services/booking-service.ts
async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
  // Validate request parameters
  const validationResult = this.validateCancelBookingRequest(request);
  if (!validationResult.isValid) {
    throw new Error(`Invalid cancel booking request: ${validationResult.errors.join(', ')}`);
  }

  // Get credentials and make API call
  const credentials = await this.authManager.getCredentials();
  return await this.apiClient.cancelBooking(request, credentials);
}

private validateCancelBookingRequest(request: ICancelBookingRequest): ValidationResult {
  const errors: string[] = [];
  
  // Validate booking ID
  if (!request.bookingId) {
    errors.push('bookingId is required');
  } else if (typeof request.bookingId === 'string' && !request.bookingId.trim()) {
    errors.push('bookingId cannot be empty string');
  } else if (typeof request.bookingId === 'number' && request.bookingId <= 0) {
    errors.push('bookingId must be positive number');
  }

  // Validate notification scope
  if (request.notifyScope && !['ALL_ATTENDEES', 'OWNER_ONLY', 'NONE'].includes(request.notifyScope)) {
    errors.push('notifyScope must be one of: ALL_ATTENDEES, OWNER_ONLY, NONE');
  }

  // Validate reason length
  if (request.reason && request.reason.length > 500) {
    errors.push('reason cannot exceed 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### API Client Method
```typescript
// In src/api/matrix-api-client.ts
async cancelBooking(request: ICancelBookingRequest, credentials: ICredentials): Promise<ICancelBookingResponse> {
  const config = this.configManager.getConfig();
  const headers = this.authManager.createAuthHeader(credentials);
  
  // Build query parameters
  const params = new URLSearchParams();
  params.append('notifyScope', request.notifyScope || 'ALL_ATTENDEES');
  params.append('sendNotifications', (request.sendNotifications !== false).toString());
  
  if (request.reason) {
    params.append('reason', request.reason);
  }

  const url = `${config.apiBaseUrl}/booking/${request.bookingId}?${params.toString()}`;
  
  const apiRequest: IAPIRequest = {
    method: 'DELETE',
    url,
    headers
  };

  const response = await this.makeRequest<ICancelBookingResponse>(apiRequest);
  return response.data;
}
```

### MCP Server Handler
```typescript
// In src/mcp/mcp-server.ts
private async handleCancelBooking(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  console.error('MCP Server: Handling cancel booking request:', args);

  try {
    // Build request object with validated parameters
    const request: ICancelBookingRequest = {
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
```

## Type Definitions

### Interface Definitions
```typescript
// In src/types/booking.types.ts

export interface ICancelBookingRequest {
  bookingId: string | number;
  notifyScope?: 'ALL_ATTENDEES' | 'OWNER_ONLY' | 'NONE';
  sendNotifications?: boolean;
  reason?: string;
}

export interface ICancelBookingResponse {
  success: boolean;
  bookingId: number;
  status: string;
  cancellationTime: string;
  notificationsSent: boolean;
  notifyScope: string;
  reason?: string;
  originalBooking?: {
    locationId: number;
    locationName?: string;
    timeFrom: string;
    timeTo: string;
    attendeeCount?: number;
    owner?: string;
  };
}

export interface IBookingService {
  // ... existing methods
  cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse>;
}
```

```typescript
// In src/types/api.types.ts

export interface IMatrixAPIClient {
  // ... existing methods
  cancelBooking(request: ICancelBookingRequest, credentials: ICredentials): Promise<ICancelBookingResponse>;
}
```

## Error Handling Specification

### Error Context Integration
```typescript
// Enhanced error suggestions for cancel booking context
private getErrorSuggestions(errorType: string, errorCode: string | undefined, toolContext: string): ErrorSuggestionsResult {
  // ... existing error handling

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
```

### Standard Error Messages
```typescript
// Error message mapping for cancel booking specific errors
const CANCEL_BOOKING_ERROR_MESSAGES = {
  BOOKING_NOT_FOUND: 'The specified booking ID does not exist or has already been cancelled.',
  BOOKING_NOT_CANCELLABLE: 'This booking cannot be cancelled. It may have already started or been completed.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to cancel this booking. Only the booking owner can cancel bookings.',
  BOOKING_IN_PROGRESS: 'Cannot cancel a booking that is currently in progress.',
  INVALID_BOOKING_ID: 'The booking ID format is invalid. Please provide a valid booking ID.',
  NOTIFICATION_FAILED: 'Booking was cancelled but some notifications could not be sent.',
  API_UNAVAILABLE: 'The booking cancellation service is temporarily unavailable. Please try again later.'
};
```

## Integration Points

### Tool Guidance Integration
```typescript
// Add to get_tool_guidance intentMapping
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
```

### Workflow Integration
```typescript
// Add to workflows in get_tool_guidance
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
}
```

## Validation Rules

### Input Validation
1. **bookingId**: Required, must be non-empty string or positive number
2. **notifyScope**: Must be valid enum value if provided
3. **sendNotifications**: Must be boolean if provided
4. **reason**: Maximum 500 characters, HTML/XSS sanitization

### Business Logic Validation  
1. **Booking Existence**: Verify booking exists before attempting cancellation
2. **Permission Check**: Verify user has permission to cancel the specific booking
3. **Booking State**: Ensure booking is in cancellable state (not completed, not in progress)
4. **Timing Constraints**: Check if booking has minimum cancellation notice requirements

### Response Validation
1. **Success Response**: Must include booking ID and cancellation timestamp
2. **Error Response**: Must follow enhanced error format with actionable suggestions
3. **Notification Status**: Must indicate whether notifications were successfully sent

## Performance Requirements

### Response Time Targets
- **Normal cancellation**: < 2 seconds
- **With notification sending**: < 5 seconds
- **Error responses**: < 1 second

### Timeout Handling
- **API timeout**: 30 seconds (configurable)
- **Notification timeout**: 10 seconds (non-blocking)
- **Graceful degradation**: Cancel booking even if notifications fail

### Resource Usage
- **Memory**: Minimal additional memory footprint
- **Network**: Single DELETE request to Matrix API
- **Logging**: Standard operation logging without sensitive data

## Security Considerations

### Input Sanitization
- Sanitize reason field to prevent XSS attacks
- Validate booking ID format to prevent injection
- Escape special characters in error messages

### Authorization
- Verify user session before attempting cancellation  
- Check booking ownership permissions
- Log cancellation attempts for audit trail

### Data Privacy
- Do not log sensitive booking details
- Sanitize error messages to prevent data leakage
- Respect notification preferences in response

## Testing Strategy

### Unit Tests
- Parameter validation testing
- Error handling for each error type
- Response formatting verification
- Permission checking logic

### Integration Tests  
- End-to-end cancellation workflow
- Authentication and authorization flow
- Matrix API integration testing
- Notification system integration

### Error Scenario Tests
- Invalid booking ID handling
- Permission denied scenarios
- API unavailability handling
- Network timeout recovery

## Documentation Requirements

### Tool Description
- Clear usage examples and common scenarios
- Workflow positioning and prerequisites  
- Related tool recommendations
- Parameter explanations with examples

### Error Documentation
- Complete error code reference
- Troubleshooting guides for common issues
- Recovery workflow suggestions
- Escalation procedures

### API Documentation
- Request/response format specifications
- Authentication requirements
- Rate limiting considerations
- Changelog and version history

This specification provides the complete technical foundation for implementing the cancel booking tool while maintaining consistency with existing codebase patterns and providing comprehensive error handling and user guidance.