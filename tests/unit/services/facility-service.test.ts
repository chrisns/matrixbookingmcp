import { describe, it, expect, beforeEach } from 'vitest';
import { FacilityService } from '../../../src/services/facility-service.js';
import { IFacility } from '../../../src/types/facility.types.js';

describe('FacilityService', () => {
  let service: FacilityService;

  beforeEach(() => {
    service = new FacilityService();
  });

  describe('parseFacilities', () => {
    it('should parse empty string', () => {
      const result = service.parseFacilities('');
      expect(result).toEqual([]);
    });

    it('should parse single facility', () => {
      const result = service.parseFacilities('Conference Phone');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conference_phone',
        name: 'Conference Phone',
        category: 'audio_visual',
        parsed: {
          type: 'Conference Phone'
        }
      });
    });

    it('should parse multiple facilities separated by commas', () => {
      const result = service.parseFacilities('TV, Projector, Whiteboard');
      
      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('TV');
      expect(result[1]?.name).toBe('Projector');
      expect(result[2]?.name).toBe('Whiteboard');
    });

    it('should parse facilities with different separators', () => {
      const result = service.parseFacilities('TV; 27" Monitor | Wireless Presentation');
      
      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('TV');
      expect(result[1]?.name).toBe('27" Monitor');
      expect(result[2]?.name).toBe('Wireless Presentation');
    });

    it('should extract size information from screen descriptions', () => {
      const result = service.parseFacilities('55" TV, 27" Monitor');
      
      expect(result).toHaveLength(2);
      expect(result[0]?.parsed?.size).toBe('55"');
      expect(result[1]?.parsed?.size).toBe('27"');
    });

    it('should categorize audio/visual equipment correctly', () => {
      const result = service.parseFacilities('Conference Phone, TV, Projector, Speakers');
      
      result.forEach(facility => {
        expect(facility.category).toBe('audio_visual');
      });
    });

    it('should categorize furniture correctly', () => {
      const result = service.parseFacilities('Adjustable Desk, Ergonomic Chair');
      
      result.forEach(facility => {
        expect(facility.category).toBe('furniture');
      });
    });

    it('should categorize technology correctly', () => {
      const result = service.parseFacilities('Video Camera, Streaming Equipment');
      
      result.forEach(facility => {
        expect(facility.category).toBe('technology');
      });
    });

    it('should categorize connectivity correctly', () => {
      const result = service.parseFacilities('WiFi, Ethernet Cable');
      
      result.forEach(facility => {
        expect(facility.category).toBe('connectivity');
      });
    });

    it('should extract features correctly', () => {
      const result = service.parseFacilities('4K Wireless TV, Touch Screen Monitor');
      
      expect(result[0]?.parsed?.features).toContain('4K');
      expect(result[0]?.parsed?.features).toContain('Wireless');
      expect(result[1]?.parsed?.features).toContain('Touch');
    });
  });

  describe('searchByFacilities', () => {
    const mockLocations = [
      {
        location: {
          id: 1,
          name: 'Room A',
          facilities: [
            { id: 'tv', name: 'TV', category: 'audio_visual' },
            { id: 'phone', name: 'Conference Phone', category: 'audio_visual' }
          ]
        }
      },
      {
        location: {
          id: 2,
          name: 'Room B',
          facilities: [
            { id: 'projector', name: 'Projector', category: 'audio_visual' }
          ]
        }
      },
      {
        location: {
          id: 3,
          name: 'Room C',
          facilities: []
        }
      }
    ];

    it('should find locations with required facilities', () => {
      const result = service.searchByFacilities(['TV'], mockLocations);
      
      expect(result).toHaveLength(1);
      expect((result[0] as any).location.name).toBe('Room A');
    });

    it('should find locations with multiple required facilities', () => {
      const result = service.searchByFacilities(['TV', 'Conference Phone'], mockLocations);
      
      expect(result).toHaveLength(1);
      expect((result[0] as any).location.name).toBe('Room A');
    });

    it('should return empty array when no locations match', () => {
      const result = service.searchByFacilities(['Whiteboard'], mockLocations);
      
      expect(result).toHaveLength(0);
    });

    it('should handle partial facility name matches', () => {
      const result = service.searchByFacilities(['phone'], mockLocations);
      
      expect(result).toHaveLength(1);
      expect((result[0] as any).location.name).toBe('Room A');
    });

    it('should handle category matches', () => {
      const result = service.searchByFacilities(['audio_visual'], mockLocations);
      
      expect(result).toHaveLength(2);
      expect(result.map(r => (r as any).location.name)).toContain('Room A');
      expect(result.map(r => (r as any).location.name)).toContain('Room B');
    });
  });

  describe('matchesFacilityRequirement', () => {
    const mockFacility: IFacility = {
      id: 'conference_phone',
      name: 'Conference Phone',
      category: 'audio_visual',
      parsed: {
        type: 'Conference Phone',
        features: ['Wireless', '4K']
      }
    };

    it('should match exact facility names', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'Conference Phone');
      expect(result).toBe(true);
    });

    it('should match partial facility names', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'phone');
      expect(result).toBe(true);
    });

    it('should match by category', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'audio_visual');
      expect(result).toBe(true);
    });

    it('should match by parsed type', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'conference');
      expect(result).toBe(true);
    });

    it('should match by features', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'wireless');
      expect(result).toBe(true);
    });

    it('should not match unrelated requirements', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'projector');
      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const result = service['matchesFacilityRequirement'](mockFacility, 'CONFERENCE PHONE');
      expect(result).toBe(true);
    });
  });

  describe('generateFacilityId', () => {
    it('should generate lowercase ID with underscores', () => {
      const result = service['generateFacilityId']('Conference Phone 55"');
      expect(result).toBe('conference_phone_55');
    });

    it('should remove special characters', () => {
      const result = service['generateFacilityId']('4K TV @ $500');
      expect(result).toBe('4k_tv_500');
    });

    it('should truncate long names', () => {
      const longName = 'A'.repeat(100);
      const result = service['generateFacilityId'](longName);
      expect(result).toHaveLength(50);
    });
  });

  describe('determineFacilityCategory', () => {
    it('should categorize TV as audio_visual', () => {
      const result = service['determineFacilityCategory']('55" TV');
      expect(result).toBe('audio_visual');
    });

    it('should categorize projector as audio_visual', () => {
      const result = service['determineFacilityCategory']('Projector');
      expect(result).toBe('audio_visual');
    });

    it('should categorize conference phone as audio_visual', () => {
      const result = service['determineFacilityCategory']('Conference Phone');
      expect(result).toBe('audio_visual');
    });

    it('should categorize camera as technology', () => {
      const result = service['determineFacilityCategory']('Video Camera');
      expect(result).toBe('technology');
    });

    it('should categorize chairs as furniture', () => {
      const result = service['determineFacilityCategory']('Ergonomic Chair');
      expect(result).toBe('furniture');
    });

    it('should categorize networking as connectivity', () => {
      const result = service['determineFacilityCategory']('WiFi Network');
      expect(result).toBe('connectivity');
    });

    it('should categorize accessibility features correctly', () => {
      const result = service['determineFacilityCategory']('Wheelchair Accessible');
      expect(result).toBe('accessibility');
    });

    it('should categorize catering as catering', () => {
      const result = service['determineFacilityCategory']('Coffee Machine');
      expect(result).toBe('catering');
    });

    it('should categorize climate control as comfort', () => {
      const result = service['determineFacilityCategory']('Air Conditioning');
      expect(result).toBe('comfort');
    });

    it('should default to technology for unknown items', () => {
      const result = service['determineFacilityCategory']('Mystery Device');
      expect(result).toBe('technology');
    });
  });

  describe('extractFacilityMetadata', () => {
    it('should extract screen size', () => {
      const result = service['extractFacilityMetadata']('55" TV');
      
      expect(result.size).toBe('55"');
      expect(result.type).toBe('TV');
    });

    it('should extract monitor size', () => {
      const result = service['extractFacilityMetadata']('27" Monitor');
      
      expect(result.size).toBe('27"');
      expect(result.type).toBe('Monitor');
    });

    it('should extract adjustable feature', () => {
      const result = service['extractFacilityMetadata']('Adjustable Desk');
      
      expect(result.features).toContain('Adjustable');
    });

    it('should extract multiple features', () => {
      const result = service['extractFacilityMetadata']('4K Wireless Touch Screen');
      
      expect(result.features).toContain('4K');
      expect(result.features).toContain('Wireless');
      expect(result.features).toContain('Touch');
    });

    it('should handle text without special features', () => {
      const result = service['extractFacilityMetadata']('Basic Chair');
      
      expect(result.type).toBe('Basic Chair');
      expect(result.features).toEqual([]);
    });
  });

  describe('getFacilitiesByCategory', () => {
    it('should return empty array for now', () => {
      const result = service.getFacilitiesByCategory('audio_visual');
      expect(result).toEqual([]);
    });
  });
});