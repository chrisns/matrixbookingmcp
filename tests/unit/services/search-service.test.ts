import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../../src/services/search-service.js';
import { ILocationService } from '../../../src/types/location.types.js';
import { IAvailabilityService } from '../../../src/types/availability.types.js';
import { ILocationSearchRequest } from '../../../src/types/search.types.js';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockLocationService: ILocationService;
  let mockAvailabilityService: IAvailabilityService;
  
  beforeEach(() => {
    mockLocationService = {
      getLocationDetails: vi.fn(),
      getLocationHierarchy: vi.fn(),
      searchLocations: vi.fn(),
      getLocationById: vi.fn(),
      validateLocationId: vi.fn(),
      getLocationChildren: vi.fn(),
      getLocation: vi.fn(),
      getPreferredLocation: vi.fn(),
      getLocationsByKind: vi.fn()
    } as ILocationService;
    
    mockAvailabilityService = {
      checkAvailability: vi.fn(),
      getAvailableSlots: vi.fn(),
      checkMultipleAvailability: vi.fn(),
      formatAvailabilityRequest: vi.fn()
    } as IAvailabilityService;
    
    searchService = new SearchService(mockLocationService, mockAvailabilityService);
  });
  
  describe('searchLocationsByRequirements', () => {
    it('should search locations with facility requirements', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            qualifiedName: 'Building/Floor 7/Room 701',
            kind: 'ROOM',
            capacity: 10,
            facilities: [
              { id: '1', text: 'Screen', name: 'Screen' },
              { id: '2', text: 'Whiteboard', name: 'Whiteboard' }
            ]
          },
          {
            id: 2,
            name: 'Desk 37-A',
            qualifiedName: 'Building/Floor 3/Zone A/Desk 37-A',
            kind: 'DESK',
            facilities: [
              { id: '3', text: 'Adjustable desk', name: 'Adjustable desk' },
              { id: '4', text: 'Dual screen', name: 'Dual screen' }
            ]
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        requirements: ['screen'],
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results).toHaveLength(2);
      expect(response.results![0]!.location.name).toBe('Room 701');
      expect(response.results![0]!.facilityInfo?.matchedFacilities).toContain('Screen');
      expect(response.results![1]!.location.name).toBe('Desk 37-A');
      expect(response.results![1]!.facilityInfo?.matchedFacilities).toContain('Dual screen');
      expect(response.totalMatches).toBe(2);
    });
    
    it('should filter by location kind', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: []
          },
          {
            id: 2,
            name: 'Desk 37-A',
            kind: 'DESK',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        locationKind: 'ROOM',
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.location.kind).toBe('ROOM');
      expect(response.metadata.appliedFilters).toContain('kind:ROOM');
    });
    
    it('should filter by capacity', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Small Room',
            kind: 'ROOM',
            capacity: 4,
            facilities: []
          },
          {
            id: 2,
            name: 'Large Room',
            kind: 'ROOM',
            capacity: 20,
            facilities: []
          },
          {
            id: 3,
            name: 'Desk',
            kind: 'DESK',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        capacity: 10,
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.location.name).toBe('Large Room');
      expect(response.metadata.appliedFilters).toContain('capacity>=10');
    });
    
    it('should check availability when dates provided', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({
        available: [
          { timeFrom: '2024-01-01T09:00:00', timeTo: '2024-01-01T10:00:00' }
        ]
      } as any);
      
      const request: ILocationSearchRequest = {
        dateFrom: '2024-01-01T09:00:00',
        dateTo: '2024-01-01T10:00:00',
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalledWith({
        locationId: 1,
        dateFrom: '2024-01-01T09:00:00',
        dateTo: '2024-01-01T10:00:00',
        bookingCategory: 9000002
      });
      
      expect(response.results![0]!.availability?.isAvailable).toBe(true);
      expect(response.results![0]!.availability?.availableSlots).toHaveLength(1);
      expect(response.results![0]!.matchDetails).toContain('✓ Available at requested time');
    });
    
    it('should handle unavailable locations', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({
        available: []
      } as any);
      
      const request: ILocationSearchRequest = {
        dateFrom: '2024-01-01T09:00:00',
        dateTo: '2024-01-01T10:00:00',
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results![0]!.availability?.isAvailable).toBe(false);
      expect(response.results![0]!.matchDetails).toContain('✗ Not available at requested time');
      expect(response.results![0]!.score).toBeLessThan(1);
    });
    
    it('should handle availability check failures gracefully', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockRejectedValue(new Error('API Error'));
      
      const request: ILocationSearchRequest = {
        dateFrom: '2024-01-01T09:00:00',
        dateTo: '2024-01-01T10:00:00',
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results![0]!.availability).toBeUndefined();
      expect(response.results![0]!.matchDetails).toContain('⚠ Could not check availability');
    });
    
    it('should apply limit to results', async () => {
      const mockHierarchy = {
        locations: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          name: `Location ${i + 1}`,
          kind: 'ROOM',
          facilities: []
        }))
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        limit: 5
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results).toHaveLength(5);
      expect(response.totalMatches).toBe(20);
    });
    
    it('should extract requirements from natural language query', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room with Screen',
            kind: 'ROOM',
            capacity: 10,
            facilities: [
              { id: '1', text: 'Screen', name: 'Screen' }
            ]
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        query: 'I need a room with a screen for 10 people',
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.facilityInfo?.matchedFacilities).toContain('Screen');
    });
    
    it('should score exact capacity matches higher', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room A',
            kind: 'ROOM',
            capacity: 10,
            facilities: []
          },
          {
            id: 2,
            name: 'Room B',
            kind: 'ROOM',
            capacity: 20,
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const request: ILocationSearchRequest = {
        capacity: 10,
        limit: 10
      };
      
      const response = await searchService.searchLocationsByRequirements(request);
      
      expect(response.results![0]!.location.name).toBe('Room A');
      expect(response.results![0]!.score).toBeGreaterThan(response.results![1]!.score);
      expect(response.results![0]!.matchDetails).toContain('🎯 Perfect capacity match (10)');
    });
  });
  
  describe('searchByQuery', () => {
    const setupMockHierarchy = () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            capacity: 10,
            facilities: [
              { id: '1', text: 'Screen', name: 'Screen' }
            ]
          },
          {
            id: 2,
            name: 'Desk 37-A',
            kind: 'DESK',
            facilities: [
              { id: '2', text: 'Adjustable desk', name: 'Adjustable desk' }
            ]
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
    };
    
    it('should parse room queries', async () => {
      setupMockHierarchy();
      const response = await searchService.searchByQuery('I need a room with a screen');
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.location.kind).toBe('ROOM');
      expect(response.results![0]!.facilityInfo?.matchedFacilities).toContain('Screen');
    });
    
    it('should parse desk queries', async () => {
      setupMockHierarchy();
      const response = await searchService.searchByQuery('Book me an adjustable desk');
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.location.kind).toBe('DESK');
      expect(response.results![0]!.facilityInfo?.matchedFacilities).toContain('Adjustable desk');
    });
    
    it('should parse capacity from query', async () => {
      setupMockHierarchy();
      const response = await searchService.searchByQuery('Room for 5 people');
      
      expect(response.results).toHaveLength(1);
      expect(response.results![0]!.location.kind).toBe('ROOM');
    });
    
    it('should parse "now" time references', async () => {
      setupMockHierarchy();
      const now = new Date('2024-01-01T10:00:00');
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
      
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({
        available: [{ timeFrom: now.toISOString(), timeTo: new Date(now.getTime() + 3600000).toISOString() }]
      } as any);
      
      await searchService.searchByQuery('Book a room now for 2 hours');
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalled();
      const callArgs = (mockAvailabilityService.checkAvailability as any).mock.calls[0][0];
      expect(callArgs.dateFrom).toBeDefined();
      expect(callArgs.dateTo).toBeDefined();
      
      const from = new Date(callArgs.dateFrom);
      const to = new Date(callArgs.dateTo);
      const duration = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60));
      expect(duration).toBe(2);
      
      nowSpy.mockRestore();
    });
    
    it('should parse "tomorrow" time references', async () => {
      setupMockHierarchy();
      const today = new Date('2024-01-01T10:00:00');
      vi.spyOn(global, 'Date').mockImplementation(() => today as any);
      
      await searchService.searchByQuery('Book a room for tomorrow');
      
      const expectedTomorrow = new Date('2024-01-02T09:00:00');
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalled();
      const callArgs = (mockAvailabilityService.checkAvailability as any).mock.calls[0][0];
      expect(new Date(callArgs.dateFrom).toISOString()).toBe(expectedTomorrow.toISOString());
    });
    
    it.skip('should handle queries without special requirements', async () => {
      setupMockHierarchy();
      const response = await searchService.searchByQuery('Find me a space');
      
      expect(response.results).toHaveLength(2);
      expect(response.totalMatches).toBe(2);
    });
  });
  
  describe('findLocationsWithFacilities', () => {
    it('should find locations with specified facilities', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: [
              { id: '1', text: 'Screen', name: 'Screen' },
              { id: '2', text: 'Whiteboard', name: 'Whiteboard' }
            ]
          },
          {
            id: 2,
            name: 'Room 702',
            kind: 'ROOM',
            facilities: [
              { id: '3', text: 'Projector', name: 'Projector' }
            ]
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const locations = await searchService.findLocationsWithFacilities(['screen', 'whiteboard']);
      
      expect(locations).toHaveLength(1);
      expect(locations[0]!.name).toBe('Room 701');
    });
    
    it('should return empty array when no locations match', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room 701',
            kind: 'ROOM',
            facilities: [
              { id: '1', text: 'Screen', name: 'Screen' }
            ]
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      
      const locations = await searchService.findLocationsWithFacilities(['pool table', 'jacuzzi']);
      
      expect(locations).toHaveLength(0);
    });
  });
  
  describe('getBookingCategory', () => {
    it('should return correct category for rooms', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Room',
            kind: 'ROOM',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({ available: [] } as any);
      
      await searchService.searchLocationsByRequirements({
        locationKind: 'ROOM',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01'
      });
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalledWith(
        expect.objectContaining({ bookingCategory: 9000002 })
      );
    });
    
    it('should return correct category for desks', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Desk',
            kind: 'DESK',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({ available: [] } as any);
      
      await searchService.searchLocationsByRequirements({
        locationKind: 'DESK',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01'
      });
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalledWith(
        expect.objectContaining({ bookingCategory: 9000001 })
      );
    });
    
    it('should return correct category for desk banks', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Desk Bank',
            kind: 'DESK_BANK',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({ available: [] } as any);
      
      await searchService.searchLocationsByRequirements({
        locationKind: 'DESK_BANK',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01'
      });
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalledWith(
        expect.objectContaining({ bookingCategory: 9000001 })
      );
    });
    
    it('should default to desk category for unknown types', async () => {
      const mockHierarchy = {
        locations: [
          {
            id: 1,
            name: 'Unknown',
            kind: 'UNKNOWN',
            facilities: []
          }
        ]
      };
      
      (mockLocationService.getLocationHierarchy as any).mockResolvedValue(mockHierarchy);
      (mockAvailabilityService.checkAvailability as any).mockResolvedValue({ available: [] } as any);
      
      await searchService.searchLocationsByRequirements({
        dateFrom: '2024-01-01',
        dateTo: '2024-01-01'
      });
      
      expect((mockAvailabilityService.checkAvailability as any)).toHaveBeenCalledWith(
        expect.objectContaining({ bookingCategory: 9000001 })
      );
    });
  });
});