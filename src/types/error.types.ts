/**
 * Error handling interfaces and types
 */
/* eslint-disable no-unused-vars */

export interface IAPIError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface IErrorResponse {
  error: IAPIError;
  httpStatus: number;
  requestId?: string;
}

export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR' 
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'API_ERROR'
  | 'SYSTEM_ERROR'
  | 'AVAILABILITY_ERROR'
  | 'LOCATION_ERROR'
  | 'ORGANIZATION_ERROR'
  | 'USER_SERVICE_ERROR'
  | 'BOOKING_ERROR'
  | 'LOCATION_RESOLUTION_ERROR'
  | 'DESK_BANK_ERROR'
  | 'ROOM_NOT_FOUND_ERROR';

export interface IErrorHandler {
  handleError(_error: unknown, _type: ErrorType): IErrorResponse;
  handleTimeout(): IErrorResponse;
  handleAPIError(_response: Response, _body?: unknown): IErrorResponse;
  handleNetworkError(_error: Error): IErrorResponse;
}

// Enhanced error handling interfaces
export interface Action {
  type: 'retry' | 'alternative' | 'manual' | 'fallback';
  description: string;
  parameters?: Record<string, unknown>;
}

export interface Location {
  id: number;
  name: string;
  kind: string;
  qualifiedName: string;
  isBookable: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  alternativeEndpoints?: string[];
}

export interface APICall {
  endpoint: string;
  method: string;
  parameters: Record<string, unknown>;
  timestamp: string;
  responseStatus?: number;
  error?: string;
}

export interface UserContext {
  userId?: string | undefined;
  organizationId?: number | undefined;
  preferredLocationId?: number | undefined;
  recentBookings?: string[] | undefined;
}

export interface HealthStatus {
  apiConnectivity: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastSuccessfulCall?: string;
}

export interface EnhancedErrorResponse {
  error: {
    code: string;
    message: string;
    context: string;
    originalError?: unknown;
  };
  recovery: {
    suggestedActions: Action[];
    alternativeLocations?: Location[];
    retryParameters?: RetryConfig;
  };
  diagnostics: {
    apiCallsMade: APICall[];
    userContext: UserContext;
    systemHealth: HealthStatus;
  };
}

export interface IEnhancedErrorHandler extends IErrorHandler {
  handleEnhancedError(_error: unknown, _type: ErrorType, _context?: ErrorContext): EnhancedErrorResponse;
  detectErrorType(_error: unknown): ErrorType;
  generateRecoveryActions(_errorType: ErrorType, _context?: ErrorContext): Action[];
  suggestAlternativeLocations(_originalLocationId?: number, _context?: ErrorContext): Promise<Location[]>;
  collectDiagnostics(_context?: ErrorContext): Promise<{
    apiCallsMade: APICall[];
    userContext: UserContext;
    systemHealth: HealthStatus;
  }>;
}

export interface ErrorContext {
  operation: 'booking' | 'availability' | 'location_resolution' | 'authentication';
  locationId?: number;
  locationQuery?: string;
  timeFrom?: string;
  timeTo?: string;
  userId?: string;
  organizationId?: number;
  bookingCategory?: number;
  apiCallHistory?: APICall[];
}