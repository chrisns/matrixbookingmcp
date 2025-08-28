/**
 * Availability checking interfaces and types
 */
/* eslint-disable no-unused-vars */

import { ILocation } from './location.types.js';

export interface IAvailabilityRequest {
  dateFrom: string;  // ISO 8601 format
  dateTo: string;    // ISO 8601 format
  locationId?: number;
  duration?: number; // minutes
  // Enhanced parameters for undocumented API
  bc?: number;       // booking category ID
  f?: string;        // from datetime (ISO format) - alias for dateFrom
  t?: string;        // to datetime (ISO format) - alias for dateTo
  l?: number;        // location ID - alias for locationId
  status?: 'available' | 'unavailable' | 'booked' | string[];
  include?: ('locations' | 'facilities' | 'ancestors' | 'layouts' | 'bookingSettings')[];
}

export interface IAvailabilityResponse {
  available: boolean;
  slots: ITimeSlot[];
  location: ILocation;
}

export interface ITimeSlot {
  from: string;      // ISO 8601 format
  to: string;        // ISO 8601 format
  available: boolean;
  locationId: number;
  locationName?: string;
}

export interface IAvailabilityService {
  checkAvailability(_request: Partial<IAvailabilityRequest>): Promise<IAvailabilityResponse>;
  formatAvailabilityRequest(_request: Partial<IAvailabilityRequest>): IAvailabilityRequest;
}