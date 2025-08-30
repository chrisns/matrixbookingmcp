import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../../src/services/search-service.js';
import { ILocationService, ILocation } from '../../../src/types/location.types.js';
import { IAvailabilityService } from '../../../src/types/availability.types.js';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockLocationService: ILocationService;
  let mockAvailabilityService: IAvailabilityService;

  beforeEach(() => {
    // Create mock services
    mockLocationService = {
      getLocation: vi.fn(),
      getPreferredLocation: vi.fn(),
      validateLocationId: vi.fn(),
      getLocationHierarchy: vi.fn().mockResolvedValue({
        locations: [],
        total: 0,
        hierarchy: {}
      }),
      getLocationsByKind: vi.fn()
    };

    mockAvailabilityService = {
      checkAvailability: vi.fn().mockResolvedValue({
        available: [{
          timeFrom: '2024-01-01T09:00:00',
          timeTo: '2024-01-01T10:00:00'
        }]
      }),
      formatAvailabilityRequest: vi.fn()
    };

    searchService = new SearchService(mockLocationService, mockAvailabilityService);
  });

  describe('searchLocationsByRequirements', () => {
    it('should find locations with adjustable desks', async () => {
      const mockLocations: ILocation[] = [
        {
          id: 1001,
          name: 'Desk 37-A',
          kind: 'DESK',
          qualifiedName: 'Building 1 / Floor 7 / Desk 37-A',
          facilities: [
            { id: '1', name: 'Adjustable Desk - Mechanical', category: 'furniture' },
            { id: '2', name: '27" Screen', category: 'technology' }
          ]
        },
        {
          id: 1002,
          name: 'Desk 38-B',
          kind: 'DESK',
          qualifiedName: 'Building 1 / Floor 7 / Desk 38-B',
          facilities: [
            { id: '3', name: 'Fixed Desk', category: 'furniture' },
            { id: '4', name: '24" Screen', category: 'technology' }
          ]
        }
      ];

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: mockLocations,
        total: 2,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        requirements: ['adjustable desk'],
        locationKind: 'DESK'
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.location.id).toBe(1001);
      expect(result.results[0]!.facilityInfo?.hasAdjustableDesk).toBe(true);
      expect(result.results[0]!.matchDetails).toContain('✓ Has adjustable desk (mechanical mechanism)');
    });

    it('should filter by capacity for rooms', async () => {
      const mockLocations: ILocation[] = [
        {
          id: 2001,
          name: 'Meeting Room A',
          kind: 'ROOM',
          capacity: 8,
          facilities: []
        },
        {
          id: 2002,
          name: 'Meeting Room B',
          kind: 'ROOM',
          capacity: 4,
          facilities: []
        },
        {
          id: 2003,
          name: 'Conference Room',
          kind: 'ROOM',
          capacity: 20,
          facilities: []
        }
      ];

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: mockLocations,
        total: 3,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        capacity: 6,
        locationKind: 'ROOM'
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.location.capacity).toBeGreaterThanOrEqual(6);
      expect(result.results[1]!.location.capacity).toBeGreaterThanOrEqual(6);
      expect(result.totalMatches).toBe(2);
    });

    it('should check availability when dates provided', async () => {
      const mockLocation: ILocation = {
        id: 3001,
        name: 'Desk 40-C',
        kind: 'DESK',
        facilities: []
      };

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [mockLocation],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T10:00:00Z'
      });

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalledWith({
        locationId: 3001,
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T10:00:00Z',
        bookingCategory: 9000001 // Desk category
      });

      expect(result.results[0]!.availability).toBeDefined();
      expect(result.results[0]!.availability?.isAvailable).toBe(true);
      expect(result.results[0]!.matchDetails).toContain('✓ Available at requested time');
    });

    it('should combine multiple requirements', async () => {
      const mockLocation: ILocation = {
        id: 4001,
        name: 'Premium Desk',
        kind: 'DESK',
        facilities: [
          { id: '1', name: 'Adjustable Desk - Electric', category: 'furniture' },
          { id: '2', name: '34" Screen', category: 'technology' },
          { id: '3', name: 'WiFi', category: 'connectivity' }
        ]
      };

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [mockLocation],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        requirements: ['adjustable', '30 inch screen', 'wifi']
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.facilityInfo?.hasAdjustableDesk).toBe(true);
      expect(result.results[0]!.facilityInfo?.screenSize).toBe(34);
      expect(result.results[0]!.facilityInfo?.hasWifi).toBe(true);
      expect(result.results[0]!.score).toBeGreaterThan(0);
    });

    it('should limit results when specified', async () => {
      const mockLocations: ILocation[] = Array.from({ length: 20 }, (_, i) => ({
        id: 5000 + i,
        name: `Desk ${i}`,
        kind: 'DESK',
        facilities: []
      }));

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: mockLocations,
        total: 20,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        limit: 5
      });

      expect(result.results).toHaveLength(5);
      expect(result.totalMatches).toBe(20);
    });

    it('should handle natural language query extraction', async () => {
      const mockLocation: ILocation = {
        id: 6001,
        name: 'Executive Desk',
        kind: 'DESK',
        facilities: [
          { id: '1', name: 'Adjustable Desk', category: 'furniture' }
        ]
      };

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [mockLocation],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchLocationsByRequirements({
        query: 'I need a desk with an adjustable desk and a screen'
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.location.id).toBe(6001);
    });
  });

  describe('searchByQuery', () => {
    it('should parse room requirements from query', async () => {
      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [{
          id: 7001,
          name: 'Conference Room',
          kind: 'ROOM',
          capacity: 10,
          facilities: []
        }],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchByQuery('find me a room for 5 people');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.location.kind).toBe('ROOM');
    });

    it('should parse desk requirements from query', async () => {
      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [{
          id: 8001,
          name: 'Desk 42-D',
          kind: 'DESK',
          facilities: []
        }],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchByQuery('I need a desk with adjustable height');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.location.kind).toBe('DESK');
    });

    it('should extract time requirements for "now"', async () => {
      const mockLocation: ILocation = {
        id: 9001,
        name: 'Room 101',
        kind: 'ROOM',
        facilities: []
      };

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [mockLocation],
        total: 1,
        hierarchy: {}
      });

      const beforeCall = new Date();
      await searchService.searchByQuery('find me a room now for 2 hours');
      const afterCall = new Date();

      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalled();
      const callArgs = vi.mocked(mockAvailabilityService.checkAvailability).mock.calls[0]?.[0];
      
      const dateFrom = new Date(callArgs?.dateFrom || '');
      const dateTo = new Date(callArgs?.dateTo || '');
      
      // Check that dateFrom is close to current time
      expect(dateFrom.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(dateFrom.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      
      // Check that duration is 2 hours
      const durationHours = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60);
      expect(durationHours).toBeCloseTo(2, 1);
    });

    it('should extract facility requirements from query', async () => {
      const mockLocation: ILocation = {
        id: 10001,
        name: 'Premium Room',
        kind: 'ROOM',
        facilities: [
          { id: '1', name: 'Video Conference', category: 'technology' },
          { id: '2', name: 'Whiteboard', category: 'furniture' }
        ]
      };

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: [mockLocation],
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.searchByQuery(
        'find a room with video conference and whiteboard'
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.facilityInfo?.hasVideoConference).toBe(true);
      expect(result.results[0]?.facilityInfo?.hasWhiteboard).toBe(true);
    });
  });

  describe('findLocationsWithFacilities', () => {
    it('should return locations matching facilities', async () => {
      const mockLocations: ILocation[] = [
        {
          id: 11001,
          name: 'Tech Desk',
          kind: 'DESK',
          facilities: [
            { id: '1', name: '34" Screen', category: 'technology' },
            { id: '2', name: 'Adjustable Desk', category: 'furniture' }
          ]
        }
      ];

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: mockLocations,
        total: 1,
        hierarchy: {}
      });

      const result = await searchService.findLocationsWithFacilities(['screen', 'adjustable']);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(11001);
    });

    it('should limit to 20 results by default', async () => {
      const mockLocations = Array.from({ length: 30 }, (_, i) => ({
        id: 12000 + i,
        name: `Location ${i}`,
        kind: 'DESK',
        facilities: [{ id: `${i}`, name: 'Screen', category: 'technology' }]
      }));

      vi.mocked(mockLocationService.getLocationHierarchy).mockResolvedValue({
        locations: mockLocations,
        total: 30,
        hierarchy: {}
      });

      const result = await searchService.findLocationsWithFacilities(['screen']);

      expect(result).toHaveLength(20);
    });
  });
});