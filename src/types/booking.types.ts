/**
 * Booking service interfaces and types
 */
/* eslint-disable no-unused-vars */

import { ILocation } from './location.types.js';

export interface IAttendee {
  id?: number;
  email: string;
  name: string;
}

export interface IOwner {
  id: number;
  email: string;
  name: string;
}

export interface IBookingRequest {
  timeFrom: string;  // ISO 8601 format
  timeTo: string;    // ISO 8601 format
  locationId: number;
  attendees: IAttendee[];
  extraRequests: string[];
  owner: IOwner;
  ownerIsAttendee: boolean;
  source: string;
}

export interface IBookingResponse {
  id: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  timeFrom: string;
  timeTo: string;
  location: ILocation;
  owner: IOwner;
  attendees: IAttendee[];
}

export interface IBookingService {
  createBooking(_request: IBookingRequest): Promise<IBookingResponse>;
  formatBookingRequest(_request: Partial<IBookingRequest>): IBookingRequest;
  validateBookingRequest(_request: IBookingRequest): boolean;
}