import { IFacility } from '../types/facility.types.js';

/**
 * Simplified facility parser for text-based matching
 */
export class FacilityParser {
  /**
   * Check if facilities match search terms using simple text matching
   */
  matchesRequirements(
    facilities: IFacility[],
    requirements: string[]
  ): { matches: boolean; score: number; matchedFacilities: string[] } {
    if (!requirements || requirements.length === 0) {
      return { matches: true, score: 1, matchedFacilities: [] };
    }
    
    const facilityTexts = facilities.map(f => 
      (f.text || f.name || '').toLowerCase()
    );
    
    const matchedFacilities: string[] = [];
    let matchedCount = 0;
    
    for (const req of requirements) {
      const reqLower = req.toLowerCase().trim();
      const matched = facilityTexts.some(text => {
        if (text.includes(reqLower)) {
          const original = facilities.find(f => 
            (f.text || f.name || '').toLowerCase() === text
          );
          if (original) {
            const displayText = original.text || original.name || '';
            if (!matchedFacilities.includes(displayText)) {
              matchedFacilities.push(displayText);
            }
          }
          return true;
        }
        return false;
      });
      
      if (matched) {
        matchedCount++;
      }
    }
    
    const score = requirements.length > 0 ? matchedCount / requirements.length : 0;
    const matches = matchedCount === requirements.length;
    
    return { matches, score, matchedFacilities };
  }
  
  /**
   * Extract facility requirements from natural language
   * Now returns generic facility terms to search for
   */
  extractRequirements(query: string): string[] {
    const requirements: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Common facility terms to look for
    const facilityTerms = [
      { keywords: ['screen', 'monitor', 'display'], term: 'screen' },
      { keywords: ['adjustable', 'standing', 'sit-stand', 'height'], term: 'adjustable' },
      { keywords: ['video', 'conference', 'zoom', 'teams'], term: 'video' },
      { keywords: ['whiteboard', 'board'], term: 'board' },
      { keywords: ['accessible', 'wheelchair', 'disabled'], term: 'accessible' },
      { keywords: ['air con', 'air-con', 'ac', 'climate', 'conditioning'], term: 'air' },
      { keywords: ['wifi', 'wi-fi', 'wireless', 'internet'], term: 'wifi' },
      { keywords: ['phone', 'telephone'], term: 'phone' },
      { keywords: ['power', 'plug', 'socket', 'charging', 'outlet'], term: 'power' },
      { keywords: ['desk'], term: 'desk' },
      { keywords: ['mechanical'], term: 'mechanical' },
      { keywords: ['electric'], term: 'electric' },
      { keywords: ['tv', 'television'], term: 'tv' }
    ];
    
    for (const { keywords, term } of facilityTerms) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        if (!requirements.includes(term)) {
          requirements.push(term);
        }
      }
    }
    
    return requirements;
  }
  
  /**
   * Extract capacity requirement from query
   */
  extractCapacity(query: string): number | null {
    // Match patterns like "5 people", "for 5", "capacity 5", "space for 5"
    const patterns = [
      /(\d+)\s*people/i,
      /(\d+)\s*person/i,
      /for\s+(\d+)/i,
      /capacity\s+(?:of\s+)?(\d+)/i,
      /space\s+for\s+(\d+)/i,
      /seats?\s+(\d+)/i,
      /(\d+)\s*seats?/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return null;
  }
  
  /**
   * Get all unique facility texts from a list of locations
   */
  extractUniqueFacilities(locations: Array<{ facilities?: IFacility[] }>): string[] {
    const uniqueFacilities = new Set<string>();
    
    for (const location of locations) {
      if (location.facilities) {
        for (const facility of location.facilities) {
          const text = facility.text || facility.name;
          if (text) {
            uniqueFacilities.add(text);
          }
        }
      }
    }
    
    return Array.from(uniqueFacilities).sort();
  }
}