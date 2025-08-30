# Cancel Booking Error Handling Specification

## Overview

This document defines comprehensive error handling requirements for the cancel booking feature, following the established enhanced error handling patterns in the Matrix Booking MCP server.

## Error Classification

### 1. HTTP Status Code Mapping

#### 400 Bad Request - Validation Errors
- **Causes**: Invalid booking ID format, malformed parameters, invalid notification scope
- **Error Type**: `VALIDATION_ERROR`
- **Error Code**: `BAD_REQUEST`
- **Context**: Parameter validation failure

#### 401 Unauthorized - Authentication Errors  
- **Causes**: Invalid credentials, expired tokens, missing authentication
- **Error Type**: `AUTHENTICATION_ERROR`
- **Error Code**: `AUTH_FAILED`
- **Context**: Authentication failure

#### 403 Forbidden - Permission Errors
- **Causes**: User lacks permission to cancel booking, non-owner attempting cancellation
- **Error Type**: `PERMISSION_ERROR`
- **Error Code**: `FORBIDDEN`
- **Context**: Authorization failure

#### 404 Not Found - Resource Errors
- **Causes**: Booking ID does not exist, booking already deleted
- **Error Type**: `RESOURCE_NOT_FOUND`
- **Error Code**: `BOOKING_NOT_FOUND`
- **Context**: Booking lookup failure

#### 405 Method Not Allowed - API Configuration
- **Causes**: DELETE method not enabled, API endpoint configuration issue
- **Error Type**: `HTTP_METHOD_ERROR`
- **Error Code**: `METHOD_NOT_ALLOWED`
- **Context**: API configuration issue

#### 409 Conflict - Business Logic Errors
- **Causes**: Booking already cancelled, booking in progress, booking cannot be cancelled
- **Error Type**: `BOOKING_CONFLICT_ERROR`
- **Error Code**: `BOOKING_CONFLICT`
- **Context**: Business rule violation

#### 429 Too Many Requests - Rate Limiting
- **Causes**: Too many cancellation requests, API rate limit exceeded
- **Error Type**: `RATE_LIMIT_ERROR`
- **Error Code**: `RATE_LIMIT_EXCEEDED`
- **Context**: Rate limiting

#### 500 Internal Server Error - Server Errors
- **Causes**: Matrix API internal error, database issues, service failures
- **Error Type**: `SERVER_ERROR`
- **Error Code**: `INTERNAL_SERVER_ERROR`
- **Context**: Server-side failure

#### 502 Bad Gateway - Gateway Errors
- **Causes**: Upstream service unavailable, proxy configuration issues
- **Error Type**: `SERVER_ERROR`
- **Error Code**: `BAD_GATEWAY`
- **Context**: Gateway failure

#### 503 Service Unavailable - Service Errors
- **Causes**: Matrix API maintenance, service overload, temporary unavailability
- **Error Type**: `SERVER_ERROR`
- **Error Code**: `SERVICE_UNAVAILABLE`
- **Context**: Service unavailability

#### 504 Gateway Timeout - Timeout Errors
- **Causes**: API response timeout, network delays, service overload
- **Error Type**: `TIMEOUT_ERROR`
- **Error Code**: `GATEWAY_TIMEOUT`
- **Context**: Request timeout

## Enhanced Error Response Structure

### Standard Error Response Format
```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "ERROR_CODE_CONSTANT",
    "httpStatus": 404,
    "context": "cancel_booking",
    "tool": "matrix_booking_cancel_booking",
    "bookingId": "12345",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "suggestions": [
    {
      "action": "Actionable step description",
      "tool": "recommended_tool_name",
      "description": "Detailed explanation of suggested action",
      "parameters": {
        "key": "value"
      }
    }
  ],
  "relatedWorkflows": [
    "Workflow category or name"
  ],
  "troubleshooting": {
    "commonCauses": [
      "Most likely cause of this error",
      "Secondary cause possibility"
    ],
    "diagnosticSteps": [
      "1. First diagnostic step to try",
      "2. Second diagnostic step if first fails"
    ]
  },
  "recovery": {
    "immediateActions": [
      "Quick fix or workaround"
    ],
    "alternativeWorkflows": [
      "Alternative approach to achieve user goal"
    ]
  }
}
```

### Error-Specific Response Examples

#### Booking Not Found Error (404)
```json
{
  "error": {
    "message": "Booking ID 12345 not found or has already been cancelled",
    "code": "BOOKING_NOT_FOUND",
    "httpStatus": 404,
    "context": "cancel_booking",
    "tool": "matrix_booking_cancel_booking",
    "bookingId": "12345"
  },
  "suggestions": [
    {
      "action": "List your current active bookings",
      "tool": "get_user_bookings",
      "description": "Verify booking exists and get correct booking ID",
      "parameters": {
        "status": "ACTIVE"
      }
    },
    {
      "action": "Check cancelled bookings",
      "tool": "get_user_bookings",
      "description": "See if booking was already cancelled",
      "parameters": {
        "status": "CANCELLED"
      }
    }
  ],
  "relatedWorkflows": [
    "Booking verification and management"
  ],
  "troubleshooting": {
    "commonCauses": [
      "Booking ID does not exist in the system",
      "Booking was already cancelled by you or another user",
      "Booking ID format is incorrect (should be numeric)",
      "Booking exists but in different organization/account"
    ],
    "diagnosticSteps": [
      "1. Use get_user_bookings to list your current bookings",
      "2. Verify the booking ID format is correct (numeric)",
      "3. Check if booking appears in cancelled bookings list",
      "4. Ensure you're connected to the correct Matrix organization"
    ]
  },
  "recovery": {
    "immediateActions": [
      "Use get_user_bookings to find valid booking IDs"
    ],
    "alternativeWorkflows": [
      "Browse active bookings and select correct booking to cancel"
    ]
  }
}
```

#### Permission Denied Error (403)
```json
{
  "error": {
    "message": "You do not have permission to cancel booking 12345. Only the booking owner can cancel bookings.",
    "code": "INSUFFICIENT_PERMISSIONS",
    "httpStatus": 403,
    "context": "cancel_booking",
    "tool": "matrix_booking_cancel_booking",
    "bookingId": "12345"
  },
  "suggestions": [
    {
      "action": "Verify booking ownership",
      "tool": "get_user_bookings", 
      "description": "Check which bookings you own and can cancel"
    },
    {
      "action": "Contact the booking owner",
      "tool": "get_tool_guidance",
      "description": "Get guidance on contacting booking owner for cancellation",
      "parameters": {
        "intent": "booking owner contact process"
      }
    },
    {
      "action": "Check your account permissions",
      "tool": "get_current_user",
      "description": "Verify your account status and permissions"
    }
  ],
  "relatedWorkflows": [
    "Booking ownership verification",
    "Permission troubleshooting"
  ],
  "troubleshooting": {
    "commonCauses": [
      "Booking is owned by another user",
      "You are not listed as the booking owner in the system",
      "Your account lacks administrative cancellation privileges",
      "Booking ownership changed after creation"
    ],
    "diagnosticSteps": [
      "1. Use get_user_bookings to verify which bookings you own",
      "2. Check if you are the original creator of the booking",
      "3. Verify your account has proper permissions with get_current_user",
      "4. Contact system administrator if you should have access"
    ]
  },
  "recovery": {
    "immediateActions": [
      "Only attempt to cancel bookings you created",
      "Contact the booking owner to request cancellation"
    ],
    "alternativeWorkflows": [
      "Ask booking owner to cancel and create new booking if needed",
      "Check with administrator about booking transfer options"
    ]
  }
}
```

#### Booking Conflict Error (409)
```json
{
  "error": {
    "message": "Booking 12345 cannot be cancelled because it has already started or is in progress",
    "code": "BOOKING_IN_PROGRESS", 
    "httpStatus": 409,
    "context": "cancel_booking",
    "tool": "matrix_booking_cancel_booking",
    "bookingId": "12345"
  },
  "suggestions": [
    {
      "action": "Check booking status and timing",
      "tool": "get_user_bookings",
      "description": "Verify booking start time and current status"
    },
    {
      "action": "End current booking session",
      "tool": "get_tool_guidance",
      "description": "Get guidance on ending in-progress bookings",
      "parameters": {
        "intent": "end active booking session"
      }
    }
  ],
  "relatedWorkflows": [
    "Active booking management",
    "Booking state troubleshooting"
  ],
  "troubleshooting": {
    "commonCauses": [
      "Booking start time has already passed and session is active",
      "Booking was already cancelled by another process",
      "System clock synchronization issues",
      "Booking completion status not properly updated"
    ],
    "diagnosticSteps": [
      "1. Check current time vs booking start time",
      "2. Verify booking status in get_user_bookings",
      "3. Check if booking auto-completed or expired",
      "4. Confirm booking hasn't been modified by another user"
    ]
  },
  "recovery": {
    "immediateActions": [
      "Wait for booking session to complete naturally",
      "Contact administrator to force-end active session if appropriate"
    ],
    "alternativeWorkflows": [
      "Let current booking complete and cancel future instances if recurring",
      "Create new booking for rescheduled meeting"
    ]
  }
}
```

## Error Detection and Classification Logic

### Error Analysis Function Enhancement
```typescript
private analyzeError(error: unknown): {
  message: string;
  code?: string;
  httpStatus?: number;
  type: string;
  bookingId?: string | number;
} {
  if (error instanceof Error) {
    const errorMessage = error.message;
    let result = {
      message: errorMessage,
      type: 'UNKNOWN_ERROR',
      code: 'UNKNOWN_ERROR'
    };

    // Extract booking ID if present in error message
    const bookingIdMatch = errorMessage.match(/booking\s+(?:ID\s+)?(\d+)/i);
    if (bookingIdMatch) {
      result.bookingId = bookingIdMatch[1];
    }

    // Cancel booking specific error patterns
    if (errorMessage.includes('booking not found') || errorMessage.includes('does not exist')) {
      result.type = 'RESOURCE_NOT_FOUND';
      result.code = 'BOOKING_NOT_FOUND';
      result.httpStatus = 404;
    } else if (errorMessage.includes('already cancelled') || errorMessage.includes('already canceled')) {
      result.type = 'BOOKING_CONFLICT_ERROR';
      result.code = 'BOOKING_ALREADY_CANCELLED';
      result.httpStatus = 409;
    } else if (errorMessage.includes('in progress') || errorMessage.includes('has started')) {
      result.type = 'BOOKING_CONFLICT_ERROR';
      result.code = 'BOOKING_IN_PROGRESS';
      result.httpStatus = 409;
    } else if (errorMessage.includes('permission') || errorMessage.includes('not authorized')) {
      result.type = 'PERMISSION_ERROR';
      result.code = 'INSUFFICIENT_PERMISSIONS';
      result.httpStatus = 403;
    } else if (errorMessage.includes('invalid booking id') || errorMessage.includes('malformed id')) {
      result.type = 'VALIDATION_ERROR';
      result.code = 'INVALID_BOOKING_ID';
      result.httpStatus = 400;
    } else if (errorMessage.includes('notification failed') || errorMessage.includes('email failed')) {
      result.type = 'NOTIFICATION_ERROR';
      result.code = 'NOTIFICATION_DELIVERY_FAILED';
      result.httpStatus = 200; // Booking cancelled successfully but notifications failed
    }

    // ... continue with standard HTTP status detection logic

    return result;
  }

  return {
    message: error ? String(error) : 'Unknown error occurred',
    type: 'UNKNOWN_ERROR'
  };
}
```

### Cancel Booking Specific Error Suggestions
```typescript
private getCancelBookingErrorSuggestions(errorType: string, errorCode: string, bookingId?: string): {
  actions: MCPErrorSuggestion[];
  workflows: string[];
  commonCauses: string[];
  diagnosticSteps: string[];
  recovery: {
    immediateActions: string[];
    alternativeWorkflows: string[];
  };
} {
  const suggestions = {
    actions: [] as MCPErrorSuggestion[],
    workflows: [] as string[],
    commonCauses: [] as string[],
    diagnosticSteps: [] as string[],
    recovery: {
      immediateActions: [] as string[],
      alternativeWorkflows: [] as string[]
    }
  };

  switch (errorType) {
    case 'RESOURCE_NOT_FOUND':
      suggestions.actions.push(
        {
          action: "List your current active bookings",
          tool: "get_user_bookings",
          description: "Find valid booking IDs that can be cancelled",
          parameters: { status: "ACTIVE" }
        },
        {
          action: "Check recently cancelled bookings",
          tool: "get_user_bookings", 
          description: "Verify if booking was already cancelled",
          parameters: { status: "CANCELLED" }
        }
      );
      suggestions.workflows = ["Booking verification and discovery"];
      suggestions.commonCauses = [
        "Booking ID does not exist",
        "Booking already cancelled",
        "Incorrect booking ID format",
        "Booking in different organization"
      ];
      suggestions.diagnosticSteps = [
        "1. Use get_user_bookings to list valid bookings",
        "2. Verify booking ID format is numeric",
        "3. Check cancelled bookings list",
        "4. Confirm you're in correct organization"
      ];
      suggestions.recovery.immediateActions = [
        "Get valid booking IDs from get_user_bookings"
      ];
      suggestions.recovery.alternativeWorkflows = [
        "Browse and select booking to cancel from active bookings list"
      ];
      break;

    case 'PERMISSION_ERROR':
      suggestions.actions.push(
        {
          action: "Verify your booking ownership",
          tool: "get_user_bookings",
          description: "List bookings you own and have permission to cancel"
        },
        {
          action: "Check account permissions",
          tool: "get_current_user",
          description: "Verify your account status and role permissions"
        },
        {
          action: "Get booking owner contact info",
          tool: "get_tool_guidance",
          description: "Find out how to contact the booking owner",
          parameters: { intent: "contact booking owner" }
        }
      );
      suggestions.workflows = ["Permission verification and escalation"];
      suggestions.commonCauses = [
        "Booking owned by another user",
        "Insufficient account permissions",
        "Booking ownership changed",
        "Administrative restrictions"
      ];
      suggestions.diagnosticSteps = [
        "1. Verify booking ownership with get_user_bookings",
        "2. Check account permissions with get_current_user",
        "3. Confirm you created the original booking",
        "4. Contact administrator if permissions seem incorrect"
      ];
      suggestions.recovery.immediateActions = [
        "Only cancel bookings you own",
        "Contact booking owner for cancellation"
      ];
      suggestions.recovery.alternativeWorkflows = [
        "Request booking owner to cancel",
        "Ask administrator about permission escalation"
      ];
      break;

    case 'BOOKING_CONFLICT_ERROR':
      if (errorCode === 'BOOKING_IN_PROGRESS') {
        suggestions.actions.push(
          {
            action: "Check booking timing and status",
            tool: "get_user_bookings",
            description: "Verify if booking has started and current status"
          },
          {
            action: "End active booking session",
            tool: "get_tool_guidance", 
            description: "Get guidance on ending in-progress bookings",
            parameters: { intent: "end active booking" }
          }
        );
        suggestions.commonCauses = [
          "Booking start time has passed",
          "Active booking session in progress",
          "System clock synchronization issue"
        ];
        suggestions.recovery.immediateActions = [
          "Wait for booking to complete naturally",
          "End current booking session if appropriate"
        ];
      } else if (errorCode === 'BOOKING_ALREADY_CANCELLED') {
        suggestions.actions.push(
          {
            action: "Verify booking status",
            tool: "get_user_bookings",
            description: "Check if booking is already cancelled",
            parameters: { status: "CANCELLED" }
          }
        );
        suggestions.commonCauses = [
          "Booking already cancelled by you",
          "Booking cancelled by another user",
          "Duplicate cancellation request"
        ];
        suggestions.recovery.immediateActions = [
          "Check cancelled bookings list to confirm"
        ];
      }
      
      suggestions.workflows = ["Booking state management"];
      suggestions.diagnosticSteps = [
        "1. Check current time vs booking schedule",
        "2. Verify booking status and state",
        "3. Check for recent booking modifications",
        "4. Confirm no duplicate operations in progress"
      ];
      break;

    case 'VALIDATION_ERROR':
      suggestions.actions.push(
        {
          action: "Get properly formatted booking ID",
          tool: "get_user_bookings",
          description: "Get valid booking IDs in correct format"
        },
        {
          action: "Validate cancellation parameters",
          tool: "get_tool_guidance",
          description: "Get parameter format guidance for booking cancellation",
          parameters: { intent: "cancel booking parameter validation" }
        }
      );
      suggestions.workflows = ["Parameter validation and correction"];
      suggestions.commonCauses = [
        "Invalid booking ID format",
        "Missing required parameters",
        "Parameter values outside valid ranges",
        "Malformed notification scope value"
      ];
      suggestions.diagnosticSteps = [
        "1. Verify booking ID is numeric",
        "2. Check all required parameters are provided",
        "3. Validate notification scope enum values",
        "4. Ensure reason text is within character limits"
      ];
      suggestions.recovery.immediateActions = [
        "Use numeric booking ID from get_user_bookings",
        "Verify all parameter formats match specification"
      ];
      break;

    case 'TIMEOUT_ERROR':
      suggestions.actions.push(
        {
          action: "Retry cancellation with simpler parameters",
          tool: "matrix_booking_cancel_booking",
          description: "Try again with minimal parameters",
          parameters: bookingId ? { bookingId, sendNotifications: false } : undefined
        },
        {
          action: "Check system health",
          tool: "health_check",
          description: "Verify system connectivity and performance"
        }
      );
      suggestions.workflows = ["Timeout recovery and retry"];
      suggestions.commonCauses = [
        "Network connectivity issues",
        "Matrix API performance problems",
        "High system load causing delays"
      ];
      suggestions.diagnosticSteps = [
        "1. Check network connectivity",
        "2. Try with disabled notifications for faster response",
        "3. Wait a few minutes and retry",
        "4. Check system status with health_check"
      ];
      suggestions.recovery.immediateActions = [
        "Retry with sendNotifications: false",
        "Wait 1-2 minutes before retrying"
      ];
      break;

    case 'NOTIFICATION_ERROR':
      suggestions.actions.push(
        {
          action: "Verify booking was cancelled",
          tool: "get_user_bookings",
          description: "Confirm booking cancellation succeeded despite notification failure",
          parameters: { status: "CANCELLED" }
        },
        {
          action: "Check notification settings", 
          tool: "get_current_user",
          description: "Verify user notification preferences and settings"
        }
      );
      suggestions.workflows = ["Notification troubleshooting"];
      suggestions.commonCauses = [
        "Email service temporarily unavailable",
        "Invalid attendee email addresses",
        "Notification service configuration issue"
      ];
      suggestions.diagnosticSteps = [
        "1. Confirm booking was actually cancelled",
        "2. Check if attendees received notifications manually",
        "3. Verify email service status",
        "4. Check notification service configuration"
      ];
      suggestions.recovery.immediateActions = [
        "Booking cancellation succeeded - manually notify attendees if needed"
      ];
      break;

    default:
      // Universal cancel booking fallbacks
      suggestions.actions.push(
        {
          action: "Verify booking exists and status",
          tool: "get_user_bookings",
          description: "Check booking status and get valid booking information"
        },
        {
          action: "Run system diagnostics",
          tool: "health_check",
          description: "Check overall system health and connectivity",
          parameters: { verbose: true }
        },
        {
          action: "Get cancellation guidance",
          tool: "get_tool_guidance",
          description: "Get specific guidance for booking cancellation issues",
          parameters: { intent: "cancel booking troubleshooting" }
        }
      );
      suggestions.workflows = ["General cancellation troubleshooting"];
      suggestions.commonCauses = [
        "Unexpected system error",
        "Service connectivity issue", 
        "Invalid request parameters",
        "Temporary service disruption"
      ];
      suggestions.diagnosticSteps = [
        "1. Verify booking exists with get_user_bookings",
        "2. Check system health with health_check", 
        "3. Validate all parameters are correct",
        "4. Wait and retry the operation",
        "5. Contact support if problem persists"
      ];
      suggestions.recovery.immediateActions = [
        "Check booking status first",
        "Run health_check for diagnostics"
      ];
  }

  return suggestions;
}
```

## Error Logging and Monitoring

### Structured Error Logging
```typescript
private logCancelBookingError(
  error: unknown, 
  bookingId: string | number | undefined,
  userId: string | undefined,
  context: Record<string, unknown>
): void {
  const errorInfo = this.analyzeError(error);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    operation: 'cancel_booking',
    tool: 'matrix_booking_cancel_booking',
    error: {
      type: errorInfo.type,
      code: errorInfo.code,
      message: errorInfo.message,
      httpStatus: errorInfo.httpStatus
    },
    context: {
      bookingId: bookingId?.toString(),
      userId,
      ...context
    },
    // Don't log sensitive data
    sanitized: true
  };

  console.error('Cancel Booking Error:', JSON.stringify(logEntry, null, 2));
}
```

### Error Metrics Collection
```typescript
// Track error patterns for monitoring and improvement
private trackCancelBookingError(errorType: string, errorCode: string, bookingId?: string): void {
  // Increment error counters by type
  this.metrics.incrementCounter(`cancel_booking.errors.${errorType.toLowerCase()}`);
  
  // Track specific error codes
  if (errorCode) {
    this.metrics.incrementCounter(`cancel_booking.errors.codes.${errorCode.toLowerCase()}`);
  }

  // Track booking-specific errors (without exposing booking details)
  if (bookingId) {
    this.metrics.incrementCounter('cancel_booking.errors.with_booking_id');
  }
}
```

## Recovery Workflows

### Automatic Recovery Strategies
```typescript
private async attemptErrorRecovery(
  error: unknown, 
  originalRequest: ICancelBookingRequest,
  attemptCount: number = 0
): Promise<ICancelBookingResponse | null> {
  if (attemptCount >= 3) return null; // Max 3 retry attempts

  const errorInfo = this.analyzeError(error);
  
  switch (errorInfo.type) {
    case 'TIMEOUT_ERROR':
      // Retry with simpler parameters
      const simplifiedRequest: ICancelBookingRequest = {
        bookingId: originalRequest.bookingId,
        sendNotifications: false, // Disable notifications for faster response
        notifyScope: 'NONE'
      };
      
      await this.delay(1000 * (attemptCount + 1)); // Exponential backoff
      return this.cancelBooking(simplifiedRequest);

    case 'RATE_LIMIT_ERROR':
      // Wait and retry with exponential backoff
      await this.delay(5000 * Math.pow(2, attemptCount));
      return this.cancelBooking(originalRequest);

    case 'SERVER_ERROR':
      // Brief wait for temporary server issues
      if (attemptCount < 2) {
        await this.delay(2000);
        return this.cancelBooking(originalRequest);
      }
      break;
  }

  return null; // No automatic recovery possible
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Testing Requirements

### Error Scenario Test Cases
```typescript
describe('Cancel Booking Error Handling', () => {
  test('should handle booking not found error with proper suggestions', async () => {
    // Test 404 error handling and suggestion generation
  });

  test('should handle permission denied with ownership guidance', async () => {
    // Test 403 error handling and recovery workflows  
  });

  test('should handle booking conflict with state verification', async () => {
    // Test 409 error handling and state checking suggestions
  });

  test('should handle timeout errors with retry mechanisms', async () => {
    // Test timeout handling and automatic retry logic
  });

  test('should handle notification failures gracefully', async () => {
    // Test partial success scenarios (booking cancelled, notifications failed)
  });

  test('should provide appropriate recovery suggestions for each error type', async () => {
    // Test suggestion generation for all error categories
  });
});
```

### Error Message Validation Tests
```typescript
describe('Error Message Quality', () => {
  test('should provide actionable error messages', async () => {
    // Verify error messages contain specific actionable guidance
  });

  test('should include relevant context in error responses', async () => {
    // Verify booking ID and user context included where appropriate
  });

  test('should sanitize error messages for security', async () => {
    // Verify no sensitive data leaked in error messages
  });

  test('should provide consistent error format across scenarios', async () => {
    // Verify all errors follow same enhanced format structure
  });
});
```

This comprehensive error handling specification ensures robust, user-friendly error management for the cancel booking feature while maintaining consistency with the existing enhanced error handling patterns in the codebase.