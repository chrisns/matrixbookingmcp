/**
 * Facility and search interfaces for enhanced location functionality
 */
/* eslint-disable no-unused-vars */

/**
 * Facility available at a location
 */
export interface IFacility {
  id: string;
  name: string;
  category: string;
  text?: string;
  value?: string | number | boolean;
  metadata?: Record<string, unknown>;
  parsed?: {
    type: string;
    size?: string;
    features?: string[];
  };
}

/**
 * Facility categories for filtering
 */
export type FacilityCategory = 
  | 'audio_visual'
  | 'connectivity'
  | 'furniture'
  | 'accessibility'
  | 'catering'
  | 'technology'
  | 'comfort';