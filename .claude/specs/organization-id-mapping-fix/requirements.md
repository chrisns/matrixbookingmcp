# Organization ID Mapping Fix Requirements

## Overview
The Matrix Booking MCP server is failing to process both desk and room booking requests due to critical organization ID mapping issues that prevent successful bookings and searches across all space types.

## Problem Statement
User attempted to book both a desk and a specific room but both failed with the same underlying issues. Analysis of system logs reveals multiple critical failures affecting all booking types:

1. **Organization ID Resolution Failure**: The system is passing `NaN` instead of valid organization ID

2. **User-Organization Mismatch**: The current user belongs to one organization ID but the location service is trying to use a different organization ID from the preferred location

3. **Date Range Validation Error**: Availability service throws "Invalid date range: End time must be after start time" when dates are identical

4. **Location Hierarchy Retrieval Failure**: `get_locations` returns empty array `[]` instead of location data

## Root Cause Analysis

### Primary Issue: Organization ID Mapping
- User profile shows one organization ID
- Location service uses different organization ID from preferred location
- Search operations fail with `NaN` organization ID due to this mismatch

### Secondary Issues
- Date handling logic incorrectly validates identical start/end times
- Location hierarchy queries return empty results
- MCP server methods `prompts/list` and `resources/list` return "Method not found"

## Requirements

### R1: Fix Organization ID Resolution
**Priority: Critical**
- Ensure consistent organization ID mapping across all services
- Implement fallback logic to use user's organization ID when location organization differs
- Add validation to prevent `NaN` values being passed to organization services

### R2: Fix Date Range Validation
**Priority: High** 
- Update availability service to handle identical start/end times for point-in-time queries
- Implement proper default duration handling for booking queries

### R3: Fix Location Hierarchy Retrieval
**Priority: High**
- Investigate why location hierarchy returns empty results
- Ensure proper authentication context is maintained for location API calls
- Add error handling and logging for location service failures

### R4: Implement Missing MCP Methods
**Priority: Medium**
- Add proper handlers for `prompts/list` and `resources/list` MCP methods
- Ensure full MCP protocol compliance

## Success Criteria
1. User can successfully search for and book meeting rooms/desks
2. `find_rooms_with_facilities` returns valid results instead of empty arrays
3. `get_locations` returns populated location hierarchy
4. Health check shows all services as "healthy" instead of "degraded"
5. No more `NaN` organization ID errors in logs

## Test Scenarios
1. **Desk Booking**: Search for and book an available desk (reproducing the original failure)
2. **Room Booking**: Search for and book a specific room (reproducing the recent failure) 
3. **Facility Search**: Find rooms/desks with specific facilities
4. **Booking Verification**: Confirm bookings appear in user's schedule
5. **End-to-End Flow**: Complete booking workflow from search to confirmation

## Technical Notes
- The preferred location configuration may need updating to match user's organization
- Consider implementing organization context switching for users with access to multiple organizations
- Add comprehensive error handling for organization/location mismatches

## Files to Investigate
- `src/services/organization-service.js:24` (organization validation)
- `src/services/availability-service.js:87` (date range validation) 
- `src/services/search-service.js:252` (location filtering)
- Location hierarchy retrieval logic
- MCP method handlers in main server file