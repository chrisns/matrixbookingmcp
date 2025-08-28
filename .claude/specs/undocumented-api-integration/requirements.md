# Undocumented Matrix Booking API Integration

## Overview
This specification defines the integration requirements for undocumented Matrix Booking API endpoints discovered through analysis of example API calls. These endpoints provide enhanced functionality for user management, booking queries, availability checking, and location discovery.

## Discovered API Endpoints

### 1. Current User Information
**Endpoint**: `GET /api/v1/user/current`
- **Purpose**: Retrieve current authenticated user details
- **Query Parameters**:
  - `include=defaults` - Include user default preferences
  - `include=conferenceProviders` - Include conference provider integrations
- **Response Data**:
  - User profile (id, name, email, organisation)
  - Authentication methods and domains
  - Default view preferences and categories
  - User roles and permissions
  - Conference provider configurations

### 2. Current User's Bookings
**Endpoint**: `GET /api/v1/user/current/bookings`
- **Purpose**: Retrieve all bookings for the current authenticated user
- **Query Parameters**:
  - `include=locations` - Include location details
  - `include=visit` - Include visit information
  - `include=facilities` - Include facility details
  - `include=extras` - Include extra services
  - `include=bookingSettings` - Include booking configuration
  - `include=layouts` - Include layout information
  - `include=ancestors` - Include location hierarchy
- **Response Data**:
  - Complete booking details with status and timing
  - Booking group information for recurring bookings
  - Location hierarchy and facility information
  - Attendee information and permissions

### 3. All Bookings Query
**Endpoint**: `GET /api/v1/booking`
- **Purpose**: Search and retrieve bookings from all users (admin/shared view)
- **Query Parameters**:
  - `bc` - Booking category ID filter
  - `f` - From datetime (ISO format)
  - `t` - To datetime (ISO format)
  - `include=ancestors` - Location hierarchy
  - `include=locations` - Location details
  - `include=facilities` - Facility information
  - `include=layouts` - Layout details
  - `include=bookingSettings` - Booking configuration
  - `include=groups` - Booking group information
- **Response Data**:
  - Multi-user booking data
  - Location and facility details
  - Booking group relationships

### 4. Availability Search
**Endpoint**: `GET /api/v1/availability`
- **Purpose**: Check resource availability for specific time periods
- **Query Parameters**:
  - `bc` - Booking category ID
  - `f` - From datetime
  - `t` - To datetime
  - `l` - Location ID filter
  - `status` - Status filters (available, unavailable, booked)
  - `include` parameters for detailed data
- **Response Data**:
  - Time-slot availability status
  - Location-specific availability windows
  - Resource occupancy information

### 5. Location Discovery
**Endpoint**: `GET /api/v1/location`
- **Purpose**: Retrieve hierarchical location structure and bookable resources
- **Query Parameters**:
  - `select=higher` - Select higher-level locations
  - `include=locations` - Include sub-locations
  - `include=nested` - Include nested location structure
- **Response Data**:
  - Complete location hierarchy
  - Building, floor, zone, and desk structure
  - Geographic coordinates and addresses
  - Booking categories and settings

### 6. Booking Creation
**Endpoint**: `POST /api/v1/booking`
- **Purpose**: Create new bookings
- **Query Parameters**:
  - `notifyScope=ALL_ATTENDEES` - Notification scope
- **Request Body**:
  - Time range (timeFrom, timeTo)
  - Location ID
  - Owner and attendee information
  - Booking group settings for recurring bookings
  - Extra requests and requirements

### 7. Organization Structure
**Endpoint**: `GET /api/v1/org/{organizationId}`
- **Purpose**: Get organization categories and location types for filtering
- **Discovery Method**: Extract `organizationId` from current user profile
- **Query Parameters**:
  - `include=categories` - Include booking categories (Meeting Rooms, Desks, Access Passes)
  - `include=locationKinds` - Include location hierarchy types
  - `include=conferenceProviders` - Include conference integrations
  - `include=rootLocation` - Include organization root location
  - `scope=SHARED` - Shared resource access scope
- **Response Data**:
  - Booking categories with location types and timing rules
  - Location kind definitions (Building, Floor, Zone, Room, Desk, etc.)
  - Organization settings and available features

## Filtering Requirements

### Facility-Based Filtering
Enable users to search for rooms with specific facilities:
- **Conference Phone** - Rooms equipped with conference calling
- **Screen Sizes** - Various display sizes (27", 34", etc.)
- **Adjustable Desks** - Height-adjustable workstations
- **Audio/Video Equipment** - Cameras, speakers, projectors

### Booking Type Filtering  
Filter by organizational booking categories:
- **Meeting Rooms** - Hourly conference spaces
- **Desks** - Half-day individual workstations
- **Access Passes** - Whole-day building access
- **Privacy Pods** - Hourly focused work spaces
- **Collaboration Settings** - Half-day team spaces

### Capacity Requirements
Filter locations by attendee capacity needs:
- Minimum capacity requirements
- Optimal capacity matching
- Room size appropriateness

## Essential MCP Tools for Filtering

### Smart Room Search
**Tool**: `find_rooms_with_facilities`
- **Input**: Natural language query ("room with conference phone for 6 people")
- **Processing**: Parse requirements → query organization categories → filter by facilities and capacity → check availability
- **Output**: Ranked list of suitable rooms with facility details

### Organization Discovery  
**Tool**: `get_booking_categories`
- **Purpose**: Discover available booking types in organization
- **Output**: List of categories (Meeting Rooms, Desks, etc.) with timing and location rules

### Facility Discovery
**Tool**: `discover_available_facilities` 
- **Purpose**: List all facility types available for filtering
- **Output**: Categorized facilities (Audio, Video, Furniture, Technology)

## Implementation Requirements

### Authentication & Headers
All endpoints require:
- **Authentication**: Cookie-based session (MatrixAuthToken)
- **Headers**:
  - `x-matrix-source: WEB` - Source identification
  - `x-time-zone: Europe/London` - Timezone specification
  - Standard browser headers for CORS compliance

### Data Models

#### User Profile
```typescript
interface UserProfile {
  id: number;
  organisationId: number;
  personId: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  defaults: UserDefaults;
  roles: string[];
  locationRoles: any[];
  auths: AuthMethod[];
  conferenceProviders: ConferenceProvider[];
}
```

#### Booking Details
```typescript
interface BookingDetails {
  id: number;
  owner: UserReference;
  bookedBy: UserReference;
  timeFrom: string; // ISO datetime
  timeTo: string; // ISO datetime
  organisation: Organisation;
  locationId: number;
  locationKind: string;
  status: BookingStatus;
  duration: { millis: number };
  possibleActions: BookingActions;
  checkInStatus: string;
  attendeeCount: number;
  ownerIsAttendee: boolean;
  source: string;
  version: number;
  bookingGroup?: BookingGroup;
}
```

#### Location Structure
```typescript
interface Location {
  id: number;
  organisationId: number;
  organisation?: Organisation;
  parentId?: number;
  kind: LocationKind;
  name: string;
  qualifiedName: string;
  address?: string;
  geoCoordinates?: GeoCoordinates;
  left: number;
  right: number;
  isFlex: boolean;
  settings: LocationSettings;
  locations?: Location[];
  bookingSettings?: BookingSettings;
  facilities?: Facility[];
  ancestors?: Location[];
}
```

### Security Considerations
- Implement proper session management
- Validate all input parameters
- Sanitize location and user data
- Respect user permissions and organisation boundaries
- Handle authentication token expiration gracefully

### Performance Requirements
- Cache location hierarchy data (updates infrequently)
- Implement pagination for large booking result sets
- Use appropriate timeout settings for API calls
- Handle rate limiting if implemented by Matrix Booking

### Error Handling
- Implement comprehensive error handling for all endpoints
- Provide meaningful error messages for different failure scenarios
- Handle network timeouts and connectivity issues
- Implement retry logic for transient failures

## Integration Approach

### Phase 1: Core User & Booking Operations
1. Implement current user information retrieval
2. Add current user bookings functionality
3. Create booking creation capabilities
4. Implement basic error handling and authentication

### Phase 2: Advanced Search & Discovery
1. Add all bookings search functionality
2. Implement availability checking
3. Add location discovery and hierarchy navigation
4. Implement comprehensive data caching

### Phase 3: Enhancement & Optimization
1. Add advanced filtering and search capabilities
2. Implement real-time updates where possible
3. Add comprehensive logging and monitoring
4. Optimize performance and add sophisticated caching strategies

## Testing Strategy
- Unit tests for all API integration functions
- Integration tests with Matrix Booking sandbox/test environment
- Mock implementations for development and testing
- Error scenario testing (network failures, authentication issues)
- Performance testing with realistic data loads

## Dependencies
- HTTP client library with cookie support
- TypeScript type definitions
- Date/time manipulation library
- Authentication token management
- Configuration management for API endpoints

## Success Criteria
- Successfully retrieve current user information
- Query and display user's bookings with full details
- Search for other users' bookings with appropriate permissions
- Check availability for specific locations and time ranges
- Navigate location hierarchy and discover bookable resources
- Create new bookings programmatically
- Handle all error conditions gracefully
- Maintain acceptable performance under typical usage loads