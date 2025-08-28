/**
 * Search service type definitions
 */
/* eslint-disable no-unused-vars */
import { ILocation } from './location.types.js';
import { IFacility } from './facility.types.js';

/**
 * Natural language search query interface
 */
export interface ISearchQuery {
  /** Raw natural language query string */
  query: string;
  /** Date range for availability */
  dateFrom?: string;
  dateTo?: string;
  /** Minimum duration in minutes */
  duration?: number;
  /** Organization ID */
  organizationId?: string;
  /** Building or location filter */
  buildingId?: number;
  /** Booking category filter (Meeting Rooms, Desks, etc.) */
  category?: string;
}

/**
 * Parsed search requirements from natural language
 */
export interface IParsedSearchRequirements {
  /** Required facilities extracted from query */
  facilities: string[];
  /** Required capacity */
  capacity?: number;
  /** Location hints (floor, building, zone) */
  locationHints: string[];
  /** Booking category inferred from query */
  category?: string;
  /** Time constraints */
  timeConstraints?: {
    dateFrom?: string;
    dateTo?: string;
    duration?: number;
  };
  /** Original query for reference */
  originalQuery: string;
}

/**
 * Facility match information
 */
export interface IFacilityMatch {
  /** The facility that was matched */
  facility: IFacility;
  /** Type of match */
  matchType: 'exact' | 'partial' | 'related' | 'category';
  /** Match score (0-100) */
  score: number;
  /** What was searched for */
  searchTerm: string;
}

/**
 * Search result item
 */
export interface ISearchResult {
  /** Location/resource information */
  location: ILocation;
  /** Relevance score (0-100) */
  relevanceScore: number;
  /** Facility matches */
  facilityMatches: IFacilityMatch[];
  /** Availability information */
  availability?: {
    isAvailable: boolean;
    availableSlots?: Array<{
      from: string;
      to: string;
    }>;
    nextAvailable?: string;
  };
  /** Capacity information */
  capacity?: {
    requested: number;
    actual: number;
    isMatch: boolean;
  };
  /** Why this result was included */
  matchReason: string;
  /** Alternative suggestions if not a perfect match */
  alternatives?: string[];
}

/**
 * Search response
 */
export interface ISearchResponse {
  /** Search results sorted by relevance */
  results: ISearchResult[];
  /** Total number of results found */
  totalResults: number;
  /** Search metadata */
  metadata: {
    query: string;
    parsedRequirements: IParsedSearchRequirements;
    searchTime: number;
    filtersApplied: string[];
  };
  /** Suggestions for better results */
  suggestions?: string[];
}

/**
 * Search service interface
 */
export interface ISearchService {
  /**
   * Search for rooms/resources with natural language
   */
  search(_query: ISearchQuery): Promise<ISearchResponse>;

  /**
   * Parse natural language query into structured requirements
   */
  parseQuery(_query: string): IParsedSearchRequirements;

  /**
   * Rank search results by relevance
   */
  rankResults(
    _results: ISearchResult[],
    _requirements: IParsedSearchRequirements
  ): ISearchResult[];

  /**
   * Find rooms with specific facilities
   */
  findRoomsWithFacilities(
    _facilities: string[],
    _options?: {
      dateFrom?: string;
      dateTo?: string;
      capacity?: number;
      buildingId?: number;
    }
  ): Promise<ISearchResult[]>;
}

/**
 * Search ranking factors
 */
export interface IRankingFactors {
  /** Weight for facility matches (0-1) */
  facilityWeight: number;
  /** Weight for capacity match (0-1) */
  capacityWeight: number;
  /** Weight for availability (0-1) */
  availabilityWeight: number;
  /** Weight for location preference (0-1) */
  locationWeight: number;
}

/**
 * Default ranking factors
 */
export const DEFAULT_RANKING_FACTORS: IRankingFactors = {
  facilityWeight: 0.4,
  capacityWeight: 0.25,
  availabilityWeight: 0.25,
  locationWeight: 0.1
};