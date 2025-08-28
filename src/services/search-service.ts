/**
 * Intelligent search service with natural language processing
 */
import {
  ISearchService,
  ISearchQuery,
  ISearchResponse,
  ISearchResult,
  IParsedSearchRequirements,
  IFacilityMatch,
  IRankingFactors,
  DEFAULT_RANKING_FACTORS
} from '../types/search.types.js';
import { IOrganizationService } from '../types/organization.types.js';
import { ILocationService } from '../types/location.types.js';
import { IAvailabilityService } from '../types/availability.types.js';
import { ILocation } from '../types/location.types.js';
import { IFacility } from '../types/facility.types.js';

export class SearchService implements ISearchService {
  private organizationService: IOrganizationService;
  private locationService: ILocationService;
  private availabilityService: IAvailabilityService;
  private rankingFactors: IRankingFactors;

  constructor(
    organizationService: IOrganizationService,
    locationService: ILocationService,
    availabilityService: IAvailabilityService,
    rankingFactors: IRankingFactors = DEFAULT_RANKING_FACTORS
  ) {
    this.organizationService = organizationService;
    this.locationService = locationService;
    this.availabilityService = availabilityService;
    this.rankingFactors = rankingFactors;
  }

  /**
   * Main search method with natural language support
   */
  async search(query: ISearchQuery): Promise<ISearchResponse> {
    const startTime = Date.now();
    
    // Parse the natural language query
    const parsedRequirements = this.parseQuery(query.query);
    
    // Merge parsed time constraints with explicit ones
    if (query.dateFrom) {
      parsedRequirements.timeConstraints = {
        ...parsedRequirements.timeConstraints,
        dateFrom: query.dateFrom
      };
    }
    if (query.dateTo) {
      parsedRequirements.timeConstraints = {
        ...parsedRequirements.timeConstraints,
        dateTo: query.dateTo
      };
    }
    if (query.duration) {
      parsedRequirements.timeConstraints = {
        ...parsedRequirements.timeConstraints,
        duration: query.duration
      };
    }
    
    // Apply category from query if provided
    if (query.category) {
      parsedRequirements.category = query.category;
    }
    
    // Fetch locations based on filters
    const locations = await this.fetchFilteredLocations(
      parsedRequirements,
      query.buildingId,
      query.organizationId
    );
    
    // Check availability for each location if time constraints exist
    let searchResults: ISearchResult[] = [];
    
    for (const location of locations) {
      const result = await this.evaluateLocation(
        location,
        parsedRequirements
      );
      
      if (result) {
        searchResults.push(result);
      }
    }
    
    // Rank results
    searchResults = this.rankResults(searchResults, parsedRequirements);
    
    // Generate suggestions if no perfect matches
    const suggestions = this.generateSuggestions(searchResults, parsedRequirements);
    
    return {
      results: searchResults,
      totalResults: searchResults.length,
      metadata: {
        query: query.query,
        parsedRequirements,
        searchTime: Date.now() - startTime,
        filtersApplied: this.getAppliedFilters(parsedRequirements, query)
      },
      suggestions
    };
  }

  /**
   * Parse natural language query into structured requirements
   */
  parseQuery(query: string): IParsedSearchRequirements {
    const requirements: IParsedSearchRequirements = {
      facilities: [],
      locationHints: [],
      originalQuery: query
    };
    
    const queryLower = query.toLowerCase();
    
    // Extract capacity requirements
    const capacityPatterns = [
      /for\s+(\d+)\s+(?:people|persons?|attendees?)/i,
      /(\d+)\s+(?:people|person|attendee)/i,
      /capacity\s+(?:of\s+)?(\d+)/i,
      /seats?\s+(\d+)/i,
      /(\d+)\s+seats?/i
    ];
    
    for (const pattern of capacityPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        requirements.capacity = parseInt(match[1], 10);
        break;
      }
    }
    
    // Extract facility requirements
    const facilityKeywords = {
      'conference phone': ['conference phone', 'conference call', 'speaker phone', 'polycom'],
      'screen': ['screen', 'monitor', 'display', 'tv', 'television'],
      'projector': ['projector', 'projection'],
      'whiteboard': ['whiteboard', 'white board', 'board'],
      'video conference': ['video conference', 'video call', 'zoom', 'teams', 'webcam', 'camera'],
      'microphone': ['microphone', 'mic', 'audio'],
      'wheelchair accessible': ['wheelchair', 'accessible', 'disability'],
      'coffee': ['coffee', 'tea', 'refreshment', 'kitchen'],
      'desk': ['desk', 'workstation', 'workspace'],
      'adjustable desk': ['adjustable desk', 'standing desk', 'sit-stand']
    };
    
    for (const [facility, keywords] of Object.entries(facilityKeywords)) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          if (!requirements.facilities.includes(facility)) {
            requirements.facilities.push(facility);
          }
        }
      }
    }
    
    // Extract screen size if mentioned
    const screenSizeMatch = query.match(/(\d+)["']?\s*(?:inch)?\s*(?:screen|monitor|display|tv)/i);
    if (screenSizeMatch && screenSizeMatch[1]) {
      const size = parseInt(screenSizeMatch[1], 10);
      requirements.facilities.push(`${size}" screen`);
    }
    
    // Extract location hints
    const locationKeywords = {
      'floor': /(\d+)(?:st|nd|rd|th)?\s+floor/i,
      'building': /(building|block)\s+(\w+)/i,
      'zone': /zone\s+(\w+)/i,
      'room': /room\s+(\w+)/i
    };
    
    for (const [, pattern] of Object.entries(locationKeywords)) {
      const match = query.match(pattern);
      if (match) {
        requirements.locationHints.push(match[0]);
      }
    }
    
    // Infer booking category from query context
    if (queryLower.includes('meeting') || queryLower.includes('conference')) {
      requirements.category = 'Meeting Rooms';
    } else if (queryLower.includes('desk') || queryLower.includes('workstation')) {
      requirements.category = 'Desks';
    } else if (queryLower.includes('privacy pod') || queryLower.includes('pod')) {
      requirements.category = 'Privacy Pods';
    }
    
    // Extract time constraints
    const timeConstraints: Record<string, string | number> = {};
    
    // Date patterns
    const dateMatch = query.match(/on\s+(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch && dateMatch[1]) {
      timeConstraints['dateFrom'] = `${dateMatch[1]}T09:00:00.000`;
      timeConstraints['dateTo'] = `${dateMatch[1]}T18:00:00.000`;
    }
    
    // Duration patterns
    const durationPatterns = [
      /for\s+(\d+)\s+hours?/i,
      /(\d+)\s+hours?\s+meeting/i,
      /duration\s+(?:of\s+)?(\d+)\s+hours?/i
    ];
    
    for (const pattern of durationPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        timeConstraints['duration'] = parseInt(match[1], 10) * 60; // Convert to minutes
        break;
      }
    }
    
    // Duration in minutes
    const minuteMatch = query.match(/(\d+)\s+minutes?/i);
    if (minuteMatch && minuteMatch[1]) {
      timeConstraints['duration'] = parseInt(minuteMatch[1], 10);
    }
    
    if (Object.keys(timeConstraints).length > 0) {
      requirements.timeConstraints = timeConstraints;
    }
    
    return requirements;
  }

  /**
   * Rank search results by relevance
   */
  rankResults(
    results: ISearchResult[],
    requirements: IParsedSearchRequirements
  ): ISearchResult[] {
    // Calculate scores for each result
    const scoredResults = results.map(result => {
      let score = 0;
      
      // Facility match score (40%)
      if (requirements.facilities.length > 0) {
        const facilityScore = this.calculateFacilityScore(
          result.facilityMatches,
          requirements.facilities
        );
        score += facilityScore * this.rankingFactors.facilityWeight;
      }
      
      // Capacity match score (25%)
      if (requirements.capacity && result.capacity) {
        const capacityScore = this.calculateCapacityScore(
          result.capacity.requested,
          result.capacity.actual
        );
        score += capacityScore * this.rankingFactors.capacityWeight;
      }
      
      // Availability score (25%)
      if (result.availability) {
        const availabilityScore = result.availability.isAvailable ? 100 : 30;
        score += availabilityScore * this.rankingFactors.availabilityWeight;
      }
      
      // Location preference score (10%)
      const locationScore = this.calculateLocationScore(
        result.location,
        requirements.locationHints
      );
      score += locationScore * this.rankingFactors.locationWeight;
      
      // Update relevance score
      result.relevanceScore = Math.round(score);
      
      return result;
    });
    
    // Sort by relevance score descending
    return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Find rooms with specific facilities
   */
  async findRoomsWithFacilities(
    facilities: string[],
    options?: {
      dateFrom?: string;
      dateTo?: string;
      capacity?: number;
      buildingId?: number;
    }
  ): Promise<ISearchResult[]> {
    // Build search query from facilities and options
    let queryParts: string[] = [];
    
    // Add facilities to query
    queryParts.push(...facilities);
    
    // Add capacity if specified
    if (options?.capacity) {
      queryParts.push(`for ${options.capacity} people`);
    }
    
    // Add date if specified
    if (options?.dateFrom) {
      const date = options.dateFrom.split('T')[0];
      queryParts.push(`on ${date}`);
    }
    
    const searchQuery: ISearchQuery = {
      query: queryParts.join(' '),
      ...(options?.dateFrom && { dateFrom: options.dateFrom }),
      ...(options?.dateTo && { dateTo: options.dateTo }),
      ...(options?.buildingId && { buildingId: options.buildingId })
    };
    
    const response = await this.search(searchQuery);
    return response.results;
  }

  /**
   * Fetch locations based on filters
   */
  private async fetchFilteredLocations(
    requirements: IParsedSearchRequirements,
    buildingId?: number,
    organizationId?: string
  ): Promise<ILocation[]> {
    try {
      // Get all locations, optionally filtered by building
      const locationHierarchy = await this.locationService.getLocationHierarchy({
        ...(buildingId && { parentId: buildingId }),
        includeChildren: true,
        includeFacilities: true
      });
      
      let locations = locationHierarchy.locations || [];
      
      // Filter by booking category if specified
      if (requirements.category) {
        const orgId = organizationId || await this.getCurrentOrganizationId();
        const categories = await this.organizationService.getBookingCategories(
          parseInt(orgId, 10)
        );
        
        const categoryInfo = categories.find(c => c.name === requirements.category);
        if (categoryInfo) {
          locations = locations.filter(loc => 
            loc.bookingCategoryId === categoryInfo.id
          );
        }
      }
      
      // Filter by location hints
      if (requirements.locationHints.length > 0) {
        locations = locations.filter(loc => {
          const locationString = `${loc.name} ${loc.description || ''}`.toLowerCase();
          return requirements.locationHints.some(hint => 
            locationString.includes(hint.toLowerCase())
          );
        });
      }
      
      return locations;
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  }

  /**
   * Evaluate a location against requirements
   */
  private async evaluateLocation(
    location: ILocation,
    requirements: IParsedSearchRequirements
  ): Promise<ISearchResult | null> {
    const result: ISearchResult = {
      location,
      relevanceScore: 0,
      facilityMatches: [],
      matchReason: '',
      alternatives: []
    };
    
    // Check facility matches
    if (requirements.facilities.length > 0 && location.facilities) {
      const parsedFacilities = location.facilities;
      
      for (const requiredFacility of requirements.facilities) {
        const match = this.findFacilityMatch(requiredFacility, parsedFacilities);
        if (match) {
          result.facilityMatches.push(match);
        }
      }
      
      // Skip if missing required facilities
      if (result.facilityMatches.length === 0) {
        return null;
      }
    }
    
    // Check capacity
    if (requirements.capacity) {
      const actualCapacity = this.extractCapacity(location);
      result.capacity = {
        requested: requirements.capacity,
        actual: actualCapacity,
        isMatch: actualCapacity >= requirements.capacity
      };
      
      // Skip if capacity doesn't match
      if (!result.capacity.isMatch && actualCapacity > 0) {
        return null;
      }
    }
    
    // Check availability if time constraints exist
    if (requirements.timeConstraints) {
      try {
        const availability = await this.availabilityService.checkAvailability({
          locationId: location.id,
          ...(requirements.timeConstraints.dateFrom && { dateFrom: requirements.timeConstraints.dateFrom }),
          ...(requirements.timeConstraints.dateTo && { dateTo: requirements.timeConstraints.dateTo }),
          ...(requirements.timeConstraints.duration && { duration: requirements.timeConstraints.duration })
        });
        
        result.availability = {
          isAvailable: availability.available || false,
          availableSlots: availability.slots?.map(slot => ({
            from: slot.from,
            to: slot.to
          })) || []
        };
      } catch (error) {
        console.error('Error checking availability:', error);
        result.availability = { isAvailable: false };
      }
    }
    
    // Generate match reason
    result.matchReason = this.generateMatchReason(result, requirements);
    
    return result;
  }

  /**
   * Find facility match
   */
  private findFacilityMatch(
    requiredFacility: string,
    facilities: IFacility[]
  ): IFacilityMatch | null {
    const reqLower = requiredFacility.toLowerCase();
    
    for (const facility of facilities) {
      const facilityLower = facility.name.toLowerCase();
      
      // Exact match
      if (facilityLower === reqLower) {
        return {
          facility,
          matchType: 'exact',
          score: 100,
          searchTerm: requiredFacility
        };
      }
      
      // Partial match
      if (facilityLower.includes(reqLower) || reqLower.includes(facilityLower)) {
        return {
          facility,
          matchType: 'partial',
          score: 75,
          searchTerm: requiredFacility
        };
      }
      
      // Category match
      if (facility.category === reqLower || 
          this.areFacilitiesRelated(requiredFacility, facility.name)) {
        return {
          facility,
          matchType: 'related',
          score: 50,
          searchTerm: requiredFacility
        };
      }
    }
    
    return null;
  }

  /**
   * Check if facilities are related
   */
  private areFacilitiesRelated(facility1: string, facility2: string): boolean {
    const relatedTerms: Record<string, string[]> = {
      'conference phone': ['polycom', 'speaker phone', 'conference call'],
      'screen': ['monitor', 'display', 'tv', 'television'],
      'video conference': ['webcam', 'camera', 'zoom', 'teams']
    };
    
    const f1Lower = facility1.toLowerCase();
    const f2Lower = facility2.toLowerCase();
    
    for (const [key, related] of Object.entries(relatedTerms)) {
      if ((f1Lower.includes(key) || related.some(r => f1Lower.includes(r))) &&
          (f2Lower.includes(key) || related.some(r => f2Lower.includes(r)))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract capacity from location
   */
  private extractCapacity(location: ILocation): number {
    // Look for capacity in name or description
    const text = `${location.name} ${location.description || ''}`;
    const capacityMatch = text.match(/(\d+)\s*(?:people|person|capacity|seats?)/i);
    
    if (capacityMatch && capacityMatch[1]) {
      return parseInt(capacityMatch[1], 10);
    }
    
    // Default capacities by location type
    const defaultCapacities: Record<string, number> = {
      'meeting room': 8,
      'conference room': 12,
      'board room': 20,
      'desk': 1,
      'privacy pod': 4
    };
    
    const locationLower = location.name.toLowerCase();
    for (const [type, capacity] of Object.entries(defaultCapacities)) {
      if (locationLower.includes(type)) {
        return capacity;
      }
    }
    
    return 0;
  }

  /**
   * Calculate facility match score
   */
  private calculateFacilityScore(
    matches: IFacilityMatch[],
    requiredFacilities: string[]
  ): number {
    if (requiredFacilities.length === 0) return 100;
    
    const matchedCount = matches.length;
    const requiredCount = requiredFacilities.length;
    
    if (matchedCount === 0) return 0;
    
    // Calculate average match quality
    const avgMatchScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
    
    // Calculate coverage (what % of required facilities were found)
    const coverage = (matchedCount / requiredCount) * 100;
    
    // Combined score (70% coverage, 30% match quality)
    return (coverage * 0.7) + (avgMatchScore * 0.3);
  }

  /**
   * Calculate capacity score
   */
  private calculateCapacityScore(requested: number, actual: number): number {
    if (actual === requested) return 100;
    if (actual > requested) {
      // Slightly oversized is OK
      const oversize = (actual - requested) / requested;
      if (oversize <= 0.5) return 90; // Up to 50% larger is good
      if (oversize <= 1) return 70; // Up to 100% larger is acceptable
      return 50; // Much larger is less ideal
    }
    // Undersized is not acceptable
    return 0;
  }

  /**
   * Calculate location preference score
   */
  private calculateLocationScore(
    location: ILocation,
    hints: string[]
  ): number {
    if (hints.length === 0) return 50; // Neutral score if no hints
    
    const locationText = `${location.name} ${location.description || ''}`.toLowerCase();
    let matchCount = 0;
    
    for (const hint of hints) {
      if (locationText.includes(hint.toLowerCase())) {
        matchCount++;
      }
    }
    
    return (matchCount / hints.length) * 100;
  }

  /**
   * Generate match reason
   */
  // eslint-disable-next-line no-unused-vars
  private generateMatchReason(
    result: ISearchResult,
    _requirements: IParsedSearchRequirements
  ): string {
    const reasons: string[] = [];
    
    if (result.facilityMatches.length > 0) {
      const facilityNames = result.facilityMatches.map(m => m.facility.name);
      reasons.push(`Has ${facilityNames.join(', ')}`);
    }
    
    if (result.capacity?.isMatch) {
      reasons.push(`Capacity for ${result.capacity.actual} people`);
    }
    
    if (result.availability?.isAvailable) {
      reasons.push('Available at requested time');
    }
    
    return reasons.join('. ') || 'Matches search criteria';
  }

  /**
   * Generate suggestions for better results
   */
  private generateSuggestions(
    results: ISearchResult[],
    requirements: IParsedSearchRequirements
  ): string[] {
    const suggestions: string[] = [];
    
    if (results.length === 0) {
      suggestions.push('Try searching with fewer facility requirements');
      if (requirements.capacity && requirements.capacity > 10) {
        suggestions.push('Consider reducing the required capacity');
      }
      if (requirements.timeConstraints) {
        suggestions.push('Try different time slots for better availability');
      }
    } else if (results.every(r => r.relevanceScore < 70)) {
      suggestions.push('Results found but with partial matches');
      if (requirements.facilities.length > 2) {
        suggestions.push('Prioritize your most important facility requirements');
      }
    }
    
    return suggestions;
  }

  /**
   * Get list of applied filters
   */
  private getAppliedFilters(
    requirements: IParsedSearchRequirements,
    query: ISearchQuery
  ): string[] {
    const filters: string[] = [];
    
    if (requirements.facilities.length > 0) {
      filters.push(`Facilities: ${requirements.facilities.join(', ')}`);
    }
    
    if (requirements.capacity) {
      filters.push(`Capacity: ${requirements.capacity}+ people`);
    }
    
    if (requirements.category) {
      filters.push(`Category: ${requirements.category}`);
    }
    
    if (query.buildingId) {
      filters.push(`Building: ${query.buildingId}`);
    }
    
    if (requirements.timeConstraints?.dateFrom) {
      filters.push(`Date: ${requirements.timeConstraints.dateFrom.split('T')[0]}`);
    }
    
    return filters;
  }

  /**
   * Get current organization ID
   */
  private async getCurrentOrganizationId(): Promise<string> {
    // This would typically get from user service or auth context
    // For now, return a default
    return 'default';
  }
}