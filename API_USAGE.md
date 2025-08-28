# Matrix Booking MCP Server - API Usage Guide

## Overview

The Matrix Booking MCP Server provides intelligent room booking and search capabilities through Model Context Protocol (MCP) tools. It integrates with undocumented Matrix Booking API endpoints to offer advanced filtering, natural language search, and comprehensive facility discovery.

## Available MCP Tools

### Core Tools

#### `get_current_user`
Get information about the authenticated user.

```typescript
// No parameters required
{
  "id": 12345,
  "personId": 67890,
  "organisationId": 789,
  "firstName": "John",
  "lastName": "Doe", 
  "name": "John Doe",
  "email": "john.doe@company.com",
  "roles": ["USER"]
}
```

#### `get_booking_categories`
Discover available booking categories (room types) in the organization.

```typescript
// No parameters required
[
  {
    "id": 1,
    "name": "Meeting Rooms",
    "description": "Standard meeting rooms",
    "color": "#3498db",
    "isActive": true
  },
  {
    "id": 2, 
    "name": "Hot Desks",
    "description": "Flexible workspace desks",
    "color": "#2ecc71",
    "isActive": true
  }
]
```

#### `get_locations`
Get location hierarchy and discover available rooms/spaces.

```typescript
// Parameters (all optional)
{
  "parentId": 100,        // Filter by parent location
  "kind": "ROOM",         // Filter by location type
  "includeAncestors": true,
  "includeFacilities": true,
  "includeChildren": true,
  "isBookable": true      // Only bookable locations
}

// Response
{
  "locations": [
    {
      "id": 100001,
      "name": "Conference Room A", 
      "kind": "ROOM",
      "capacity": 12,
      "facilities": [
        {
          "id": "screen",
          "name": "65\" Screen", 
          "category": "audio_visual"
        }
      ],
      "ancestors": [
        {"id": 100, "name": "Building 1", "kind": "BUILDING"}
      ]
    }
  ],
  "total": 50
}
```

#### `get_user_bookings`
⭐ **Primary user booking tool** - Retrieve current user's existing room and desk bookings with comprehensive filtering options.

```typescript
// Parameters (all optional)
{
  "dateFrom": "2025-02-01T00:00:00.000Z",    // Start date filter
  "dateTo": "2025-02-28T23:59:59.999Z",      // End date filter  
  "status": "ACTIVE",                         // ACTIVE | CANCELLED | COMPLETED
  "page": 1,                                  // Page number (starts from 1)
  "pageSize": 20                             // Results per page (1-100)
}

// Response
{
  "summary": {
    "totalBookings": 15,
    "page": 1,
    "pageSize": 20,
    "hasNext": false
  },
  "bookings": [
    {
      "id": 123456,
      "location": "Conference Room A",
      "timeSlot": "2025-02-03T14:00:00.000Z to 2025-02-03T15:30:00.000Z",
      "status": "ACTIVE",
      "duration": "1 hour 30 minutes",
      "attendeeCount": 6,
      "owner": "John Doe",
      "title": "Team Sprint Planning",
      "description": "Weekly sprint planning meeting"
    },
    {
      "id": 123457,
      "location": "Hot Desk 42",
      "timeSlot": "2025-02-04T09:00:00.000Z to 2025-02-04T17:00:00.000Z", 
      "status": "ACTIVE",
      "duration": "8 hours",
      "attendeeCount": 1,
      "owner": "John Doe"
    }
  ]
}
```

### Advanced Search Tools

#### `find_rooms_with_facilities`
⭐ **Primary search tool** - Natural language room search with intelligent facility matching.

```typescript
// Parameters
{
  "query": "conference room with screen for 8 people",  // Required
  "dateFrom": "2025-02-01T09:00:00.000Z",              // Optional
  "dateTo": "2025-02-01T17:00:00.000Z",                // Optional  
  "duration": 120,                                      // Minutes, optional
  "buildingId": 100,                                    // Optional
  "category": "Meeting Rooms",                          // Optional
  "maxResults": 10                                      // Default: 10
}

// Response
{
  "query": "conference room with screen for 8 people",
  "parsedRequirements": {
    "facilities": ["screen", "conference"],
    "capacity": 8,
    "locationHints": [],
    "category": "Meeting Rooms"
  },
  "totalResults": 3,
  "results": [
    {
      "location": {
        "id": 100001,
        "name": "Conference Room A",
        "description": "Large conference room",
        "kind": "ROOM", 
        "building": "Building 1",
        "floor": "Floor 2"
      },
      "relevanceScore": 95,
      "facilityMatches": [
        {
          "facility": {"name": "65\" Screen", "category": "audio_visual"},
          "matchType": "exact",
          "score": 100,
          "searchTerm": "screen"
        }
      ],
      "capacity": {
        "requested": 8,
        "actual": 12,
        "isMatch": true
      },
      "availability": {
        "isAvailable": true,
        "availableSlots": [
          {"from": "2025-02-01T09:00:00", "to": "2025-02-01T17:00:00"}
        ]
      },
      "matchReason": "Has 65\" Screen, Capacity for 12 people"
    }
  ]
}
```

#### `discover_available_facilities`
Comprehensive facility discovery and categorization across the organization.

```typescript
// Parameters (all optional)
{
  "category": "audio_visual",     // Filter by facility category
  "location_type": "ROOM",        // Filter by location type
  "building_id": 100             // Filter by building
}

// Response  
{
  "totalFacilities": 150,
  "totalLocations": 50,
  "facilitiesByCategory": {
    "audio_visual": [
      {
        "name": "65\" Screen",
        "id": "screen_65",
        "category": "audio_visual", 
        "availableIn": ["Conference Room A", "Meeting Room B"],
        "locationCount": 2
      }
    ],
    "technology": [
      {
        "name": "Video Conference System",
        "id": "video_conf",
        "category": "technology",
        "availableIn": ["Conference Room A"], 
        "locationCount": 1
      }
    ]
  },
  "categories": ["audio_visual", "technology", "furniture"],
  "filters": {
    "category": "audio_visual",
    "location_type": null,
    "building_id": null
  }
}
```

### Legacy Booking Tools

#### `matrix_booking_check_availability`
Check availability for specific dates and locations.

```typescript
// Parameters
{
  "dateFrom": "2025-01-15T09:00:00.000Z",  // Optional, defaults to now
  "dateTo": "2025-01-15T17:00:00.000Z",    // Optional, defaults to end of day
  "locationId": 100001,                     // Optional, defaults to preferred
  "duration": 60                            // Optional minimum duration
}
```

#### `matrix_booking_create_booking`
Create new room bookings.

```typescript
// Parameters
{
  "timeFrom": "2025-01-15T09:00:00.000",   // Required
  "timeTo": "2025-01-15T10:00:00.000",     // Required
  "locationId": 100001,                     // Optional (or use locationName)
  "locationName": "Conference Room A",      // Optional (alternative to locationId)
  "attendees": ["john@company.com"],        // Optional
  "title": "Team Meeting",                  // Optional
  "description": "Weekly sync meeting"      // Optional
}
```

#### `health_check`
Monitor service health and connectivity.

```typescript
// Parameters
{
  "verbose": true  // Optional, shows detailed error information
}

// Response
{
  "status": "healthy",  // healthy | degraded
  "timestamp": "2025-02-01T10:30:00.000Z",
  "services": {
    "userService": {"status": "healthy"},
    "organizationService": {"status": "healthy"}, 
    "locationService": {"status": "healthy"},
    "availabilityService": {"status": "healthy"},
    "searchService": {"status": "healthy"}
  }
}
```

## Natural Language Processing

The `find_rooms_with_facilities` tool includes intelligent query parsing:

### Capacity Extraction
- "room for 6 people" → capacity: 6
- "meeting space for 10" → capacity: 10  
- "conference room for 15 attendees" → capacity: 15

### Facility Recognition  
- "room with projector" → facilities: ["projector"]
- "conference phone and whiteboard" → facilities: ["phone", "whiteboard"] 
- "large screen TV" → facilities: ["screen", "tv"]

### Location Hints
- "room on floor 2" → locationHints: ["floor 2"]
- "building 1 conference room" → locationHints: ["building 1"]
- "ground floor meeting space" → locationHints: ["ground floor"]

### Category Inference
- "meeting room" → category: "Meeting Rooms"
- "hot desk" → category: "Desks" 
- "training room" → category: "Training Rooms"

## Error Handling

All tools return consistent error responses:

```typescript
{
  "content": [
    {
      "type": "text",
      "text": "Error message describing what went wrong"
    }
  ],
  "isError": true
}
```

Common error scenarios:
- **Authentication failures**: Invalid credentials or expired sessions
- **Permission denied**: User lacks access to requested resources  
- **Invalid parameters**: Missing required fields or invalid values
- **API timeouts**: Network connectivity or server performance issues
- **Resource not found**: Requested locations or bookings don't exist

## Performance Considerations

### Caching Strategy
- **Organization data**: 24 hours (categories, location kinds)
- **Location hierarchy**: 4 hours (building/room structure)  
- **Facility data**: 1 hour (equipment and amenities)

### Rate Limiting
- Maximum 100 requests per minute per user
- Bulk operations automatically batched
- Concurrent request limit: 5 per user

### Query Optimization
- Use `building_id` filters to reduce search scope
- Specify `maxResults` to limit response size  
- Include time constraints for availability checking
- Cache frequently accessed location IDs

## Integration Examples

### User Booking Management
```javascript
// Get all current user's bookings
const bookings = await mcpClient.callTool("get_user_bookings", {});

// Get bookings for specific date range
const weeklyBookings = await mcpClient.callTool("get_user_bookings", {
  dateFrom: "2025-02-01T00:00:00.000Z",
  dateTo: "2025-02-07T23:59:59.999Z",
  status: "ACTIVE",
  pageSize: 10
});
```

### Basic Room Search
```javascript
// Find any available meeting room
const result = await mcpClient.callTool("find_rooms_with_facilities", {
  query: "meeting room",
  dateFrom: "2025-02-01T09:00:00.000Z",
  dateTo: "2025-02-01T11:00:00.000Z"
});
```

### Advanced Facility Search  
```javascript
// Find rooms with specific equipment
const result = await mcpClient.callTool("find_rooms_with_facilities", {
  query: "conference room with large screen and phone for 10 people",
  buildingId: 100,
  maxResults: 5
});
```

### Facility Discovery
```javascript  
// Explore available audio/visual equipment
const facilities = await mcpClient.callTool("discover_available_facilities", {
  category: "audio_visual"
});
```

### Health Monitoring
```javascript
// Check service health
const health = await mcpClient.callTool("health_check", {
  verbose: true
});
```