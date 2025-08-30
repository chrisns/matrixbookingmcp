# Product Overview

## Critical Business Logic Rules
- **ALWAYS check availability before booking** - Use `matrix_booking_check_availability` before `matrix_booking_create_booking`
- **Default to MATRIX_PREFERED_LOCATION** from environment when location unspecified (src/config/config-manager.ts:32)
- **Use today's date** when no date provided in requests
- **Maintain stateless operation** - No caching or persistent state between requests
- **Authenticate every request** with HTTP Basic Auth using MATRIX_USERNAME/MATRIX_PASSWORD

## Primary MCP Tools (in order of importance)
1. **`matrix_booking_check_availability`** - Core tool for finding available spaces
2. **`get_user_bookings`** - Primary tool for existing booking queries 
3. **`matrix_booking_create_booking`** - Final step in booking workflow
4. **`matrix_booking_cancel_booking`** - Cancel existing bookings with notifications
5. **`find_rooms_with_facilities`** - Advanced search with facility requirements

## Tool Usage Patterns
- **Existing bookings inquiry**: Always use `get_user_bookings`, NEVER `matrix_booking_check_availability`
- **New booking creation**: Start with `matrix_booking_check_availability` OR `find_rooms_with_facilities`, then `matrix_booking_create_booking`
- **Booking cancellation**: First `get_user_bookings` to find booking ID, then `matrix_booking_cancel_booking`

## API Integration Specifics
- **Base URL**: https://app.matrixbooking.com/api/v1 (src/config/config-manager.ts)
- **Authentication**: HTTP Basic Auth with environment credentials
- **Notification scope**: ALL_ATTENDEES for bookings
- **Timezone**: Europe/London default
- **Required environment variables**: MATRIX_USERNAME, MATRIX_PASSWORD, MATRIX_PREFERED_LOCATION

## Error Handling Requirements
- Provide specific tool suggestions in error responses (src/mcp/mcp-server.ts:480+)
- Include troubleshooting steps for common authentication/network failures
- Never guess workspace IDs - always retrieve from authenticated context