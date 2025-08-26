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
}

export interface IAvailabilityService {
  checkAvailability(_request: IAvailabilityRequest): Promise<IAvailabilityResponse>;
  formatAvailabilityRequest(_request: Partial<IAvailabilityRequest>): IAvailabilityRequest;
}