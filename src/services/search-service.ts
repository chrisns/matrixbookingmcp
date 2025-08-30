import { 
  ISearchService, 
  ILocationSearchRequest, 
  ILocationSearchResponse, 
  ILocationSearchResult 
} from '../types/search.types.js';
import { ILocation } from '../types/location.types.js';
import { ILocationService } from '../types/location.types.js';
import { IAvailabilityService } from '../types/availability.types.js';
import { FacilityParser } from './facility-parser.js';

/**
 * Service for advanced location search with facility and availability filtering
 */
export class SearchService implements ISearchService {
  private locationService: ILocationService;
  private availabilityService: IAvailabilityService;
  private facilityParser: FacilityParser;
  
  constructor(
    locationService: ILocationService,
    availabilityService: IAvailabilityService
  ) {
    this.locationService = locationService;
    this.availabilityService = availabilityService;
    this.facilityParser = new FacilityParser();
  }
  
  /**
   * Search locations by requirements with intelligent matching
   */
  async searchLocationsByRequirements(request: ILocationSearchRequest): Promise<ILocationSearchResponse> {
    const startTime = Date.now();
    const appliedFilters: string[] = [];
    
    // Extract requirements from natural language query if provided
    let requirements = request.requirements || [];
    let capacity = request.capacity;
    
    if (request.query) {
      const extractedReqs = this.facilityParser.extractRequirements(request.query);
      requirements = [...new Set([...requirements, ...extractedReqs])];
      
      if (!capacity) {
        const extractedCapacity = this.facilityParser.extractCapacity(request.query);
        if (extractedCapacity !== null) {
          capacity = extractedCapacity;
        }
      }
    }
    
    // Build query for location hierarchy
    const queryRequest: Record<string, unknown> = {
      includeFacilities: true,
      includeChildren: true,
      isBookable: true
    };
    
    if (request.parentLocationId) {
      queryRequest['parentId'] = request.parentLocationId;
    }
    
    const hierarchy = await this.locationService.getLocationHierarchy(queryRequest as any);
    
    let locations = hierarchy.locations || [];
    const totalLocations = locations.length;
    
    // Filter by location kind if specified
    if (request.locationKind) {
      locations = locations.filter(loc => loc.kind === request.locationKind);
      appliedFilters.push(`kind:${request.locationKind}`);
    }
    
    // Filter by capacity if specified
    if (capacity && capacity > 0) {
      locations = locations.filter(loc => {
        // For rooms, check explicit capacity
        if (loc.kind === 'ROOM' && loc.capacity) {
          return loc.capacity >= capacity;
        }
        // For desks, assume capacity of 1
        if (loc.kind === 'DESK') {
          return capacity <= 1;
        }
        // For other types, check if capacity is defined
        return !loc.capacity || loc.capacity >= capacity;
      });
      appliedFilters.push(`capacity>=${capacity}`);
    }
    
    // Score and filter by facility requirements
    const scoredLocations: Array<{
      location: ILocation;
      score: number;
      matchDetails: string[];
      matchedFacilities: string[];
    }> = [];
    
    for (const location of locations) {
      let score = 1.0; // Base score
      const matchDetails: string[] = [];
      let matchedFacilities: string[] = [];
      
      // Check facility requirements
      if (requirements.length > 0 && location.facilities) {
        const facilityMatch = this.facilityParser.matchesRequirements(
          location.facilities,
          requirements
        );
        
        // If explicit requirements provided, skip non-matching
        if (request.requirements && request.requirements.length > 0 && !facilityMatch.matches) {
          continue;
        }
        
        score *= facilityMatch.score;
        matchedFacilities = facilityMatch.matchedFacilities;
        
        if (matchedFacilities.length > 0) {
          matchDetails.push(`Facilities: ${matchedFacilities.join(', ')}`);
        }
        
        if (facilityMatch.score < 1) {
          matchDetails.push(`Partial match: ${Math.round(facilityMatch.score * 100)}%`);
        }
      }
      
      // Boost score for exact capacity match
      if (capacity && location.capacity === capacity) {
        score *= 1.2;
        matchDetails.push(`Exact capacity match (${capacity})`);
      } else if (capacity && location.capacity && location.capacity >= capacity) {
        matchDetails.push(`Capacity ${location.capacity} (fits ${capacity})`);
      }
      
      // Add location type to match details
      if (location.kind) {
        matchDetails.push(`Type: ${location.kind}`);
      }
      
      // Add qualified name for context
      if (location.qualifiedName) {
        matchDetails.push(`Location: ${location.qualifiedName}`);
      }
      
      scoredLocations.push({
        location,
        score,
        matchDetails,
        matchedFacilities
      });
    }
    
    // Sort by score (highest first)
    scoredLocations.sort((a, b) => b.score - a.score);
    
    // Apply limit
    const limitedLocations = request.limit 
      ? scoredLocations.slice(0, request.limit)
      : scoredLocations;
    
    // Check availability if dates provided
    const results: ILocationSearchResult[] = [];
    let availabilityChecked = 0;
    
    for (const scoredLoc of limitedLocations) {
      const result: ILocationSearchResult = {
        location: scoredLoc.location,
        score: scoredLoc.score,
        matchDetails: scoredLoc.matchDetails,
        facilityInfo: {
          matchedFacilities: scoredLoc.matchedFacilities,
          allFacilities: scoredLoc.location.facilities?.map(f => 
            f.text || f.name || ''
          ).filter(text => text.length > 0) || []
        }
      };
      
      // Check availability if dates provided
      if (request.dateFrom && request.dateTo) {
        availabilityChecked++;
        try {
          const availability = await this.availabilityService.checkAvailability({
            locationId: scoredLoc.location.id,
            dateFrom: request.dateFrom,
            dateTo: request.dateTo,
            bookingCategory: this.getBookingCategory(scoredLoc.location.kind)
          });
          
          // Check if available is an array with slots
          const isAvailable = Array.isArray(availability.available) && availability.available.length > 0;
          
          result.availability = {
            isAvailable,
            availableSlots: isAvailable && Array.isArray(availability.available) 
              ? availability.available.map((slot: any) => ({
                  from: slot.timeFrom || slot.from || '',
                  to: slot.timeTo || slot.to || ''
                }))
              : []
          };
          
          if (result.availability.isAvailable) {
            result.matchDetails.push('✓ Available at requested time');
          } else {
            result.matchDetails.push('✗ Not available at requested time');
            // Reduce score for unavailable locations
            result.score *= 0.5;
          }
        } catch (error) {
          // If availability check fails, don't include availability info
          result.matchDetails.push('⚠ Could not check availability');
        }
      }
      
      results.push(result);
    }
    
    // Re-sort by score if availability was checked
    if (request.dateFrom && request.dateTo) {
      results.sort((a, b) => b.score - a.score);
    }
    
    return {
      results,
      totalMatches: scoredLocations.length,
      metadata: {
        searchTime: Date.now() - startTime,
        locationsSearched: totalLocations,
        availabilityChecked,
        appliedFilters
      }
    };
  }
  
  /**
   * Search by natural language query
   */
  async searchByQuery(query: string): Promise<ILocationSearchResponse> {
    // Parse the query to extract requirements
    const requirements = this.facilityParser.extractRequirements(query);
    const capacity = this.facilityParser.extractCapacity(query);
    
    // Determine location kind from query
    let locationKind: string | undefined;
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('room')) {
      locationKind = 'ROOM';
    } else if (lowerQuery.includes('desk')) {
      locationKind = 'DESK';
    }
    
    // Extract time from query (basic parsing)
    let dateFrom: string | undefined;
    let dateTo: string | undefined;
    
    // Check for "now" or "today"
    if (lowerQuery.includes('now') || lowerQuery.includes('today')) {
      const now = new Date();
      dateFrom = now.toISOString();
      
      // Check for duration
      const hourMatch = query.match(/(\d+)\s*hour/i);
      if (hourMatch && hourMatch[1]) {
        const hours = parseInt(hourMatch[1], 10);
        const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
        dateTo = endTime.toISOString();
      } else {
        // Default to 1 hour
        const endTime = new Date(now.getTime() + 60 * 60 * 1000);
        dateTo = endTime.toISOString();
      }
    }
    
    // Check for "tomorrow"
    if (lowerQuery.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Default to 9am
      dateFrom = tomorrow.toISOString();
      
      // Check for specific times
      const timeMatch = query.match(/(\d{1,2})\s*(?:am|pm)/gi);
      if (timeMatch && timeMatch.length >= 2) {
        // Parse start and end times
        // This is simplified - real implementation would need better time parsing
        const endTime = new Date(tomorrow);
        endTime.setHours(17, 0, 0, 0); // Default to 5pm
        dateTo = endTime.toISOString();
      } else {
        // Default to 1 hour
        const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000);
        dateTo = endTime.toISOString();
      }
    }
    
    const searchRequest: ILocationSearchRequest = {
      requirements,
      query,
      limit: 10 // Reasonable default limit
    };
    
    if (capacity) searchRequest.capacity = capacity;
    if (locationKind) searchRequest.locationKind = locationKind;
    if (dateFrom) searchRequest.dateFrom = dateFrom;
    if (dateTo) searchRequest.dateTo = dateTo;
    
    return this.searchLocationsByRequirements(searchRequest);
  }
  
  /**
   * Find locations with specific facilities
   */
  async findLocationsWithFacilities(facilities: string[]): Promise<ILocation[]> {
    const response = await this.searchLocationsByRequirements({
      requirements: facilities,
      limit: 20
    });
    
    return response.results.map(r => r.location);
  }
  
  /**
   * Get booking category based on location kind
   */
  private getBookingCategory(kind?: string): number {
    switch (kind) {
      case 'ROOM':
        return 9000002; // Room booking category
      case 'DESK':
      case 'DESK_BANK':
        return 9000001; // Desk booking category
      default:
        return 9000001; // Default to desk
    }
  }
}