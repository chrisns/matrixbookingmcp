/**
 * Booking service interfaces and types
 */
/* eslint-disable no-unused-vars */

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

export interface IBookingGroup {
  id: number;
  type: string; // e.g., "REPEAT"
  repeatKind: string; // e.g., "WORK_DAILY"
  repeatStartDate: string; // ISO 8601 format
  repeatEndDate: string; // ISO 8601 format
  repeatText: string; // Human-readable description like "Repeats every week day until Tue, 16 Sep 2025"
  status: string; // e.g., "BOOKED"
  firstBookingStatus: string; // e.g., "CONFIRMED"
}

export interface IBookingRequest {
  timeFrom: string;  // ISO 8601 format
  timeTo: string;    // ISO 8601 format
  locationId: number;
  label?: string;    // Booking description/label (required by API)
  description?: string; // Alias for label for backwards compatibility
  attendees: IAttendee[];
  extraRequests: string[];
  bookingGroup?: IBookingGroup;
  owner: IOwner;
  ownerIsAttendee: boolean;
  source: string;
}

export interface IBookingResponse {
  id: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  timeFrom: string;
  timeTo: string;
  organisation: { id: number; name: string };
  locationId: number;
  locationName?: string;
  locationKind: string;
  owner: IOwner;
  bookedBy: IOwner;
  attendeeCount: number;
  ownerIsAttendee: boolean;
  source: string;
  version: number;
  hasExternalNotes: boolean;
  isPrivate: boolean;
  duration: { millis: number };
  possibleActions: {
    edit: boolean;
    cancel: boolean;
    approve: boolean;
    confirm: boolean;
    endEarly: boolean;
    changeOwner: boolean;
    start: boolean;
    viewHistory: boolean;
  };
  checkInStatus: string;
  checkInStartTime: string;
  checkInEndTime: string;
  hasStarted: boolean;
  hasEnded: boolean;
}

export interface ICancelBookingRequest {
  bookingId: string | number;
  notifyScope?: 'ALL_ATTENDEES' | 'OWNER_ONLY' | 'NONE';
  sendNotifications?: boolean;
  reason?: string;
}

export interface ICancelBookingResponse {
  success: boolean;
  bookingId: number;
  status: string;
  cancellationTime: string;
  notificationsSent: boolean;
  notifyScope: string;
  reason?: string;
  originalBooking?: {
    locationId: number;
    locationName?: string;
    timeFrom: string;
    timeTo: string;
    attendeeCount?: number;
    owner?: string;
  };
}

export interface IBookingService {
  createBooking(_request: IBookingRequest): Promise<IBookingResponse>;
  formatBookingRequest(_request: Partial<IBookingRequest>): Promise<IBookingRequest>;
  validateBookingRequest(_request: IBookingRequest): boolean;
  cancelBooking(_request: ICancelBookingRequest): Promise<ICancelBookingResponse>;
}