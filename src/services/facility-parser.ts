import { IFacility } from '../types/facility.types.js';

/**
 * Parsed facility information
 */
export interface IParsedFacility {
  type: string;
  category: string;
  attributes: Record<string, string | number | boolean>;
  originalText: string;
}

/**
 * Service for parsing and analyzing facility information
 */
export class FacilityParser {
  /**
   * Parse facility text into structured data
   */
  parseFacility(facility: IFacility): IParsedFacility {
    const text = facility.text || facility.name || '';
    const lowerText = text.toLowerCase();
    
    // Screen parsing (e.g., '34" Screen', '27" Screen')
    if (lowerText.includes('screen') || lowerText.includes('monitor') || lowerText.includes('display')) {
      const sizeMatch = text.match(/(\d+)["\s]*(inch|"|')?/i);
      return {
        type: 'screen',
        category: 'technology',
        attributes: {
          size: sizeMatch ? parseInt(sizeMatch[1]) : 0,
          hasScreen: true
        },
        originalText: text
      };
    }
    
    // Desk parsing (e.g., 'Adjustable Desk - Mechanical', 'Standing Desk')
    if (lowerText.includes('desk')) {
      const isAdjustable = lowerText.includes('adjustable') || lowerText.includes('standing') || lowerText.includes('sit-stand');
      const isElectric = lowerText.includes('electric') || lowerText.includes('motorized');
      const isMechanical = lowerText.includes('mechanical') || lowerText.includes('manual');
      
      return {
        type: 'desk',
        category: 'furniture',
        attributes: {
          adjustable: isAdjustable,
          mechanism: isElectric ? 'electric' : isMechanical ? 'mechanical' : 'fixed',
          hasDesk: true
        },
        originalText: text
      };
    }
    
    // Video/Conference equipment
    if (lowerText.includes('video') || lowerText.includes('conference') || lowerText.includes('tv')) {
      return {
        type: 'video_conference',
        category: 'technology',
        attributes: {
          hasVideoConference: true
        },
        originalText: text
      };
    }
    
    // Whiteboard/Writing surfaces
    if (lowerText.includes('whiteboard') || lowerText.includes('board')) {
      return {
        type: 'whiteboard',
        category: 'furniture',
        attributes: {
          hasWhiteboard: true
        },
        originalText: text
      };
    }
    
    // Phone/Audio
    if (lowerText.includes('phone') || lowerText.includes('speaker')) {
      return {
        type: 'phone',
        category: 'technology',
        attributes: {
          hasPhone: true
        },
        originalText: text
      };
    }
    
    // Accessibility features
    if (lowerText.includes('accessible') || lowerText.includes('wheelchair') || lowerText.includes('disabled')) {
      return {
        type: 'accessibility',
        category: 'accessibility',
        attributes: {
          isAccessible: true
        },
        originalText: text
      };
    }
    
    // Air conditioning/Climate control
    if (lowerText.includes('air con') || lowerText.includes('air-con') || lowerText.includes('ac') || lowerText.includes('climate')) {
      return {
        type: 'climate_control',
        category: 'comfort',
        attributes: {
          hasAirConditioning: true
        },
        originalText: text
      };
    }
    
    // WiFi/Network
    if (lowerText.includes('wifi') || lowerText.includes('wi-fi') || lowerText.includes('wireless') || lowerText.includes('network')) {
      return {
        type: 'network',
        category: 'connectivity',
        attributes: {
          hasWifi: true
        },
        originalText: text
      };
    }
    
    // Power/Charging
    if (lowerText.includes('power') || lowerText.includes('socket') || lowerText.includes('plug') || lowerText.includes('charging')) {
      return {
        type: 'power',
        category: 'connectivity',
        attributes: {
          hasPowerOutlets: true
        },
        originalText: text
      };
    }
    
    // Default/Other
    return {
      type: 'other',
      category: facility.category || 'other',
      attributes: {
        text: text
      },
      originalText: text
    };
  }
  
  /**
   * Parse multiple facilities and aggregate attributes
   */
  parseFacilities(facilities: IFacility[]): {
    parsed: IParsedFacility[];
    aggregated: any;
  } {
    const parsed = facilities.map(f => this.parseFacility(f));
    
    // Aggregate attributes across all facilities
    const aggregated: Record<string, any> = {};
    
    for (const facility of parsed) {
      // Merge boolean attributes (OR logic)
      for (const [key, value] of Object.entries(facility.attributes)) {
        if (typeof value === 'boolean' && value) {
          aggregated[key] = true;
        } else if (typeof value === 'number' && key === 'size') {
          // For screen sizes, take the largest
          aggregated.screenSize = Math.max(aggregated.screenSize || 0, value);
        } else if (key === 'mechanism' && !aggregated.mechanism) {
          aggregated.mechanism = value;
        }
      }
    }
    
    return { parsed, aggregated };
  }
  
  /**
   * Check if facilities match requirements
   */
  matchesRequirements(
    facilities: IFacility[],
    requirements: string[]
  ): { matches: boolean; score: number; details: string[] } {
    const { aggregated } = this.parseFacilities(facilities);
    const details: string[] = [];
    let matchedCount = 0;
    
    for (const req of requirements) {
      const lowerReq = req.toLowerCase();
      let matched = false;
      
      // Check for adjustable desk
      if (lowerReq.includes('adjustable') && aggregated.adjustable) {
        matched = true;
        details.push(`✓ Has adjustable desk (${aggregated.mechanism || 'unknown'} mechanism)`);
      }
      
      // Check for screen with optional size
      if (lowerReq.includes('screen') || lowerReq.includes('monitor')) {
        if (aggregated.hasScreen) {
          const sizeMatch = req.match(/(\d+)/);
          if (sizeMatch) {
            const requiredSize = parseInt(sizeMatch[1]);
            if (aggregated.screenSize >= requiredSize) {
              matched = true;
              details.push(`✓ Has ${aggregated.screenSize}" screen (meets ${requiredSize}" requirement)`);
            } else {
              details.push(`✗ Has ${aggregated.screenSize}" screen (below ${requiredSize}" requirement)`);
            }
          } else {
            matched = true;
            details.push(`✓ Has screen (${aggregated.screenSize}" size)`);
          }
        }
      }
      
      // Check for video conference
      if (lowerReq.includes('video') || lowerReq.includes('conference')) {
        if (aggregated.hasVideoConference) {
          matched = true;
          details.push('✓ Has video conference equipment');
        }
      }
      
      // Check for whiteboard
      if (lowerReq.includes('whiteboard') || lowerReq.includes('board')) {
        if (aggregated.hasWhiteboard) {
          matched = true;
          details.push('✓ Has whiteboard');
        }
      }
      
      // Check for accessibility
      if (lowerReq.includes('accessible') || lowerReq.includes('wheelchair')) {
        if (aggregated.isAccessible) {
          matched = true;
          details.push('✓ Is accessible');
        }
      }
      
      // Check for air conditioning
      if (lowerReq.includes('air con') || lowerReq.includes('ac') || lowerReq.includes('climate')) {
        if (aggregated.hasAirConditioning) {
          matched = true;
          details.push('✓ Has air conditioning');
        }
      }
      
      // Check for WiFi
      if (lowerReq.includes('wifi') || lowerReq.includes('wi-fi') || lowerReq.includes('wireless')) {
        if (aggregated.hasWifi) {
          matched = true;
          details.push('✓ Has WiFi');
        }
      }
      
      // Check for phone
      if (lowerReq.includes('phone')) {
        if (aggregated.hasPhone) {
          matched = true;
          details.push('✓ Has phone');
        }
      }
      
      // Check for power outlets
      if (lowerReq.includes('power') || lowerReq.includes('plug') || lowerReq.includes('socket')) {
        if (aggregated.hasPowerOutlets) {
          matched = true;
          details.push('✓ Has power outlets');
        }
      }
      
      if (matched) {
        matchedCount++;
      } else {
        details.push(`✗ Missing: ${req}`);
      }
    }
    
    const score = requirements.length > 0 ? matchedCount / requirements.length : 0;
    
    return {
      matches: matchedCount === requirements.length,
      score,
      details
    };
  }
  
  /**
   * Extract facility requirements from natural language
   */
  extractRequirements(query: string): string[] {
    const requirements: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Screen requirements
    if (lowerQuery.includes('screen') || lowerQuery.includes('monitor') || lowerQuery.includes('display')) {
      const sizeMatch = query.match(/(\d+)["\s]*(inch|"|')?\s*(screen|monitor|display)/i);
      if (sizeMatch) {
        requirements.push(`${sizeMatch[1]}" screen`);
      } else {
        requirements.push('screen');
      }
    }
    
    // Desk requirements
    if (lowerQuery.includes('adjustable desk') || lowerQuery.includes('standing desk') || lowerQuery.includes('sit-stand')) {
      requirements.push('adjustable desk');
    } else if (lowerQuery.includes('desk')) {
      requirements.push('desk');
    }
    
    // Video conference
    if (lowerQuery.includes('video') || lowerQuery.includes('conference') || lowerQuery.includes('tv')) {
      requirements.push('video conference');
    }
    
    // Whiteboard
    if (lowerQuery.includes('whiteboard') || lowerQuery.includes('board')) {
      requirements.push('whiteboard');
    }
    
    // Accessibility
    if (lowerQuery.includes('accessible') || lowerQuery.includes('wheelchair') || lowerQuery.includes('disabled')) {
      requirements.push('accessible');
    }
    
    // Air conditioning
    if (lowerQuery.includes('air con') || lowerQuery.includes('air-con') || lowerQuery.includes('ac') || lowerQuery.includes('climate')) {
      requirements.push('air conditioning');
    }
    
    // WiFi
    if (lowerQuery.includes('wifi') || lowerQuery.includes('wi-fi') || lowerQuery.includes('wireless')) {
      requirements.push('wifi');
    }
    
    // Phone
    if (lowerQuery.includes('phone') || lowerQuery.includes('conference phone')) {
      requirements.push('phone');
    }
    
    // Power
    if (lowerQuery.includes('power') || lowerQuery.includes('plug') || lowerQuery.includes('socket') || lowerQuery.includes('charging')) {
      requirements.push('power outlets');
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
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    return null;
  }
}