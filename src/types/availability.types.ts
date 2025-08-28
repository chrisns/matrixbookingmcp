/**
 * Availability checking interfaces and types
 */
/* eslint-disable no-unused-vars */

import { ILocation } from './location.types.js';

export interface IAvailabilityRequest {
  dateFrom: string;    // Format: 2025-08-27T00:00
  dateTo: string;      // Format: 2025-08-27T23:59
  locationId: number;  // Required, will use 'l' query parameter
  bookingCategory?: number;  // Optional 'bc' parameter
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