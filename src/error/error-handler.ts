import { IErrorHandler, IAPIError, IErrorResponse, ErrorType } from '../types/error.types.js';
import { v4 as uuidv4 } from 'uuid';

export class ErrorHandler implements IErrorHandler {
  handleError(error: unknown, type: ErrorType): IErrorResponse {
    const timestamp = new Date().toISOString();
    const requestId = uuidv4();

    switch (type) {
      case 'TIMEOUT_ERROR':
        return this.handleTimeout();
      case 'AUTHENTICATION_ERROR':
        return this.createErrorResponse(
          'AUTH_FAILED',
          'Authentication failed',
          401,
          requestId,
          timestamp,
          this.sanitizeError(error)
        );
      case 'VALIDATION_ERROR':
        return this.createErrorResponse(
          'VALIDATION_FAILED',
          this.extractErrorMessage(error, 'Validation failed'),
          400,
          requestId,
          timestamp,
          this.sanitizeError(error)
        );
      case 'NETWORK_ERROR':
        if (error instanceof Error) {
          return this.handleNetworkError(error);
        }
        return this.createErrorResponse(
          'NETWORK_ERROR',
          'Network connection failed',
          503,
          requestId,
          timestamp,
          this.sanitizeError(error)
        );
      case 'SYSTEM_ERROR':
        return this.createErrorResponse(
          'SYSTEM_ERROR',
          'Internal system error',
          500,
          requestId,
          timestamp,
          this.sanitizeError(error)
        );
      case 'API_ERROR':
      default:
        return this.createErrorResponse(
          'API_ERROR',
          this.extractErrorMessage(error, 'API request failed'),
          500,
          requestId,
          timestamp,
          this.sanitizeError(error)
        );
    }
  }

  handleTimeout(): IErrorResponse {
    const timestamp = new Date().toISOString();
    const requestId = uuidv4();
    
    return this.createErrorResponse(
      'REQUEST_TIMEOUT',
      'Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit',
      408,
      requestId,
      timestamp
    );
  }

  handleAPIError(response: Response, body?: unknown): IErrorResponse {
    const timestamp = new Date().toISOString();
    const requestId = uuidv4();
    
    // Pass-through policy: preserve original Matrix API error without modification
    let errorMessage = `Matrix API error: ${response.status} ${response.statusText}`;
    let errorCode = 'MATRIX_API_ERROR';
    let details: unknown;

    // If we have response body, try to extract Matrix API error details
    if (body && typeof body === 'object' && body !== null) {
      // Pass through the raw error response from Matrix API
      details = body;
      
      // Extract error message if available, but don't transform it
      if (this.hasProperty(body, 'message')) {
        const msg = (body as Record<string, unknown>)['message'];
        if (typeof msg === 'string') {
          errorMessage = msg;
        }
      } else if (this.hasProperty(body, 'error')) {
        const err = (body as Record<string, unknown>)['error'];
        if (typeof err === 'string') {
          errorMessage = err;
        }
      }
      
      // Extract error code if available
      if (this.hasProperty(body, 'code')) {
        const code = (body as Record<string, unknown>)['code'];
        if (typeof code === 'string') {
          errorCode = code;
        }
      } else if (this.hasProperty(body, 'errorCode')) {
        const code = (body as Record<string, unknown>)['errorCode'];
        if (typeof code === 'string') {
          errorCode = code;
        }
      }
    } else if (body !== undefined && body !== null) {
      // Handle non-object body (string, number, etc.)
      details = body;
    }

    return this.createErrorResponse(
      errorCode,
      errorMessage,
      response.status, // Preserve original HTTP status code
      requestId,
      timestamp,
      details
    );
  }

  handleNetworkError(error: Error): IErrorResponse {
    const timestamp = new Date().toISOString();
    const requestId = uuidv4();
    
    let errorCode = 'NETWORK_ERROR';
    let httpStatus = 503;
    let errorMessage = 'Network connection failed';

    // Classify network error types
    if (error.name === 'AbortError') {
      errorCode = 'REQUEST_TIMEOUT';
      httpStatus = 408;
      errorMessage = 'Request timeout after 5000ms';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
      errorCode = 'DNS_ERROR';
      httpStatus = 503;
      errorMessage = 'DNS resolution failed';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorCode = 'CONNECTION_REFUSED';
      httpStatus = 503;
      errorMessage = 'Connection refused by server';
    } else if (error.message.includes('ETIMEDOUT')) {
      errorCode = 'CONNECTION_TIMEOUT';
      httpStatus = 408;
      errorMessage = 'Connection timeout';
    } else {
      // Preserve original error message for other network errors
      errorMessage = error.message || errorMessage;
    }

    return this.createErrorResponse(
      errorCode,
      errorMessage,
      httpStatus,
      requestId,
      timestamp,
      this.sanitizeError(error)
    );
  }

  private createErrorResponse(
    code: string,
    message: string,
    httpStatus: number,
    requestId: string,
    timestamp: string,
    details?: unknown
  ): IErrorResponse {
    const apiError: IAPIError = {
      code,
      message,
      timestamp
    };

    // Only include details if they exist and don't contain sensitive data
    if (details !== undefined) {
      apiError.details = details;
    }

    return {
      error: apiError,
      httpStatus,
      requestId
    };
  }

  private extractErrorMessage(error: unknown, defaultMessage: string): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && this.hasProperty(error, 'message')) {
      const msg = (error as Record<string, unknown>)['message'];
      return String(msg);
    }
    
    return defaultMessage;
  }

  private sanitizeError(error: unknown): unknown {
    if (error instanceof Error) {
      // Return safe error properties, excluding sensitive stack trace details
      return {
        name: error.name,
        message: error.message
      };
    }
    
    if (error && typeof error === 'object') {
      // Remove potentially sensitive properties
      const sanitized = { ...error } as Record<string, unknown>;
      
      // Remove common sensitive properties
      const sensitiveKeys = [
        'password', 'token', 'secret', 'key', 'authorization', 'auth',
        'credential', 'username', 'email', 'phone', 'ssn', 'stack'
      ];
      
      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          delete sanitized[key];
        }
      }
      
      return sanitized;
    }
    
    return error;
  }

  private hasProperty(obj: object, prop: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }
}