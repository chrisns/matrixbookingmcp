/**
 * API client interfaces and types
 */
/* eslint-disable no-unused-vars */

import { ICredentials } from './authentication.types.js';
import { IAvailabilityRequest, IAvailabilityResponse } from './availability.types.js';
import { IBookingRequest, IBookingResponse } from './booking.types.js';
import { ILocation, ILocationHierarchyResponse, ILocationQueryRequest } from './location.types.js';
import { ICurrentUserResponse, IUserBookingsRequest, IUserBookingsResponse } from './user.types.js';
import { IOrganizationResponse } from './organization.types.js';

export interface IAPIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface IAPIResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export interface IMatrixAPIClient {
  // Existing endpoints
  checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse>;
  createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse>;
  getLocation(locationId: number, credentials: ICredentials): Promise<ILocation>;
  
  // New undocumented endpoints
  getCurrentUser(credentials: ICredentials): Promise<ICurrentUserResponse>;
  getUserBookings(request: IUserBookingsRequest, credentials: ICredentials): Promise<IUserBookingsResponse>;
  getAllBookings(credentials: ICredentials): Promise<IUserBookingsResponse>;
  getLocationHierarchy(request: ILocationQueryRequest, credentials: ICredentials): Promise<ILocationHierarchyResponse>;
  getOrganization(organizationId: number, credentials: ICredentials): Promise<IOrganizationResponse>;
  
  // Core request method
  makeRequest<T>(request: IAPIRequest): Promise<IAPIResponse<T>>;
}