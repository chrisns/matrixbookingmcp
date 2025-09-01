import { 
  ISearchService, 
  ILocationSearchRequest, 
  ILocationSearchResponse, 
  ILocationSearchResult 
} from '../types/search.types.js';
import { ILocation, ILocationQueryRequest } from '../types/location.types.js';
import { ILocationService } from '../types/location.types.js';
import { IAvailabilityService } from '../types/availability.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { FacilityParser } from './facility-parser.js';

/**
 * Service for advanced location search with facility and availability filtering
 */
export class SearchService implements ISearchService {
  private locationService: ILocationService;
  private availabilityService: IAvailabilityService;
  private facilityParser: FacilityParser;
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private configManager: IConfigurationManager;
  
  constructor(
    locationService: ILocationService,
    availabilityService: IAvailabilityService,
    apiClient: IMatrixAPIClient,
    authManager: IAuthenticationManager,
    configManager: IConfigurationManager
  ) {
    this.locationService = locationService;
    this.availabilityService = availabilityService;
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.configManager = configManager;
    this.facilityParser = new FacilityParser();
  }

  /**
   * Flatten location hierarchy to get all locations at all levels
   */
  private flattenLocationHierarchy(locations: ILocation[]): ILocation[] {
    const flattened: ILocation[] = [];
    
    const processLocation = (location: ILocation): void => {
      flattened.push(location);
      if (location.locations && Array.isArray(location.locations)) {
        location.locations.forEach(processLocation);
      }
    };
    
    locations.forEach(processLocation);
    return flattened;
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
    
    // Build query - use booking API for date-specific searches
    let locations: ILocation[] = [];
    
    if (request.dateFrom && request.dateTo) {
      // Use booking API to get actual bookable rooms with availability
      const credentials = await this.authManager.getCredentials();
      // Get booking category from config
      const config = this.configManager.getConfig();
      const bookingResponse = await this.apiClient.getAllBookings(
        credentials,
        config.defaultBookingCategory,
        request.dateFrom,
        request.dateTo,
        request.parentLocationId
      );
      
      locations = bookingResponse.locations || [];
    } else {
      // Fall back to location hierarchy for non-date searches
      const queryRequest: Record<string, unknown> = {
        includeFacilities: true,
        includeChildren: true
      };
      
      if (request.parentLocationId) {
        queryRequest['parentId'] = request.parentLocationId;
      }
      
      const hierarchy = await this.locationService.getLocationHierarchy(queryRequest as ILocationQueryRequest);
      locations = this.flattenLocationHierarchy(hierarchy.locations || []);
    }
    
    const totalLocations = locations.length;
    
    // Removed debug logging
    
    // If no locations found and we haven't tried without parent filter, try global search
    if (locations.length === 0 && request.parentLocationId && !request.dateFrom) {
      const globalQuery: Record<string, unknown> = {
        includeFacilities: true,
        includeChildren: true
      };
      const globalHierarchy = await this.locationService.getLocationHierarchy(globalQuery as ILocationQueryRequest);
      locations = this.flattenLocationHierarchy(globalHierarchy.locations || []);
    }
    
    // Filter by location kind if specified
    if (request.locationKind) {
      // Special handling: 'ROOM' means locations with capacity for meetings
      if (request.locationKind === 'ROOM') {
        // Don't filter by kind - instead let capacity filter find actual rooms
        // Meeting rooms might be any kind but will have capacity > 1
        appliedFilters.push('meeting spaces');
      } else {
        locations = locations.filter(loc => loc.kind === request.locationKind);
        appliedFilters.push(`kind:${request.locationKind}`);
      }
    }
    
    // Filter by capacity if specified
    if (capacity && capacity > 0) {
      locations = locations.filter(loc => {
        // Check any location with explicit capacity
        if (loc.capacity) {
          return loc.capacity >= capacity;
        }
        // For desks, assume capacity of 1
        if (loc.kind === 'DESK') {
          return capacity <= 1;
        }
        // For locations without capacity, include them (might be bookable spaces)
        return true;
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
      
      // Apply capacity efficiency scoring
      if (capacity && location.capacity) {
        if (location.capacity === capacity) {
          // Perfect match bonus
          score *= 1.2;
          matchDetails.push(`🎯 Perfect capacity match (${capacity})`);
        } else if (location.capacity >= capacity) {
          // Calculate efficiency penalty for oversized rooms
          const wastedCapacity = location.capacity - capacity;
          const efficiencyScore = Math.exp(-0.15 * wastedCapacity);
          score *= efficiencyScore;
          
          // Add efficiency details
          const efficiencyPercent = Math.round(efficiencyScore * 100);
          matchDetails.push(`Capacity ${location.capacity} (requested ${capacity})`);
          matchDetails.push(`Efficiency: ${efficiencyPercent}%`);
          
          // Add visual indicator
          if (efficiencyScore >= 0.85) {
            matchDetails.push('✅ Excellent size match');
          } else if (efficiencyScore >= 0.60) {
            matchDetails.push('👍 Good size match');
          } else if (efficiencyScore >= 0.40) {
            matchDetails.push('⚠️ Larger than needed');
          } else {
            matchDetails.push('❌ Significantly oversized');
          }
        }
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
    
    // Sort by score with smart capacity tiebreaking
    scoredLocations.sort((a, b) => {
      // Primary sort by score
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.01) {
        return scoreDiff;
      }
      // For similar scores when capacity is specified, prefer smaller rooms
      if (capacity && a.location.capacity && b.location.capacity) {
        return a.location.capacity - b.location.capacity;
      }
      return scoreDiff;
    });
    
    // Apply smart defaults for capacity searches
    const effectiveLimit = capacity && !request.limit 
      ? Math.min(3, scoredLocations.length)  // Show top 3 for capacity searches
      : request.limit || scoredLocations.length;
    
    const limitedLocations = scoredLocations.slice(0, effectiveLimit);
    
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
          const availRequest = {
            locationId: scoredLoc.location.id,
            dateFrom: request.dateFrom,
            dateTo: request.dateTo,
          };
          
          const availability = await this.availabilityService.checkAvailability(availRequest);
          
          // Check if available is an array with slots
          const isAvailable = Array.isArray(availability.available) && availability.available.length > 0;
          
          result.availability = {
            isAvailable,
            availableSlots: isAvailable && Array.isArray(availability.available) 
              ? availability.available.map((slot: Record<string, string>) => ({
                  from: slot['timeFrom'] || slot['from'] || '',
                  to: slot['timeTo'] || slot['to'] || ''
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
        } catch {
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
  
}