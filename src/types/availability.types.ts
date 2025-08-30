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

// Enhanced availability checking interfaces
export interface IAvailabilityChecker {
  checkDeskAvailability(
    locationId: number,
    timeFrom: string,
    timeTo: string,
    bookingCategory: number
  ): Promise<IAvailabilityResult>;

  findAvailableDesksInBank(
    deskBankId: number,
    timeFrom: string,
    timeTo: string
  ): Promise<IAvailableDesk[]>;

  checkAvailabilityWithRetry(
    request: IAvailabilityRequest,
    maxRetries?: number
  ): Promise<IAvailabilityResult>;
}

export interface IAvailabilityResult {
  isAvailable: boolean;
  availableSlots: ITimeSlot[];
  conflictingBookings?: IBookingConflict[];
  alternativeSuggestions: IAlternativeDesk[];
  locationHierarchy?: IAvailabilityLocationHierarchy[];
  rawResponse?: unknown; // For debugging purposes
}

export interface IAvailableDesk {
  id: number;
  name: string;
  qualifiedName: string;
  isAvailable: boolean;
  availableSlots: ITimeSlot[];
  facilities?: string[];
  deskBankId?: number;
}

export interface IBookingConflict {
  bookingId: number;
  startTime: string;
  endTime: string;
  owner?: string;
  description?: string;
}

export interface IAlternativeDesk {
  id: number;
  name: string;
  qualifiedName: string;
  distance?: number; // Distance from original location
  availableSlots: ITimeSlot[];
  confidence: number; // 0-1 score for recommendation quality
}

export interface IAvailabilityLocationHierarchy {
  id: number;
  name: string;
  kind: string;
  parentId?: number;
  children: IAvailabilityLocationHierarchy[];
}

export interface IRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface IAvailabilityError {
  code: string;
  message: string;
  originalError?: unknown;
  retryable: boolean;
  suggestedAction?: string;
}