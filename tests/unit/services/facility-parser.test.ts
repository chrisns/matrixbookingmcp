import { describe, it, expect, beforeEach } from 'vitest';
import { FacilityParser } from '../../../src/services/facility-parser.js';
import { IFacility } from '../../../src/types/facility.types.js';

describe('FacilityParser', () => {
  let parser: FacilityParser;

  beforeEach(() => {
    parser = new FacilityParser();
  });

  describe('parseFacility', () => {
    it('should parse screen facilities', () => {
      const facility: IFacility = {
        id: '123',
        name: '34" Screen',
        category: 'technology'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('screen');
      expect(result.category).toBe('technology');
      expect(result.attributes.size).toBe(34);
      expect(result.attributes.hasScreen).toBe(true);
    });

    it('should parse adjustable desk facilities', () => {
      const facility: IFacility = {
        id: '456',
        name: 'Adjustable Desk - Mechanical',
        category: 'furniture'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('desk');
      expect(result.category).toBe('furniture');
      expect(result.attributes.adjustable).toBe(true);
      expect(result.attributes.mechanism).toBe('mechanical');
      expect(result.attributes.hasDesk).toBe(true);
    });

    it('should parse electric standing desk', () => {
      const facility: IFacility = {
        id: '789',
        name: 'Electric Standing Desk',
        category: 'furniture'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('desk');
      expect(result.attributes.adjustable).toBe(true);
      expect(result.attributes.mechanism).toBe('electric');
    });

    it('should parse video conference equipment', () => {
      const facility: IFacility = {
        id: '101',
        name: 'Video Conference System',
        category: 'technology'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('video_conference');
      expect(result.attributes.hasVideoConference).toBe(true);
    });

    it('should parse whiteboard', () => {
      const facility: IFacility = {
        id: '102',
        name: 'Large Whiteboard',
        category: 'furniture'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('whiteboard');
      expect(result.attributes.hasWhiteboard).toBe(true);
    });

    it('should parse accessibility features', () => {
      const facility: IFacility = {
        id: '103',
        name: 'Wheelchair Accessible',
        category: 'accessibility'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('accessibility');
      expect(result.attributes.isAccessible).toBe(true);
    });

    it('should parse air conditioning', () => {
      const facility: IFacility = {
        id: '104',
        name: 'Air Conditioning',
        category: 'comfort'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('climate_control');
      expect(result.attributes.hasAirConditioning).toBe(true);
    });

    it('should parse WiFi', () => {
      const facility: IFacility = {
        id: '105',
        name: 'High-Speed WiFi',
        category: 'connectivity'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('network');
      expect(result.attributes.hasWifi).toBe(true);
    });

    it('should handle unknown facilities', () => {
      const facility: IFacility = {
        id: '999',
        name: 'Some Random Feature',
        category: 'other'
      };

      const result = parser.parseFacility(facility);
      
      expect(result.type).toBe('other');
      expect(result.category).toBe('other');
      expect(result.attributes.text).toBe('Some Random Feature');
    });
  });

  describe('parseFacilities', () => {
    it('should aggregate multiple facilities', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '27" Screen', category: 'technology' },
        { id: '2', name: 'Adjustable Desk - Electric', category: 'furniture' },
        { id: '3', name: 'WiFi', category: 'connectivity' }
      ];

      const result = parser.parseFacilities(facilities);
      
      expect(result.parsed).toHaveLength(3);
      expect(result.aggregated.hasScreen).toBe(true);
      expect(result.aggregated.screenSize).toBe(27);
      expect(result.aggregated.adjustable).toBe(true);
      expect(result.aggregated.mechanism).toBe('electric');
      expect(result.aggregated.hasWifi).toBe(true);
    });

    it('should take largest screen size when multiple screens', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '27" Screen', category: 'technology' },
        { id: '2', name: '34" Screen', category: 'technology' }
      ];

      const result = parser.parseFacilities(facilities);
      
      expect(result.aggregated['screenSize']).toBe(34);
    });
  });

  describe('matchesRequirements', () => {
    it('should match adjustable desk requirement', () => {
      const facilities: IFacility[] = [
        { id: '1', name: 'Adjustable Desk - Mechanical', category: 'furniture' }
      ];
      const requirements = ['adjustable desk'];

      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.details).toContain('✓ Has adjustable desk (mechanical mechanism)');
    });

    it('should match screen size requirement', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '34" Screen', category: 'technology' }
      ];
      const requirements = ['27 inch screen'];

      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.details).toContain('✓ Has 34" screen (meets 27" requirement)');
    });

    it('should not match insufficient screen size', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '24" Screen', category: 'technology' }
      ];
      const requirements = ['27 inch screen'];

      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain('✗ Has 24" screen (below 27" requirement)');
    });

    it('should match multiple requirements', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '27" Screen', category: 'technology' },
        { id: '2', name: 'Adjustable Desk', category: 'furniture' },
        { id: '3', name: 'WiFi', category: 'connectivity' }
      ];
      const requirements = ['screen', 'adjustable', 'wifi'];

      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.details.filter(d => d.startsWith('✓'))).toHaveLength(3);
    });

    it('should handle partial matches', () => {
      const facilities: IFacility[] = [
        { id: '1', name: '27" Screen', category: 'technology' }
      ];
      const requirements = ['screen', 'adjustable desk'];

      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0.5);
      expect(result.details).toContain('✓ Has screen (27" size)');
      expect(result.details).toContain('✗ Missing: adjustable desk');
    });
  });

  describe('extractRequirements', () => {
    it('should extract screen requirements', () => {
      const query = 'I need a desk with a 34 inch screen';
      const result = parser.extractRequirements(query);
      
      expect(result).toContain('34" screen');
    });

    it('should extract adjustable desk requirement', () => {
      const query = 'Find me an adjustable desk for tomorrow';
      const result = parser.extractRequirements(query);
      
      expect(result).toContain('adjustable desk');
    });

    it('should extract multiple requirements', () => {
      const query = 'I need a room with video conference, whiteboard, and wifi';
      const result = parser.extractRequirements(query);
      
      expect(result).toContain('video conference');
      expect(result).toContain('whiteboard');
      expect(result).toContain('wifi');
    });

    it('should handle standing desk variations', () => {
      const query = 'Find a standing desk or sit-stand desk';
      const result = parser.extractRequirements(query);
      
      expect(result).toContain('adjustable desk');
    });

    it('should extract accessibility requirements', () => {
      const query = 'I need a wheelchair accessible room';
      const result = parser.extractRequirements(query);
      
      expect(result).toContain('accessible');
    });
  });

  describe('extractCapacity', () => {
    it('should extract capacity from "X people" pattern', () => {
      expect(parser.extractCapacity('room for 5 people')).toBe(5);
      expect(parser.extractCapacity('space for 10 people')).toBe(10);
    });

    it('should extract capacity from "capacity X" pattern', () => {
      expect(parser.extractCapacity('room with capacity 8')).toBe(8);
      expect(parser.extractCapacity('capacity of 12')).toBe(12);
    });

    it('should extract capacity from "X seats" pattern', () => {
      expect(parser.extractCapacity('room with 6 seats')).toBe(6);
      expect(parser.extractCapacity('needs to seat 15')).toBe(15);
    });

    it('should extract capacity from "for X" pattern', () => {
      expect(parser.extractCapacity('meeting room for 8')).toBe(8);
    });

    it('should return null when no capacity mentioned', () => {
      expect(parser.extractCapacity('find me a desk')).toBeNull();
      expect(parser.extractCapacity('room with screen')).toBeNull();
    });

    it('should handle single person', () => {
      expect(parser.extractCapacity('room for 1 person')).toBe(1);
    });
  });
});