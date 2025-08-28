/**
 * Organization structure interfaces from /api/v1/org/{organizationId}
 */
/* eslint-disable no-unused-vars */

import { ILocation } from './location.types.js';

/**
 * Booking category within an organization
 */
export interface IBookingCategory {
  id: number;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
}

/**
 * Location kind/type within an organization
 */
export interface ILocationKind {
  id: number;
  name: string;
  description?: string;
  allowsBooking: boolean;
  capacity?: {
    min?: number;
    max?: number;
  };
}

/**
 * Organization structure response from /api/v1/org/{organizationId}
 */
export interface IOrganizationResponse {
  id: number;
  name: string;
  description?: string;
  categories: IBookingCategory[];
  locationKinds: ILocationKind[];
  rootLocation: ILocation;
  settings?: {
    timezone?: string;
    businessHours?: {
      start: string;
      end: string;
    };
    advanceBookingDays?: number;
  };
}

/**
 * Organization service interface
 */
export interface IOrganizationService {
  getOrganization(organizationId: number): Promise<IOrganizationResponse>;
  getBookingCategories(organizationId: number): Promise<IBookingCategory[]>;
  getLocationKinds(organizationId: number): Promise<ILocationKind[]>;
}