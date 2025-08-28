/**
 * Unit tests for SearchService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../../src/services/search-service.js';
import { IOrganizationService } from '../../../src/types/organization.types.js';
import { ILocationService } from '../../../src/types/location.types.js';
import { IAvailabilityService } from '../../../src/types/availability.types.js';
import { ISearchQuery, IParsedSearchRequirements } from '../../../src/types/search.types.js';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockOrganizationService: IOrganizationService;
  let mockLocationService: ILocationService;
  let mockAvailabilityService: IAvailabilityService;

  beforeEach(() => {
    // Create mock services
    mockOrganizationService = {
      getOrganization: vi.fn(),
      getBookingCategories: vi.fn().mockResolvedValue([
        { id: 1, name: 'Meeting Rooms', description: 'Meeting rooms' },
        { id: 2, name: 'Desks', description: 'Hot desks' },
        { id: 3, name: 'Privacy Pods', description: 'Privacy pods' }
      ]),
      getLocationKinds: vi.fn().mockResolvedValue([])
    };

    mockLocationService = {
      getLocation: vi.fn(),
      getPreferredLocation: vi.fn(),
      validateLocationId: vi.fn().mockReturnValue(true),
      getLocationsByKind: vi.fn().mockResolvedValue([]),
      getLocationHierarchy: vi.fn().mockResolvedValue({
        locations: [
          {
            id: 100001,
            name: 'Conference Room A',
            description: 'Large conference room',
            kind: 'ROOM',
            bookingCategoryId: 1,
            facilities: [
              { id: 'screen', name: '34" Screen', category: 'audio_visual' },
              { id: 'phone', name: 'Conference Phone', category: 'audio_visual' },
              { id: 'whiteboard', name: 'Whiteboard', category: 'technology' }
            ],
            buildingName: 'Building 1',
            floorName: 'Floor 1'
          },
          {
            id: 100002,
            name: 'Meeting Room B',
            description: 'Small meeting room for 4 people',
            kind: 'ROOM',
            bookingCategoryId: 1,
            facilities: [
              { id: 'tv', name: 'TV', category: 'audio_visual' },
              { id: 'whiteboard', name: 'Whiteboard', category: 'technology' }
            ],
            buildingName: 'Building 1',
            floorName: 'Floor 2'
          },
          {
            id: 100003,
            name: 'Desk 101',
            description: 'Hot desk with adjustable height',
            kind: 'DESK',
            bookingCategoryId: 2,
            facilities: [
              { id: 'adjustable_desk', name: 'Adjustable Desk', category: 'furniture' },
              { id: 'monitor', name: 'Monitor', category: 'technology' }
            ],
            buildingName: 'Building 2',
            floorName: 'Floor 1'
          }
        ]
      })
    };

    mockAvailabilityService = {
      checkAvailability: vi.fn().mockResolvedValue({
        available: true,
        slots: [
          { from: '2025-02-01T09:00:00', to: '2025-02-01T17:00:00', available: true, locationId: 100001 }
        ],
        location: { id: 100001, name: 'Conference Room A' }
      }),
      formatAvailabilityRequest: vi.fn()
    };


    searchService = new SearchService(
      mockOrganizationService,
      mockLocationService,
      mockAvailabilityService
    );
  });

  describe('parseQuery', () => {
    it('should parse capacity requirements', () => {
      const testCases = [
        { query: 'room for 6 people', expectedCapacity: 6 },
        { query: 'meeting room for 10 persons', expectedCapacity: 10 },
        { query: 'space with capacity of 8', expectedCapacity: 8 },
        { query: 'room with 12 seats', expectedCapacity: 12 },
        { query: '5 person meeting room', expectedCapacity: 5 }
      ];

      testCases.forEach(({ query, expectedCapacity }) => {
        const result = searchService.parseQuery(query);
        expect(result.capacity).toBe(expectedCapacity);
      });
    });

    it('should parse facility requirements', () => {
      const testCases = [
        { 
          query: 'room with conference phone and screen', 
          expectedFacilities: ['conference phone', 'screen'] 
        },
        { 
          query: 'meeting room with projector and whiteboard', 
          expectedFacilities: ['projector', 'whiteboard'] 
        },
        { 
          query: 'desk with adjustable height and monitor', 
          expectedFacilities: ['desk', 'screen'] 
        },
        { 
          query: 'wheelchair accessible room with video conference', 
          expectedFacilities: ['wheelchair accessible', 'video conference'] 
        },
        { 
          query: 'room with 34" screen', 
          expectedFacilities: ['screen', '34" screen'] 
        }
      ];

      testCases.forEach(({ query, expectedFacilities }) => {
        const result = searchService.parseQuery(query);
        expectedFacilities.forEach(facility => {
          expect(result.facilities).toContain(facility);
        });
      });
    });

    it('should parse location hints', () => {
      const testCases = [
        { query: 'room on 3rd floor', expectedHints: ['3rd floor'] },
        { query: 'desk in building A', expectedHints: ['building A'] },
        { query: 'meeting room in zone B', expectedHints: ['zone B'] },
        { query: 'room 701', expectedHints: ['room 701'] }
      ];

      testCases.forEach(({ query, expectedHints }) => {
        const result = searchService.parseQuery(query);
        expectedHints.forEach(hint => {
          expect(result.locationHints).toContain(hint);
        });
      });
    });

    it('should infer booking category', () => {
      const testCases = [
        { query: 'meeting room with screen', expectedCategory: 'Meeting Rooms' },
        { query: 'conference room for 10', expectedCategory: 'Meeting Rooms' },
        { query: 'desk with monitor', expectedCategory: 'Desks' },
        { query: 'privacy pod for calls', expectedCategory: 'Privacy Pods' }
      ];

      testCases.forEach(({ query, expectedCategory }) => {
        const result = searchService.parseQuery(query);
        expect(result.category).toBe(expectedCategory);
      });
    });

    it('should parse time constraints', () => {
      const query = 'room for 2 hours on 2025-02-01';
      const result = searchService.parseQuery(query);
      
      expect(result.timeConstraints).toBeDefined();
      expect(result.timeConstraints?.dateFrom).toBe('2025-02-01T09:00:00.000');
      expect(result.timeConstraints?.dateTo).toBe('2025-02-01T18:00:00.000');
      expect(result.timeConstraints?.duration).toBe(120); // 2 hours in minutes
    });

    it('should parse duration in minutes', () => {
      const query = 'room for 30 minutes';
      const result = searchService.parseQuery(query);
      
      expect(result.timeConstraints?.duration).toBe(30);
    });
  });

  describe('search', () => {
    it('should perform a basic search with facilities', async () => {
      const query: ISearchQuery = {
        query: 'room with conference phone for 6 people'
      };

      const response = await searchService.search(query);

      expect(response.results).toBeDefined();
      expect(response.totalResults).toBeGreaterThanOrEqual(0);
      expect(response.metadata.query).toBe(query.query);
      expect(response.metadata.parsedRequirements.facilities).toContain('conference phone');
      expect(response.metadata.parsedRequirements.capacity).toBe(6);
    });

    it('should filter by booking category', async () => {
      const query: ISearchQuery = {
        query: 'desk with monitor',
        category: 'Desks'
      };

      const response = await searchService.search(query);

      expect(mockOrganizationService.getBookingCategories).toHaveBeenCalled();
      expect(response.metadata.parsedRequirements.category).toBe('Desks');
    });

    it('should check availability when time constraints exist', async () => {
      const query: ISearchQuery = {
        query: 'meeting room',
        dateFrom: '2025-02-01T09:00:00.000',
        dateTo: '2025-02-01T17:00:00.000'
      };

      const response = await searchService.search(query);

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalled();
      expect(response.results.some(r => r.availability?.isAvailable)).toBe(true);
    });

    it('should handle empty search results gracefully', async () => {
      mockLocationService.getLocationHierarchy = vi.fn().mockResolvedValue({ locations: [] });

      const query: ISearchQuery = {
        query: 'non-existent room'
      };

      const response = await searchService.search(query);

      expect(response.results).toEqual([]);
      expect(response.totalResults).toBe(0);
      expect(response.suggestions).toBeDefined();
      expect(response.suggestions?.length).toBeGreaterThan(0);
    });

    it('should apply building filter', async () => {
      const query: ISearchQuery = {
        query: 'meeting room',
        buildingId: 1001
      };

      await searchService.search(query);

      expect(mockLocationService.getLocationHierarchy).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 1001 })
      );
    });
  });

  describe('rankResults', () => {
    it('should rank results by facility matches', () => {
      const requirements: IParsedSearchRequirements = {
        facilities: ['conference phone', 'screen'],
        locationHints: [],
        originalQuery: 'test'
      };

      const results = [
        {
          location: { id: 1, name: 'Room A' } as any,
          relevanceScore: 0,
          facilityMatches: [
            { facility: { name: 'Conference Phone' } as any, matchType: 'exact' as const, score: 100, searchTerm: 'conference phone' },
            { facility: { name: 'Screen' } as any, matchType: 'exact' as const, score: 100, searchTerm: 'screen' }
          ],
          matchReason: ''
        },
        {
          location: { id: 2, name: 'Room B' } as any,
          relevanceScore: 0,
          facilityMatches: [
            { facility: { name: 'Phone' } as any, matchType: 'partial' as const, score: 75, searchTerm: 'conference phone' }
          ],
          matchReason: ''
        }
      ];

      const ranked = searchService.rankResults(results, requirements);

      expect(ranked).toHaveLength(2);
      expect(ranked[0]?.location.name).toBe('Room A');
      expect(ranked[0]?.relevanceScore).toBeGreaterThan(ranked[1]?.relevanceScore || 0);
    });

    it('should rank by capacity match', () => {
      const requirements: IParsedSearchRequirements = {
        facilities: [],
        capacity: 6,
        locationHints: [],
        originalQuery: 'test'
      };

      const results = [
        {
          location: { id: 1, name: 'Room A' } as any,
          relevanceScore: 0,
          facilityMatches: [],
          capacity: { requested: 6, actual: 6, isMatch: true },
          matchReason: ''
        },
        {
          location: { id: 2, name: 'Room B' } as any,
          relevanceScore: 0,
          facilityMatches: [],
          capacity: { requested: 6, actual: 10, isMatch: true },
          matchReason: ''
        }
      ];

      const ranked = searchService.rankResults(results, requirements);

      expect(ranked[0]?.location.name).toBe('Room A'); // Exact match scores higher
      expect(ranked[0]?.relevanceScore).toBeGreaterThan(ranked[1]?.relevanceScore || 0);
    });

    it('should rank by availability', () => {
      const requirements: IParsedSearchRequirements = {
        facilities: [],
        locationHints: [],
        originalQuery: 'test',
        timeConstraints: { dateFrom: '2025-02-01T09:00:00' }
      };

      const results = [
        {
          location: { id: 1, name: 'Room A' } as any,
          relevanceScore: 0,
          facilityMatches: [],
          availability: { isAvailable: true },
          matchReason: ''
        },
        {
          location: { id: 2, name: 'Room B' } as any,
          relevanceScore: 0,
          facilityMatches: [],
          availability: { isAvailable: false },
          matchReason: ''
        }
      ];

      const ranked = searchService.rankResults(results, requirements);

      expect(ranked).toHaveLength(2);
      expect(ranked[0]?.location.name).toBe('Room A');
      expect(ranked[0]?.relevanceScore).toBeGreaterThan(ranked[1]?.relevanceScore || 0);
    });
  });

  describe('findRoomsWithFacilities', () => {
    it('should find rooms with specific facilities', async () => {
      const facilities = ['conference phone', 'screen'];
      const options = {
        dateFrom: '2025-02-01T09:00:00.000',
        dateTo: '2025-02-01T17:00:00.000',
        capacity: 6
      };

      const results = await searchService.findRoomsWithFacilities(facilities, options);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should build query from facilities and options', async () => {
      const searchSpy = vi.spyOn(searchService, 'search');
      
      const facilities = ['whiteboard'];
      const options = {
        capacity: 8,
        buildingId: 1001
      };

      await searchService.findRoomsWithFacilities(facilities, options);

      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('whiteboard'),
          buildingId: 1001
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty query gracefully', () => {
      const result = searchService.parseQuery('');
      
      expect(result.facilities).toEqual([]);
      expect(result.capacity).toBeUndefined();
      expect(result.locationHints).toEqual([]);
      expect(result.originalQuery).toBe('');
    });

    it('should handle malformed capacity numbers', () => {
      const result = searchService.parseQuery('room for abc people');
      
      expect(result.capacity).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      mockLocationService.getLocationHierarchy = vi.fn().mockRejectedValue(new Error('API Error'));

      const query: ISearchQuery = {
        query: 'meeting room'
      };

      const response = await searchService.search(query);

      expect(response.results).toEqual([]);
      expect(response.totalResults).toBe(0);
    });

    it('should handle locations without facilities', async () => {
      mockLocationService.getLocationHierarchy = vi.fn().mockResolvedValue({
        locations: [
          {
            id: 100004,
            name: 'Empty Room',
            kind: 'ROOM',
            facilities: null // No facilities
          }
        ]
      });

      const query: ISearchQuery = {
        query: 'room with screen'
      };

      const response = await searchService.search(query);

      // Should not include the room without facilities when facilities are required
      expect(response.results.length).toBe(0);
    });

    it('should handle complex natural language queries', () => {
      const query = 'I need a large conference room with a 55" TV screen, conference phone, and whiteboard for 12 people on 2025-02-01 from 2pm to 4pm';
      const result = searchService.parseQuery(query);

      expect(result.capacity).toBe(12);
      expect(result.facilities).toContain('conference phone');
      expect(result.facilities).toContain('screen');
      expect(result.facilities).toContain('whiteboard');
      expect(result.facilities).toContain('55" screen');
      expect(result.timeConstraints?.dateFrom).toContain('2025-02-01');
    });
  });
});