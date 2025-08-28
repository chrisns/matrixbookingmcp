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
  | 'USER_SERVICE_ERROR';

export interface IErrorHandler {
  handleError(_error: unknown, _type: ErrorType): IErrorResponse;
  handleTimeout(): IErrorResponse;
  handleAPIError(_response: Response, _body?: unknown): IErrorResponse;
  handleNetworkError(_error: Error): IErrorResponse;
}