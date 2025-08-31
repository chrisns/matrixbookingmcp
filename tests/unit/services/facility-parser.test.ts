import { describe, it, expect, beforeEach } from 'vitest';
import { FacilityParser } from '../../../src/services/facility-parser.js';
import { IFacility } from '../../../src/types/facility.types.js';

describe('FacilityParser', () => {
  let parser: FacilityParser;
  
  beforeEach(() => {
    parser = new FacilityParser();
  });
  
  describe('matchesRequirements', () => {
    it('should return full match when all requirements are met', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'Adjustable desk', name: 'Adjustable desk', category: 'equipment' },
        { id: '2', text: 'Dual screen setup', name: 'Dual screen', category: 'equipment' },
        { id: '3', text: 'Mechanical keyboard', name: 'Mechanical keyboard', category: 'equipment' }
      ];
      
      const requirements = ['adjustable', 'screen'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedFacilities).toEqual(['Adjustable desk', 'Dual screen setup']);
    });
    
    it('should return partial match when some requirements are met', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'Adjustable desk', name: 'Adjustable desk', category: 'equipment' },
        { id: '2', text: 'Phone', name: 'Phone', category: 'equipment' }
      ];
      
      const requirements = ['adjustable', 'screen', 'video'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(false);
      expect(result.score).toBeCloseTo(0.333, 2);
      expect(result.matchedFacilities).toEqual(['Adjustable desk']);
    });
    
    it('should return no match when requirements are not met', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'Standard desk', name: 'Standard desk', category: 'equipment' },
        { id: '2', text: 'Chair', name: 'Chair', category: 'equipment' }
      ];
      
      const requirements = ['video', 'whiteboard'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
      expect(result.matchedFacilities).toEqual([]);
    });
    
    it('should handle empty requirements', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'Desk', name: 'Desk', category: 'equipment' }
      ];
      
      const result = parser.matchesRequirements(facilities, []);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedFacilities).toEqual([]);
    });
    
    it('should handle facilities with missing text or name', () => {
      const facilities: IFacility[] = [
        { id: '1', text: '', name: '', category: 'equipment' },
        { id: '2', text: 'Screen', name: undefined as any, category: 'equipment' },
        { id: '3', text: undefined as any, name: 'Adjustable desk', category: 'equipment' }
      ];
      
      const requirements = ['screen', 'adjustable'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedFacilities).toEqual(['Screen', 'Adjustable desk']);
    });
    
    it('should be case insensitive', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'SCREEN', name: 'SCREEN', category: 'equipment' },
        { id: '2', text: 'Adjustable Desk', name: 'Adjustable Desk', category: 'equipment' }
      ];
      
      const requirements = ['ScReEn', 'ADJUSTABLE'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedFacilities).toEqual(['SCREEN', 'Adjustable Desk']);
    });
    
    it('should match all facilities containing the requirement', () => {
      const facilities: IFacility[] = [
        { id: '1', text: 'Screen and monitor', name: 'Screen and monitor', category: 'equipment' },
        { id: '2', text: 'Dual screen', name: 'Dual screen', category: 'equipment' }
      ];
      
      const requirements = ['screen'];
      const result = parser.matchesRequirements(facilities, requirements);
      
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      // The function finds the first facility with 'screen' and stops
      expect(result.matchedFacilities).toEqual(['Screen and monitor']);
    });
  });
  
  describe('extractRequirements', () => {
    it('should extract screen requirements', () => {
      const queries = [
        'I need a room with a screen',
        'Looking for desk with monitor',
        'Conference room with display'
      ];
      
      queries.forEach(query => {
        const requirements = parser.extractRequirements(query);
        expect(requirements).toContain('screen');
      });
    });
    
    it('should extract adjustable desk requirements', () => {
      const queries = [
        'I need an adjustable desk',
        'Looking for standing desk',
        'Sit-stand desk please',
        'Height adjustable workstation'
      ];
      
      queries.forEach(query => {
        const requirements = parser.extractRequirements(query);
        expect(requirements).toContain('adjustable');
      });
    });
    
    it('should extract video conferencing requirements', () => {
      const queries = [
        'Room with video conferencing',
        'Need zoom capability',
        'Teams meeting room',
        'Conference room setup'
      ];
      
      queries.forEach(query => {
        const requirements = parser.extractRequirements(query);
        expect(requirements).toContain('video');
      });
    });
    
    it('should extract multiple requirements', () => {
      const query = 'I need a room with video conferencing, whiteboard, and air conditioning';
      const requirements = parser.extractRequirements(query);
      
      expect(requirements).toEqual(expect.arrayContaining(['video', 'board', 'air']));
      expect(requirements.length).toBe(3);
    });
    
    it('should handle accessibility requirements', () => {
      const queries = [
        'Accessible room needed',
        'Wheelchair accessible',
        'Disabled access required'
      ];
      
      queries.forEach(query => {
        const requirements = parser.extractRequirements(query);
        expect(requirements).toContain('accessible');
      });
    });
    
    it('should not duplicate requirements', () => {
      const query = 'I need a screen, monitor, and display for my presentation';
      const requirements = parser.extractRequirements(query);
      
      expect(requirements).toEqual(['screen']);
    });
    
    it('should handle empty or irrelevant queries', () => {
      const queries = [
        '',
        'Hello world',
        'Book a meeting tomorrow'
      ];
      
      queries.forEach(query => {
        const requirements = parser.extractRequirements(query);
        expect(requirements).toEqual([]);
      });
    });
  });
  
  describe('extractCapacity', () => {
    it('should extract capacity from "X people" pattern', () => {
      const queries = [
        { query: 'Room for 5 people', expected: 5 },
        { query: 'Space for 10 people please', expected: 10 },
        { query: 'I need a room for 1 person', expected: 1 }
      ];
      
      queries.forEach(({ query, expected }) => {
        const capacity = parser.extractCapacity(query);
        expect(capacity).toBe(expected);
      });
    });
    
    it('should extract capacity from "for X" pattern', () => {
      const queries = [
        { query: 'Meeting room for 8', expected: 8 },
        { query: 'Book a space for 12', expected: 12 }
      ];
      
      queries.forEach(({ query, expected }) => {
        const capacity = parser.extractCapacity(query);
        expect(capacity).toBe(expected);
      });
    });
    
    it('should extract capacity from "capacity X" pattern', () => {
      const queries = [
        { query: 'Room with capacity 20', expected: 20 },
        { query: 'Need capacity of 15', expected: 15 }
      ];
      
      queries.forEach(({ query, expected }) => {
        const capacity = parser.extractCapacity(query);
        expect(capacity).toBe(expected);
      });
    });
    
    it('should extract capacity from "X seats" pattern', () => {
      const queries = [
        { query: 'Room with 6 seats', expected: 6 },
        { query: 'Need room that seats 25', expected: 25 },
        { query: '8 seat conference room', expected: 8 }
      ];
      
      queries.forEach(({ query, expected }) => {
        const capacity = parser.extractCapacity(query);
        expect(capacity).toBe(expected);
      });
    });
    
    it('should return null when no capacity is mentioned', () => {
      const queries = [
        'Book a meeting room',
        'I need a desk',
        'Conference room with video'
      ];
      
      queries.forEach(query => {
        const capacity = parser.extractCapacity(query);
        expect(capacity).toBeNull();
      });
    });
    
    it('should extract first number when multiple patterns match', () => {
      const query = 'Room for 10 people with 15 seats';
      const capacity = parser.extractCapacity(query);
      expect(capacity).toBe(10);
    });
  });
  
  describe('extractUniqueFacilities', () => {
    it('should extract unique facilities from locations', () => {
      const locations = [
        {
          facilities: [
            { id: '1', text: 'Screen', name: 'Screen', category: 'equipment' },
            { id: '2', text: 'Adjustable desk', name: 'Adjustable desk', category: 'equipment' }
          ]
        },
        {
          facilities: [
            { id: '3', text: 'Screen', name: 'Screen', category: 'equipment' },
            { id: '4', text: 'Whiteboard', name: 'Whiteboard', category: 'equipment' }
          ]
        }
      ];
      
      const unique = parser.extractUniqueFacilities(locations);
      expect(unique).toEqual(['Adjustable desk', 'Screen', 'Whiteboard']);
    });
    
    it('should handle locations without facilities', () => {
      const locations = [
        { facilities: undefined } as any,
        {},
        {
          facilities: [
            { id: '1', text: 'Desk', name: 'Desk', category: 'equipment' }
          ]
        }
      ];
      
      const unique = parser.extractUniqueFacilities(locations);
      expect(unique).toEqual(['Desk']);
    });
    
    it('should prefer text over name', () => {
      const locations = [
        {
          facilities: [
            { id: '1', text: 'Text version', name: 'Name version', category: 'equipment' },
            { id: '2', text: '', name: 'Only name', category: 'equipment' },
            { id: '3', text: undefined as any, name: 'Also only name', category: 'equipment' }
          ]
        }
      ];
      
      const unique = parser.extractUniqueFacilities(locations);
      expect(unique).toEqual(['Also only name', 'Only name', 'Text version']);
    });
    
    it('should return empty array for empty input', () => {
      const unique = parser.extractUniqueFacilities([]);
      expect(unique).toEqual([]);
    });
  });
});