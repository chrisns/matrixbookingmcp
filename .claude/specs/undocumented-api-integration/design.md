# Technical Design: Matrix Booking API Integration with Filtering

## Architecture Overview

### Service Layer Design
```
src/services/
├── matrix-api-client.ts          # Core HTTP client with authentication
├── user-service.ts               # Current user operations  
├── organization-service.ts       # Organization structure & categories
├── location-service.ts           # Location hierarchy & discovery
├── availability-service.ts       # Resource availability checking
├── facility-service.ts           # Facility parsing & matching
├── search-service.ts             # Smart search with filtering
└── booking-service.ts            # Booking operations
```

### Data Flow Architecture
```
User Query → Search Service → Organization Service (categories)
                           → Location Service (hierarchy) 
                           → Availability Service (time slots)
                           → Facility Service (equipment match)
                           → Ranked Results
```

## Core Data Models

### Organization Structure
```typescript
interface Organization {
  id: number;
  name: string;
  categories: BookingCategory[];
  locationKinds: LocationKind[];
  rootLocation: Location;
}

interface BookingCategory {
  id: number;
  kind: 'LOCATION';
  locationKind: 'ROOM' | 'DESK' | 'PASS' | 'OFFICE' | 'PERSON' | 'EQUIPMENT' | 'APARTMENT';
  nameSingle: string;        // "Meeting Room"
  namePlural: string;        // "Meeting Rooms" 
  timeslotKind: 'HOURLY' | 'HALF_DAY' | 'WHOLE_DAY';
}

interface LocationKind {
  kind: string;              // "ROOM", "DESK", "BUILDING", etc.
  label: string;             // Human-readable label
  isBookable: boolean;       // Can this type be booked
  defaultSubKind?: string;   // Default child type
}
```

### Enhanced Location Data
```typescript
interface Location {
  id: number;
  organisationId: number;
  kind: string;
  name: string;
  qualifiedName: string;
  isBookable?: boolean;
  bookingCategoryId?: number;
  facilities?: Facility[];
  capacity?: number;
  ancestors?: Location[];
  address?: string;
  geoCoordinates?: { latitude: number; longitude: number };
}

interface Facility {
  id: number;
  kind: 'AUDIO' | 'VIDEO' | 'FURNITURE' | 'TECH' | 'OTHER';
  text: string;              // Raw description from API
  parsed?: {                 // Extracted information
    type: string;            // "Conference Phone", "Screen", etc.
    size?: string;           // "27\"", "34\"", etc.
    features?: string[];     // ["Adjustable", "Mechanical", etc.]
  };
}
```

### Search Interfaces
```typescript
interface SearchQuery {
  // Natural language or structured search
  query?: string;            // "room with conference phone for 6 people"
  
  // Structured filters
  facilities?: string[];     // ["Conference Phone", "34\" Screen"]
  capacity?: number;         // Minimum capacity
  categoryId?: number;       // Booking category filter
  locationKind?: string;     // "ROOM", "DESK", etc.
  buildingId?: number;       // Specific building
  
  // Time constraints
  date: string;              // Required: YYYY-MM-DD
  duration?: number;         // Minutes
  startTime?: string;        // HH:MM
}

interface SearchResult {
  location: Location;
  relevanceScore: number;    // 0-100 match quality
  availabilityInfo: {
    isAvailable: boolean;
    availableSlots: TimeSlot[];
    conflictingBookings?: BookingDetails[];
  };
  facilityMatches: {
    facility: Facility;
    matchType: 'exact' | 'partial' | 'related';
  }[];
}
```

## Service Implementations

### Organization Service Design
```typescript
class OrganizationService {
  private cache = new Map<number, { data: Organization; expires: number }>();
  
  constructor(private apiClient: MatrixApiClient) {}

  async getOrganizationForCurrentUser(): Promise<Organization> {
    // Get current user → extract org ID → fetch with caching
    const user = await this.userService.getCurrentUser();
    return this.getOrganization(user.organisationId);
  }

  async getBookingCategories(): Promise<BookingCategory[]> {
    const org = await this.getOrganizationForCurrentUser();
    return org.categories;
  }

  async getCategoryByLocationKind(locationKind: string): Promise<BookingCategory | null> {
    const categories = await this.getBookingCategories();
    return categories.find(cat => cat.locationKind === locationKind) || null;
  }

  private async getOrganization(orgId: number): Promise<Organization> {
    // Check cache first, then fetch from API
  }
}
```

### Facility Service Design
```typescript
class FacilityService {
  private facilityPatterns = new Map([
    ['Conference Phone', /conference.*phone|phone.*conference|conference.*call/i],
    ['Screen', /(\d+)[""]?\s*screen|(\d+)[""]?\s*monitor|(\d+)[""]?\s*display/i],
    ['Adjustable Desk', /adjustable.*desk|height.*adjustable|standing.*desk/i],
    // ... more patterns
  ]);

  parseFacility(facility: Facility): Facility {
    const parsed = { type: 'Unknown', features: [] };
    
    for (const [type, pattern] of this.facilityPatterns) {
      if (pattern.test(facility.text)) {
        parsed.type = type;
        
        // Extract specific features (size, model, etc.)
        const sizeMatch = facility.text.match(/(\d+)[""]?/);
        if (sizeMatch && type.includes('Screen')) {
          parsed.size = `${sizeMatch[1]}"`;
        }
        
        break;
      }
    }
    
    return { ...facility, parsed };
  }

  matchesFacilityRequirement(facility: Facility, requirement: string): boolean {
    if (!facility.parsed) {
      facility = this.parseFacility(facility);
    }
    
    // Exact type match
    if (facility.parsed?.type === requirement) return true;
    
    // Keyword matching
    const reqLower = requirement.toLowerCase();
    return facility.text.toLowerCase().includes(reqLower);
  }

  filterLocationsByFacilities(
    locations: Location[], 
    requiredFacilities: string[]
  ): Location[] {
    return locations.filter(location => {
      if (!location.facilities) return false;
      
      return requiredFacilities.every(required =>
        location.facilities!.some(facility =>
          this.matchesFacilityRequirement(facility, required)
        )
      );
    });
  }
}
```

### Search Service Design
```typescript
class SearchService {
  constructor(
    private organizationService: OrganizationService,
    private locationService: LocationService,
    private availabilityService: AvailabilityService,
    private facilityService: FacilityService
  ) {}

  async searchRooms(query: SearchQuery): Promise<SearchResult[]> {
    // 1. Parse natural language if provided
    const parsedQuery = await this.parseQuery(query);
    
    // 2. Get organization context for filtering
    const categories = await this.organizationService.getBookingCategories();
    
    // 3. Filter by booking category if specified
    let targetCategoryId = parsedQuery.categoryId;
    if (!targetCategoryId && parsedQuery.locationKind) {
      const category = categories.find(cat => cat.locationKind === parsedQuery.locationKind);
      targetCategoryId = category?.id;
    }
    
    // 4. Get available locations for the time period
    const availabilityQuery = {
      bc: targetCategoryId,
      f: `${parsedQuery.date}T00:00:00`,
      t: `${parsedQuery.date}T23:59:59`,
      include: ['locations', 'facilities', 'bookingSettings'],
      ...(parsedQuery.buildingId && { l: parsedQuery.buildingId })
    };
    
    const availability = await this.availabilityService.checkAvailability(availabilityQuery);
    
    // 5. Filter by facilities if specified
    let filteredLocations = availability.locations || [];
    if (parsedQuery.facilities?.length) {
      filteredLocations = this.facilityService.filterLocationsByFacilities(
        filteredLocations,
        parsedQuery.facilities
      );
    }
    
    // 6. Filter by capacity if specified
    if (parsedQuery.capacity) {
      filteredLocations = this.filterByCapacity(filteredLocations, parsedQuery.capacity);
    }
    
    // 7. Create search results with scoring
    return this.createSearchResults(filteredLocations, parsedQuery, availability);
  }

  private async parseQuery(query: SearchQuery): Promise<ParsedQuery> {
    const parsed = { ...query };
    
    if (query.query) {
      // Extract facilities from natural language
      parsed.facilities = this.extractFacilities(query.query);
      
      // Extract capacity
      const capacityMatch = query.query.match(/for\s*(\d+)|(\d+)\s*people/i);
      if (capacityMatch) {
        parsed.capacity = parseInt(capacityMatch[1] || capacityMatch[2]);
      }
      
      // Extract location type hints
      if (query.query.toLowerCase().includes('meeting room')) {
        parsed.locationKind = 'ROOM';
      } else if (query.query.toLowerCase().includes('desk')) {
        parsed.locationKind = 'DESK';
      }
    }
    
    return parsed;
  }

  private extractFacilities(queryText: string): string[] {
    const facilities = [];
    const lower = queryText.toLowerCase();
    
    if (lower.includes('conference phone') || lower.includes('phone')) {
      facilities.push('Conference Phone');
    }
    if (lower.includes('screen') || lower.includes('monitor') || lower.includes('display')) {
      facilities.push('Screen');
    }
    if (lower.includes('adjustable desk')) {
      facilities.push('Adjustable Desk');
    }
    
    return facilities;
  }

  private filterByCapacity(locations: Location[], minCapacity: number): Location[] {
    // This would need capacity data from the API or derived from room names/types
    // For now, implement basic filtering logic
    return locations; // TODO: Implement when capacity data available
  }

  private createSearchResults(
    locations: Location[],
    query: ParsedQuery,
    availabilityData: any
  ): SearchResult[] {
    return locations.map(location => ({
      location,
      relevanceScore: this.calculateRelevanceScore(location, query),
      availabilityInfo: this.extractAvailabilityInfo(location, availabilityData),
      facilityMatches: this.identifyFacilityMatches(location, query.facilities || [])
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateRelevanceScore(location: Location, query: ParsedQuery): number {
    let score = 50; // Base score
    
    // Boost for facility matches
    if (query.facilities?.length && location.facilities) {
      const matchCount = query.facilities.filter(required =>
        location.facilities!.some(facility =>
          this.facilityService.matchesFacilityRequirement(facility, required)
        )
      ).length;
      
      score += (matchCount / query.facilities.length) * 30;
    }
    
    // Boost for bookable locations
    if (location.isBookable) score += 10;
    
    return Math.min(score, 100);
  }
}
```

## MCP Tool Implementations

### Smart Room Search Tool
```typescript
export const findRoomsWithFacilitiesTool: Tool = {
  name: 'find_rooms_with_facilities',
  description: 'Find rooms with specific facilities and capacity requirements',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query (e.g., "room with conference phone for 6 people")'
      },
      date: {
        type: 'string',
        description: 'Date for booking (YYYY-MM-DD format)',
        pattern: '\\d{4}-\\d{2}-\\d{2}'
      },
      facilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific facilities required (e.g., ["Conference Phone", "34\\" Screen"])'
      },
      capacity: {
        type: 'number',
        description: 'Minimum number of people the room should accommodate'
      },
      building: {
        type: 'string',
        description: 'Building name or ID to search within'
      },
      duration: {
        type: 'number',
        description: 'Duration needed in minutes (optional)'
      }
    },
    required: ['date'],
    additionalProperties: false
  }
};

export async function handleFindRoomsWithFacilities(args: any): Promise<ToolResult> {
  try {
    const searchService = container.get<SearchService>('SearchService');
    
    const results = await searchService.searchRooms({
      query: args.query,
      date: args.date,
      facilities: args.facilities,
      capacity: args.capacity,
      duration: args.duration
    });

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No rooms found matching your criteria. Try adjusting your requirements or date.'
        }]
      };
    }

    const response = `Found ${results.length} suitable room${results.length > 1 ? 's' : ''}:\n\n` +
      results.slice(0, 5).map((result, index) => {
        const facilityList = result.location.facilities
          ?.map(f => f.text)
          .join(', ') || 'No facilities listed';
          
        return `${index + 1}. **${result.location.name}**\n` +
               `   Location: ${result.location.qualifiedName}\n` +
               `   Facilities: ${facilityList}\n` +
               `   Match Score: ${Math.round(result.relevanceScore)}%\n` +
               `   Available: ${result.availabilityInfo.isAvailable ? 'Yes' : 'Limited'}\n`;
      }).join('\n');

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error searching for rooms: ${error.message}`
      }],
      isError: true
    };
  }
}
```

### Organization Categories Tool
```typescript
export const getBookingCategoriesTool: Tool = {
  name: 'get_booking_categories',
  description: 'Get available booking categories and room types in the organization',
  inputSchema: {
    type: 'object',
    properties: {
      detailed: {
        type: 'boolean',
        description: 'Include detailed information about each category (default: false)'
      }
    },
    additionalProperties: false
  }
};

export async function handleGetBookingCategories(args: any): Promise<ToolResult> {
  try {
    const orgService = container.get<OrganizationService>('OrganizationService');
    const categories = await orgService.getBookingCategories();

    let response = '**Available Booking Categories:**\n\n';
    
    categories.forEach(category => {
      response += `• **${category.namePlural}** (${category.locationKind})\n`;
      
      if (args.detailed) {
        response += `  - Booking Type: ${category.timeslotKind}\n`;
        response += `  - Category ID: ${category.id}\n`;
      }
      
      response += '\n';
    });

    return {
      content: [{ type: 'text', text: response.trim() }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error getting booking categories: ${error.message}`
      }],
      isError: true
    };
  }
}
```

### Facility Discovery Tool
```typescript
export const discoverAvailableFacilitiesTool: Tool = {
  name: 'discover_available_facilities',
  description: 'Discover all facilities and equipment available for booking',
  inputSchema: {
    type: 'object',
    properties: {
      location_type: {
        type: 'string',
        description: 'Filter by location type (ROOM, DESK, etc.)'
      },
      building_id: {
        type: 'number', 
        description: 'Filter facilities in a specific building'
      }
    },
    additionalProperties: false
  }
};

export async function handleDiscoverAvailableFacilities(args: any): Promise<ToolResult> {
  try {
    const facilityService = container.get<FacilityService>('FacilityService');
    const availabilityService = container.get<AvailabilityService>('AvailabilityService');

    // Get sample of locations with facilities to discover what's available
    const today = new Date().toISOString().split('T')[0];
    const availability = await availabilityService.checkAvailability({
      f: `${today}T00:00:00`,
      t: `${today}T23:59:59`,
      include: ['locations', 'facilities'],
      ...(args.building_id && { l: args.building_id })
    });

    const allFacilities = new Map<string, number>();
    
    availability.locations?.forEach(location => {
      if (args.location_type && location.kind !== args.location_type) return;
      
      location.facilities?.forEach(facility => {
        const parsed = facilityService.parseFacility(facility);
        const facilityType = parsed.parsed?.type || facility.text;
        allFacilities.set(facilityType, (allFacilities.get(facilityType) || 0) + 1);
      });
    });

    let response = '**Available Facilities:**\n\n';
    
    Array.from(allFacilities.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([facility, count]) => {
        response += `• ${facility} (found in ${count} location${count > 1 ? 's' : ''})\n`;
      });

    return {
      content: [{ type: 'text', text: response }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error discovering facilities: ${error.message}`
      }],
      isError: true
    };
  }
}
```

## API Integration Strategy

### Request Flow Design
1. **Authentication**: Use existing cookie-based auth from MatrixApiClient
2. **Organization Discovery**: Cache org structure for 24 hours
3. **Category Filtering**: Apply booking category filters early for performance
4. **Availability Query**: Use filtered parameters to reduce data transfer
5. **Facility Matching**: Parse and match facilities from availability results
6. **Result Ranking**: Score results by relevance and availability

### Error Handling Strategy
```typescript
class MatrixApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'MatrixApiError';
  }
}

// Graceful degradation for missing data
function safeGetFacilities(location: any): Facility[] {
  return location.facilities || [];
}

function safeGetCapacity(location: any): number | undefined {
  // Try to extract from various possible fields
  return location.capacity || location.maxOccupancy || undefined;
}
```

### Caching Strategy
- **Organization Data**: 24-hour cache (rarely changes)
- **Location Hierarchy**: 4-hour cache (occasionally updated)
- **Facility Lists**: 1-hour cache (may be updated)
- **Availability**: No cache (real-time data)

## Testing Strategy

### Unit Testing Focus
- Facility parsing logic with various text formats
- Natural language query parsing accuracy
- Search result scoring algorithms
- Category and filter matching logic

### Integration Testing
- End-to-end search flow from query to results
- Organization data retrieval and caching
- API authentication and session management
- Error handling for various failure scenarios

This design provides a solid foundation for implementing the filtering and search capabilities while maintaining clean architecture and testability.