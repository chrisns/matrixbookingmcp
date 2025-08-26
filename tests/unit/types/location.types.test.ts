import { describe, it, expect } from 'vitest';
import type { ILocation, ILocationService } from '../../../src/types/location.types.js';

describe('Location Types', () => {
  describe('ILocation interface', () => {
    it('should define correct location structure', () => {
      const location: ILocation = {
        id: 123,
        name: 'Conference Room A',
        capacity: 12,
        features: ['projector', 'whiteboard', 'video conference']
      };

      expect(location).toHaveProperty('id');
      expect(location).toHaveProperty('name');
      expect(location).toHaveProperty('capacity');
      expect(location).toHaveProperty('features');
      expect(typeof location.id).toBe('number');
      expect(typeof location.name).toBe('string');
      expect(typeof location.capacity).toBe('number');
      expect(Array.isArray(location.features)).toBe(true);
    });

    it('should handle required properties only', () => {
      const minimalLocation: ILocation = {
        id: 456,
        name: 'Small Meeting Room'
      };

      expect(minimalLocation.id).toBe(456);
      expect(minimalLocation.name).toBe('Small Meeting Room');
      expect(minimalLocation.capacity).toBeUndefined();
      expect(minimalLocation.features).toBeUndefined();
    });

    it('should handle optional capacity property', () => {
      const locationWithCapacity: ILocation = {
        id: 789,
        name: 'Large Auditorium',
        capacity: 200
      };

      const locationWithoutCapacity: ILocation = {
        id: 101,
        name: 'Flexible Space'
      };

      expect(locationWithCapacity.capacity).toBe(200);
      expect(locationWithoutCapacity.capacity).toBeUndefined();
    });

    it('should handle optional features array', () => {
      const locationWithFeatures: ILocation = {
        id: 111,
        name: 'Executive Conference Room',
        features: ['leather chairs', 'executive table', 'city view', 'climate control']
      };

      const locationWithEmptyFeatures: ILocation = {
        id: 222,
        name: 'Basic Room',
        features: []
      };

      const locationWithoutFeatures: ILocation = {
        id: 333,
        name: 'Simple Room'
      };

      expect(locationWithFeatures.features).toHaveLength(4);
      expect(locationWithFeatures.features?.includes('leather chairs')).toBe(true);
      expect(locationWithEmptyFeatures.features).toHaveLength(0);
      expect(locationWithoutFeatures.features).toBeUndefined();
    });

    it('should handle various feature types', () => {
      const techLocation: ILocation = {
        id: 444,
        name: 'Tech Conference Room',
        capacity: 16,
        features: [
          'dual monitors',
          '4K projector',
          'video conference system',
          'wireless presentation',
          'high-speed internet',
          'power outlets at every seat'
        ]
      };

      const comfortLocation: ILocation = {
        id: 555,
        name: 'Comfort Meeting Room',
        capacity: 8,
        features: [
          'ergonomic chairs',
          'natural lighting',
          'plants',
          'coffee machine',
          'sound proofing'
        ]
      };

      expect(techLocation.features?.every(feature => typeof feature === 'string')).toBe(true);
      expect(comfortLocation.features?.includes('coffee machine')).toBe(true);
      expect(techLocation.features).toHaveLength(6);
      expect(comfortLocation.features).toHaveLength(5);
    });

    it('should enforce required id and name properties', () => {
      // TypeScript compilation test - these should cause type errors if uncommented
      // const invalid1: ILocation = { name: 'Test Room' }; // missing id
      // const invalid2: ILocation = { id: 123 }; // missing name
      // const invalid3: ILocation = { id: 'string', name: 'Test Room' }; // wrong id type

      const valid: ILocation = {
        id: 999,
        name: 'Valid Room'
      };

      expect(valid).toBeDefined();
      expect(typeof valid.id).toBe('number');
      expect(typeof valid.name).toBe('string');
    });
  });

  describe('ILocationService interface', () => {
    it('should define all required location service methods', async () => {
      class MockLocationService implements ILocationService {
        async getLocation(locationId: number): Promise<ILocation> {
          return {
            id: locationId,
            name: `Location ${locationId}`,
            capacity: Math.floor(Math.random() * 20) + 5,
            features: ['basic equipment']
          };
        }

        async getPreferredLocation(): Promise<ILocation> {
          return {
            id: 1,
            name: 'Preferred Conference Room',
            capacity: 12,
            features: ['projector', 'whiteboard', 'video conference']
          };
        }

        validateLocationId(locationId: number): boolean {
          return Number.isInteger(locationId) && locationId > 0 && locationId <= 1000;
        }
      }

      const service = new MockLocationService();

      expect(typeof service.getLocation).toBe('function');
      expect(typeof service.getPreferredLocation).toBe('function');
      expect(typeof service.validateLocationId).toBe('function');

      // Test method functionality
      const location = await service.getLocation(123);
      expect(location.id).toBe(123);
      expect(location.name).toBe('Location 123');
      expect(typeof location.capacity).toBe('number');

      const preferredLocation = await service.getPreferredLocation();
      expect(preferredLocation.id).toBe(1);
      expect(preferredLocation.name).toBe('Preferred Conference Room');

      const isValid = service.validateLocationId(456);
      expect(isValid).toBe(true);

      const isInvalid = service.validateLocationId(-1);
      expect(isInvalid).toBe(false);
    });

    it('should handle location retrieval with different scenarios', async () => {
      class TestLocationService implements ILocationService {
        private locations: Map<number, ILocation> = new Map([
          [1, { id: 1, name: 'Small Meeting Room', capacity: 4, features: ['TV', 'phone'] }],
          [2, { id: 2, name: 'Medium Conference Room', capacity: 10, features: ['projector', 'whiteboard'] }],
          [3, { id: 3, name: 'Large Auditorium', capacity: 50, features: ['stage', 'microphone', 'lighting'] }],
          [4, { id: 4, name: 'Executive Suite', capacity: 8, features: ['luxury seating', 'catering area'] }],
          [5, { id: 5, name: 'Basic Room', capacity: 6 }] // No features
        ]);

        private preferredLocationId = 2;

        async getLocation(locationId: number): Promise<ILocation> {
          const location = this.locations.get(locationId);
          if (!location) {
            throw new Error(`Location with ID ${locationId} not found`);
          }
          return location;
        }

        async getPreferredLocation(): Promise<ILocation> {
          return this.getLocation(this.preferredLocationId);
        }

        validateLocationId(locationId: number): boolean {
          if (!Number.isInteger(locationId)) {
            return false;
          }
          
          if (locationId <= 0) {
            return false;
          }
          
          return this.locations.has(locationId);
        }
      }

      const service = new TestLocationService();

      // Test successful location retrieval
      const smallRoom = await service.getLocation(1);
      expect(smallRoom.name).toBe('Small Meeting Room');
      expect(smallRoom.capacity).toBe(4);
      expect(smallRoom.features).toEqual(['TV', 'phone']);

      const largeAuditorium = await service.getLocation(3);
      expect(largeAuditorium.name).toBe('Large Auditorium');
      expect(largeAuditorium.capacity).toBe(50);
      expect(largeAuditorium.features?.includes('stage')).toBe(true);

      // Test location without features
      const basicRoom = await service.getLocation(5);
      expect(basicRoom.features).toBeUndefined();

      // Test preferred location
      const preferred = await service.getPreferredLocation();
      expect(preferred.id).toBe(2);
      expect(preferred.name).toBe('Medium Conference Room');

      // Test location not found
      await expect(service.getLocation(999)).rejects.toThrow('Location with ID 999 not found');

      // Test location ID validation
      expect(service.validateLocationId(1)).toBe(true);
      expect(service.validateLocationId(3)).toBe(true);
      expect(service.validateLocationId(999)).toBe(false);
      expect(service.validateLocationId(0)).toBe(false);
      expect(service.validateLocationId(-1)).toBe(false);
      expect(service.validateLocationId(1.5)).toBe(false);
    });

    it('should handle edge cases and error conditions', async () => {
      class EdgeCaseLocationService implements ILocationService {
        async getLocation(locationId: number): Promise<ILocation> {
          // Simulate various edge cases
          if (locationId === 0) {
            throw new Error('Location ID cannot be zero');
          }
          
          if (locationId < 0) {
            throw new Error('Location ID must be positive');
          }
          
          if (locationId > 10000) {
            throw new Error('Location ID out of range');
          }
          
          // Simulate network error
          if (locationId === 500) {
            throw new Error('Network error: Unable to fetch location data');
          }
          
          // Return different location configurations
          if (locationId === 1) {
            return {
              id: 1,
              name: 'Location with Unicode: 会议室 A',
              capacity: 10,
              features: ['支持中文', 'русский язык', 'العربية']
            };
          }
          
          if (locationId === 2) {
            return {
              id: 2,
              name: 'Location with Special Characters: Room @#$%',
              capacity: 0, // Zero capacity room
              features: []
            };
          }
          
          return {
            id: locationId,
            name: `Generated Location ${locationId}`,
            capacity: locationId % 20 + 1, // Dynamic capacity based on ID
            features: locationId % 2 === 0 ? ['even-id-feature'] : ['odd-id-feature']
          };
        }

        async getPreferredLocation(): Promise<ILocation> {
          // Simulate configuration-based preferred location
          const preferredId = parseInt(process.env['MATRIX_PREFERRED_LOCATION_ID'] || '1');
          return this.getLocation(preferredId);
        }

        validateLocationId(locationId: number): boolean {
          // Comprehensive validation
          if (typeof locationId !== 'number') {
            return false;
          }
          
          if (!Number.isFinite(locationId)) {
            return false;
          }
          
          if (!Number.isInteger(locationId)) {
            return false;
          }
          
          if (locationId <= 0) {
            return false;
          }
          
          if (locationId > 10000) {
            return false;
          }
          
          return true;
        }
      }

      const service = new EdgeCaseLocationService();

      // Test Unicode and special characters
      const unicodeLocation = await service.getLocation(1);
      expect(unicodeLocation.name).toContain('会议室 A');
      expect(unicodeLocation.features?.includes('支持中文')).toBe(true);

      const specialCharLocation = await service.getLocation(2);
      expect(specialCharLocation.name).toContain('@#$%');
      expect(specialCharLocation.capacity).toBe(0);

      // Test error conditions
      await expect(service.getLocation(0)).rejects.toThrow('Location ID cannot be zero');
      await expect(service.getLocation(-5)).rejects.toThrow('Location ID must be positive');
      await expect(service.getLocation(50000)).rejects.toThrow('Location ID out of range');
      await expect(service.getLocation(500)).rejects.toThrow('Network error');

      // Test validation edge cases
      expect(service.validateLocationId(1)).toBe(true);
      expect(service.validateLocationId(10000)).toBe(true);
      expect(service.validateLocationId(10001)).toBe(false);
      expect(service.validateLocationId(NaN)).toBe(false);
      expect(service.validateLocationId(Infinity)).toBe(false);
      expect(service.validateLocationId(-Infinity)).toBe(false);
      expect(service.validateLocationId(1.5)).toBe(false);

      // Test dynamic location generation
      const evenLocation = await service.getLocation(100);
      expect(evenLocation.features?.includes('even-id-feature')).toBe(true);
      expect(evenLocation.capacity).toBe(1); // 100 % 20 + 1

      const oddLocation = await service.getLocation(101);
      expect(oddLocation.features?.includes('odd-id-feature')).toBe(true);
      expect(oddLocation.capacity).toBe(2); // 101 % 20 + 1
    });

    it('should handle async operations correctly', async () => {
      class AsyncLocationService implements ILocationService {
        private simulateDelay(ms: number): Promise<void> {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        async getLocation(locationId: number): Promise<ILocation> {
          await this.simulateDelay(10); // Simulate API call delay
          
          return {
            id: locationId,
            name: `Async Location ${locationId}`,
            capacity: 15,
            features: ['async-loaded', 'network-fetched']
          };
        }

        async getPreferredLocation(): Promise<ILocation> {
          await this.simulateDelay(5); // Shorter delay for cached preferred location
          
          return {
            id: 999,
            name: 'Cached Preferred Location',
            capacity: 20,
            features: ['cached', 'preferred', 'fast-access']
          };
        }

        validateLocationId(locationId: number): boolean {
          // Synchronous validation (no async needed)
          return Number.isInteger(locationId) && locationId > 0;
        }
      }

      const service = new AsyncLocationService();

      // Test concurrent location fetching
      const locationPromises = [
        service.getLocation(1),
        service.getLocation(2),
        service.getLocation(3),
        service.getPreferredLocation()
      ];

      const results = await Promise.all(locationPromises);
      
      expect(results).toHaveLength(4);
      expect(results[0]?.id).toBe(1);
      expect(results[1]?.id).toBe(2);
      expect(results[2]?.id).toBe(3);
      expect(results[3]?.id).toBe(999);
      expect(results[3]?.name).toBe('Cached Preferred Location');

      // Test that all locations have async-loaded features
      results.slice(0, 3).forEach(location => {
        expect(location.features?.includes('async-loaded')).toBe(true);
      });

      // Test preferred location has different features
      expect(results[3]?.features?.includes('cached')).toBe(true);
    });
  });
});