# MCP Tool to API Endpoint Mapping

## Overview

This document maps Matrix Booking MCP tools to their underlying API endpoints and describes the expected usage patterns for AI assistants.

## Current Tool Mapping

### User Information Tools

#### `get_current_user`
- **API Endpoint**: `GET /user/current` 
- **Purpose**: Retrieve authenticated user profile and organization context
- **Use Cases**:
  - Initial context gathering
  - Organization ID lookup for other operations
  - User permission verification
- **Returns**: User profile with organization ID, roles, authentication methods

### Booking Management Tools

#### `matrix_booking_check_availability`
- **API Endpoint**: `POST /availability/check`
- **Purpose**: Check room/space availability for booking
- **Use Cases**:
  - "Are there any rooms available at 2pm?"
  - "What spaces are free tomorrow morning?"
  - Pre-booking availability verification
- **Parameters**: Date range, location filter, duration requirements
- **❌ NOT FOR**: Retrieving user's existing bookings

#### `matrix_booking_create_booking`  
- **API Endpoint**: `POST /bookings`
- **Purpose**: Create new room/space reservation
- **Use Cases**:
  - "Book me a conference room for 2pm"
  - "Reserve desk 42 for tomorrow"
- **Parameters**: Time range, location, attendees, requirements

#### `matrix_booking_get_location`
- **API Endpoint**: `GET /locations/{id}`
- **Purpose**: Get details about specific location
- **Use Cases**:
  - Location information lookup
  - Capacity and facility verification
  - Building/floor context

### Discovery and Search Tools

#### `get_locations`
- **API Endpoint**: `GET /locations` with filters
- **Purpose**: Hierarchical location discovery
- **Use Cases**:
  - "What floors are in Building A?"
  - "Show me all meeting rooms"
  - Location tree exploration

#### `get_booking_categories`  
- **API Endpoint**: `GET /organizations/{id}/categories`
- **Purpose**: Get available booking types (rooms, desks, etc.)
- **Use Cases**:
  - Understanding available space types
  - Category-based filtering

#### `discover_available_facilities`
- **API Endpoint**: Composite query to `/locations` + facility analysis
- **Purpose**: Find facility types across locations
- **Use Cases**:
  - "What AV equipment is available?"
  - "Which rooms have conference phones?"

#### `find_rooms_with_facilities`
- **API Endpoint**: Complex search combining multiple endpoints
- **Purpose**: Natural language space search with requirements
- **Use Cases**:
  - "Find a room with projector for 6 people tomorrow"
  - "I need a quiet space with whiteboard"

### Health and Diagnostics

#### `health_check`
- **API Endpoint**: Multiple service endpoints for validation
- **Purpose**: Verify MCP server and API connectivity
- **Use Cases**:
  - Troubleshooting connection issues
  - Service status verification

## Missing Critical Functionality

### ❗ Missing: User Booking Retrieval

**Problem**: No tool exists to retrieve user's existing bookings

**Required Tool**: `get_user_bookings`
- **API Endpoint**: `GET /users/{id}/bookings` (exists in UserService)
- **Purpose**: Retrieve user's current and future bookings
- **Use Cases**:
  - "What meetings do I have tomorrow?"
  - "Show my desk bookings for this week"
  - "Do I have any room conflicts?"

**Implementation Gap**: UserService has `getUserBookings()` method but no MCP tool handler

## AI Assistant Usage Guidelines

### Correct Tool Selection Matrix

| User Query Pattern | Correct Tool | Wrong Tool (Common Mistake) |
|-------------------|-------------|----------------------------|
| "What's my booking tomorrow?" | `get_user_bookings` | ❌ `matrix_booking_check_availability` |
| "Am I booked anywhere today?" | `get_user_bookings` | ❌ `matrix_booking_check_availability` |  
| "Show my desk reservations" | `get_user_bookings` | ❌ `get_locations` |
| "Are there rooms free at 2pm?" | `matrix_booking_check_availability` | ✅ Correct |
| "Book me a meeting room" | `matrix_booking_create_booking` | ✅ Correct |
| "Find rooms with projectors" | `find_rooms_with_facilities` | ❌ `discover_available_facilities` |

### Workflow Patterns

#### Pattern 1: User Booking Inquiry
1. `get_user_bookings` - Get current bookings
2. Optional: `matrix_booking_get_location` - Get location details

#### Pattern 2: New Booking Creation  
1. `matrix_booking_check_availability` - Verify availability
2. Optional: `find_rooms_with_facilities` - Find suitable spaces
3. `matrix_booking_create_booking` - Create reservation

#### Pattern 3: Space Discovery
1. `get_locations` - Explore location hierarchy  
2. `discover_available_facilities` - Understand facility options
3. `find_rooms_with_facilities` - Search with requirements

## API Error Analysis

### Common Issues from Logs

#### 405 Method Not Allowed
- **Observed**: `matrix_booking_check_availability` returning 405
- **Root Cause**: Possible HTTP method mismatch or endpoint configuration
- **Investigation Needed**: Verify POST vs GET for availability endpoint

#### Missing Context Errors
- **Cause**: Tools called without proper user/organization context
- **Solution**: Always call `get_current_user` first for context

## Recommended Improvements

### 1. Tool Description Enhancement

Current descriptions are too generic. Recommended format:

```json
{
  "name": "tool_name",
  "description": "Primary purpose - Brief explanation",
  "useCases": [
    "Specific scenario 1",
    "Specific scenario 2"
  ],
  "notFor": [
    "Common misuse scenario"
  ],
  "relatedTools": [
    "tool_that_should_be_used_instead"
  ]
}
```

### 2. Add Usage Context

Each tool should include:
- Prerequisites (required context)
- Common workflows
- Error handling guidance
- Related tool suggestions

### 3. Implement Missing Tools

Priority order:
1. `get_user_bookings` - Critical for user booking queries
2. `get_tool_guidance` - Help AI assistants choose correct tools
3. `cancel_booking` - Complete booking lifecycle management

## Testing Requirements

### Endpoint Verification
- [ ] Verify all API endpoints and HTTP methods
- [ ] Test error scenarios and response codes
- [ ] Validate parameter passing and response formats

### Tool Workflow Testing
- [ ] Test correct tool selection for common queries
- [ ] Verify cross-tool data flow
- [ ] Test error recovery patterns

### AI Assistant Integration
- [ ] Test with real AI assistant queries
- [ ] Measure tool selection accuracy
- [ ] Monitor error rates and types