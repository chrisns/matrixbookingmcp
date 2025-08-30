/**
 * Location management interfaces and types
 */
/* eslint-disable no-unused-vars */

import { IFacility } from './facility.types.js';

export interface ILocation {
  id: number;
  name: string;
  capacity?: number;
  features?: string[];
  kind?: string;
  facilities?: IFacility[];
  ancestors?: Array<{
    id: number;
    name: string;
    kind: string;
  }>;
  isBookable?: boolean;
  metadata?: Record<string, unknown>;
  description?: string;
  buildingName?: string;
  floorName?: string;
  bookingCategoryId?: number;
  locations?: ILocation[]; // Nested child locations
  parentId?: number;
  qualifiedName?: string;
}

/**
 * Location hierarchy response with enhanced data
 */
export interface ILocationHierarchyResponse {
  locations: ILocation[];
  total: number;
  hierarchy: {
    [locationId: number]: number[]; // Location ID -> Child location IDs
  };
}

/**
 * Query parameters for location searches
 */
export interface ILocationQueryRequest {
  parentId?: number;
  locationId?: number; // For filtering within a specific location
  kind?: string;
  includeAncestors?: boolean;
  includeFacilities?: boolean;
  includeChildren?: boolean;
  isBookable?: boolean;
}

export interface ILocationService {
  getLocation(_locationId: number): Promise<ILocation>;
  getPreferredLocation(): Promise<ILocation>;
  validateLocationId(_locationId: number): boolean;
  getLocationHierarchy(request?: ILocationQueryRequest): Promise<ILocationHierarchyResponse>;
  getLocationsByKind(kind: string): Promise<ILocation[]>;
  getLocations?(request?: ILocationQueryRequest): Promise<ILocation[]>;
}