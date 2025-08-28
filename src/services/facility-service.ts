/**
 * Facility parsing and processing service
 */
import { IFacility, IFacilityService, FacilityCategory } from '../types/facility.types.js';

export class FacilityService implements IFacilityService {
  
  /**
   * Parse raw facility strings into structured facility objects
   */
  parseFacilities(rawFacilities: string): IFacility[] {
    if (!rawFacilities || rawFacilities.trim() === '') {
      return [];
    }

    const facilities: IFacility[] = [];
    
    // Split by common separators
    const parts = rawFacilities.split(/[,;|\n]/).map(part => part.trim()).filter(part => part.length > 0);
    
    for (const part of parts) {
      const facility = this.parseSingleFacility(part);
      if (facility) {
        facilities.push(facility);
      }
    }
    
    return facilities;
  }

  /**
   * Parse a single facility string
   */
  private parseSingleFacility(facilityText: string): IFacility | null {
    if (!facilityText || facilityText.trim() === '') {
      return null;
    }

    const text = facilityText.trim();
    
    // Generate unique ID from text
    const id = this.generateFacilityId(text);
    
    // Determine category and extract metadata
    const category = this.determineFacilityCategory(text);
    const parsed = this.extractFacilityMetadata(text);
    
    return {
      id,
      name: text,
      category,
      parsed
    };
  }

  /**
   * Generate a unique ID for a facility based on its text
   */
  private generateFacilityId(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Determine the category of a facility based on its text
   */
  private determineFacilityCategory(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Audio/Visual equipment
    if (lowerText.includes('tv') || lowerText.includes('screen') || lowerText.includes('monitor') ||
        lowerText.includes('projector') || lowerText.includes('display')) {
      return 'audio_visual';
    }
    
    if (lowerText.includes('phone') || lowerText.includes('conference call') || 
        lowerText.includes('speaker') || lowerText.includes('microphone') || lowerText.includes('audio')) {
      return 'audio_visual';
    }
    
    // Technology
    if (lowerText.includes('camera') || lowerText.includes('video conference') ||
        lowerText.includes('webcam') || lowerText.includes('streaming')) {
      return 'technology';
    }
    
    // Connectivity
    if (lowerText.includes('wifi') || lowerText.includes('ethernet') || lowerText.includes('internet') ||
        lowerText.includes('network') || lowerText.includes('cable')) {
      return 'connectivity';
    }
    
    // Accessibility (check before furniture to avoid wheelchair -> chair match)
    if (lowerText.includes('wheelchair') || lowerText.includes('accessible') || 
        lowerText.includes('disability') || lowerText.includes('hearing loop')) {
      return 'accessibility';
    }
    
    // Furniture
    if (lowerText.includes('chair') || lowerText.includes('desk') || lowerText.includes('table') ||
        lowerText.includes('adjustable') || lowerText.includes('ergonomic')) {
      return 'furniture';
    }
    
    // Catering
    if (lowerText.includes('coffee') || lowerText.includes('tea') || lowerText.includes('kitchen') ||
        lowerText.includes('refreshment') || lowerText.includes('catering')) {
      return 'catering';
    }
    
    // Comfort
    if (lowerText.includes('air con') || lowerText.includes('heating') || lowerText.includes('climate') ||
        lowerText.includes('lighting') || lowerText.includes('comfort')) {
      return 'comfort';
    }
    
    // Default to technology if we can't categorize
    return 'technology';
  }

  /**
   * Extract structured metadata from facility text
   */
  private extractFacilityMetadata(text: string): { type: string; size?: string; features?: string[] } {
    const parsed: { type: string; size?: string; features?: string[] } = {
      type: text,
      features: []
    };
    
    // Extract size information (screens, monitors)
    const sizeMatch = text.match(/(\d+)["']\s*(screen|monitor|tv|display)?/i);
    if (sizeMatch) {
      parsed.size = sizeMatch[1] + '"';
      parsed.type = sizeMatch[2] || 'Screen';
    }
    
    // Extract features
    const features: string[] = [];
    
    if (text.toLowerCase().includes('adjustable')) {
      features.push('Adjustable');
    }
    
    if (text.toLowerCase().includes('mechanical')) {
      features.push('Mechanical');
    }
    
    if (text.toLowerCase().includes('wireless')) {
      features.push('Wireless');
    }
    
    if (text.toLowerCase().includes('4k') || text.toLowerCase().includes('uhd')) {
      features.push('4K');
    }
    
    if (text.toLowerCase().includes('touch')) {
      features.push('Touch');
    }
    
    if (features.length > 0) {
      parsed.features = features;
    }
    
    return parsed;
  }

  /**
   * Get facilities by category
   */
  // eslint-disable-next-line no-unused-vars
  getFacilitiesByCategory(_category: FacilityCategory): IFacility[] {
    // This would typically query a database or cache
    // For now, return empty array as this requires implementation with actual data
    return [];
  }

  /**
   * Search locations by required facilities
   */
  searchByFacilities(facilities: string[], locations: Array<{location?: {facilities?: IFacility[]}} | unknown>): Array<unknown> {
    return locations.filter(location => {
      const typedLocation = location as {location?: {facilities?: IFacility[]}};
      if (!typedLocation.location?.facilities) {
        return false;
      }
      
      return facilities.every(requiredFacility => {
        return typedLocation.location!.facilities!.some((facility: IFacility) => 
          this.matchesFacilityRequirement(facility, requiredFacility)
        );
      });
    });
  }

  /**
   * Check if a facility matches a requirement
   */
  private matchesFacilityRequirement(facility: IFacility, requirement: string): boolean {
    const reqLower = requirement.toLowerCase();
    const facilityLower = facility.name.toLowerCase();
    
    // Exact match
    if (facilityLower === reqLower) {
      return true;
    }
    
    // Partial match
    if (facilityLower.includes(reqLower) || reqLower.includes(facilityLower)) {
      return true;
    }
    
    // Category match
    if (facility.category === reqLower || facility.category.includes(reqLower)) {
      return true;
    }
    
    // Parsed type match
    if (facility.parsed?.type?.toLowerCase().includes(reqLower)) {
      return true;
    }
    
    // Feature match
    if (facility.parsed?.features?.some((feature: string) => 
      feature.toLowerCase().includes(reqLower))) {
      return true;
    }
    
    return false;
  }
}