/**
 * User service interfaces and types for current user operations
 */
/* eslint-disable no-unused-vars */

import { IUserProfile } from './authentication.types.js';
import { IBookingResponse } from './booking.types.js';

/**
 * Enhanced user profile with preferences from /api/v1/user/current
 */
export interface ICurrentUserResponse extends IUserProfile {
  preferences?: {
    timezone?: string;
    language?: string;
    defaultLocationId?: number;
  };
  permissions?: string[];
  isAdmin?: boolean;
}

/**
 * User's personal bookings from /api/v1/user/current/bookings
 */
export interface IUserBookingsResponse {
  bookings: IBookingResponse[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Query parameters for user bookings
 */
export interface IUserBookingsRequest {
  startDate?: string;
  endDate?: string;
  status?: 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
  page?: number;
  pageSize?: number;
}

/**
 * User service interface
 */
export interface IUserService {
  getCurrentUser(): Promise<ICurrentUserResponse>;
  getUserBookings(request?: IUserBookingsRequest): Promise<IUserBookingsResponse>;
}