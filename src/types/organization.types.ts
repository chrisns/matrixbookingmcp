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
  validateOrganization?(organizationId: number): Promise<boolean>;
}

/**
 * Organization resolution strategy options
 */
export enum OrganizationResolutionStrategy {
  USER_PREFERRED = 'user_preferred',
  LOCATION_PREFERRED = 'location_preferred',
  STRICT = 'strict'
}

/**
 * Organization validation strategy options (for backward compatibility)
 */
export enum OrganizationValidationStrategy {
  USER_PREFERRED = 'user_preferred',
  LOCATION_PREFERRED = 'location_preferred',
  STRICT = 'strict'
}

/**
 * Organization context result with fallback information
 */
export interface IOrganizationContext {
  organizationId: number;
  strategy: OrganizationResolutionStrategy;
  source: 'user' | 'location' | 'default';
  fallbackApplied: boolean;
  validationResult: {
    isValid: boolean;
    error?: string;
  };
}

/**
 * Type alias for backward compatibility
 */
export type OrganizationContext = IOrganizationContext;

/**
 * Configuration options for organization context resolution
 */
export interface IOrganizationContextConfig {
  strategy: OrganizationResolutionStrategy;
  enableCrossOrgAccess: boolean;
  defaultDurationMinutes: number;
  cacheTtlMs: number;
}

/**
 * Organization context resolver service interface
 */
export interface IOrganizationContextResolver {
  resolveOrganizationContext(user: import('./authentication.types.js').IUserProfile, preferredLocation?: ILocation): Promise<IOrganizationContext>;
  validateOrganizationId(organizationId: number): Promise<boolean>;
  getEffectiveOrganizationId(user: import('./authentication.types.js').IUserProfile, locationOrgId?: number): Promise<number>;
  clearValidationCache(): void;
  clearValidationCacheForOrganization(organizationId: number): void;
}