/**
 * Search-related types and interfaces
 */
/* eslint-disable no-unused-vars */

import { ILocation } from './location.types.js';

/**
 * Requirements for location search
 */
export interface ILocationSearchRequest {
  /** Facility requirements (e.g., ["adjustable desk", "screen"]) */
  requirements?: string[];
  
  /** Minimum capacity needed */
  capacity?: number;
  
  /** Location kind filter (ROOM, DESK, etc.) */
  locationKind?: string;
  
  /** Start time for availability check */
  dateFrom?: string;
  
  /** End time for availability check */
  dateTo?: string;
  
  /** Maximum number of results to return */
  limit?: number;
  
  /** Parent location ID to search within */
  parentLocationId?: number;
  
  /** Natural language query */
  query?: string;
}

/**
 * Search result with match details
 */
export interface ILocationSearchResult {
  /** The matching location */
  location: ILocation;
  
  /** Match score (0-1) */
  score: number;
  
  /** Details about what matched */
  matchDetails: string[];
  
  /** Availability status if checked */
  availability?: {
    isAvailable: boolean;
    availableSlots?: Array<{
      from: string;
      to: string;
    }>;
  };
  
  /** Facility information */
  facilityInfo?: {
    matchedFacilities: string[];
    allFacilities: string[];
  };
}

/**
 * Response from location search
 */
export interface ILocationSearchResponse {
  /** Search results sorted by relevance */
  results: ILocationSearchResult[];
  
  /** Total number of matches found */
  totalMatches: number;
  
  /** Search metadata */
  metadata: {
    searchTime: number;
    locationsSearched: number;
    availabilityChecked: number;
    appliedFilters: string[];
  };
}

/**
 * Service interface for advanced location search
 */
export interface ISearchService {
  /**
   * Search locations by requirements
   */
  searchLocationsByRequirements(request: ILocationSearchRequest): Promise<ILocationSearchResponse>;
  
  /**
   * Search locations by natural language query
   */
  searchByQuery(query: string): Promise<ILocationSearchResponse>;
  
  /**
   * Get locations matching specific facilities
   */
  findLocationsWithFacilities(facilities: string[]): Promise<ILocation[]>;
}