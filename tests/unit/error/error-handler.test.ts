import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler } from '../../../src/error/error-handler.js';
import { IErrorHandler } from '../../../src/types/error.types.js';

// Mock UUID to make tests predictable
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-request-id-123')
}));

describe('ErrorHandler', () => {
  let errorHandler: IErrorHandler;
  const fixedTimestamp = '2025-01-01T12:00:00.000Z';

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    // Mock Date.prototype.toISOString to return fixed timestamp
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTimestamp);
  });

  describe('handleError', () => {
    it('should handle TIMEOUT_ERROR by calling handleTimeout', () => {
      const timeoutSpy = vi.spyOn(errorHandler, 'handleTimeout');
      const error = new Error('timeout');
      
      errorHandler.handleError(error, 'TIMEOUT_ERROR');
      
      expect(timeoutSpy).toHaveBeenCalledOnce();
    });

    it('should handle AUTHENTICATION_ERROR with appropriate response', () => {
      const error = new Error('Invalid credentials');
      
      const result = errorHandler.handleError(error, 'AUTHENTICATION_ERROR');
      
      expect(result).toEqual({
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          timestamp: fixedTimestamp,
          details: {
            name: 'Error',
            message: 'Invalid credentials'
          }
        },
        httpStatus: 401,
        requestId: 'test-request-id-123'
      });
    });

    it('should handle VALIDATION_ERROR with error message', () => {
      const error = new Error('Required field missing');
      
      const result = errorHandler.handleError(error, 'VALIDATION_ERROR');
      
      expect(result).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Required field missing',
          timestamp: fixedTimestamp,
          details: {
            name: 'Error',
            message: 'Required field missing'
          }
        },
        httpStatus: 400,
        requestId: 'test-request-id-123'
      });
    });

    it('should handle NETWORK_ERROR by calling handleNetworkError for Error instances', () => {
      const networkSpy = vi.spyOn(errorHandler, 'handleNetworkError');
      const error = new Error('Connection failed');
      
      errorHandler.handleError(error, 'NETWORK_ERROR');
      
      expect(networkSpy).toHaveBeenCalledWith(error);
    });

    it('should handle NETWORK_ERROR with non-Error objects', () => {
      const result = errorHandler.handleError('network failure', 'NETWORK_ERROR');
      
      expect(result).toEqual({
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network connection failed',
          timestamp: fixedTimestamp,
          details: 'network failure'
        },
        httpStatus: 503,
        requestId: 'test-request-id-123'
      });
    });

    it('should handle SYSTEM_ERROR', () => {
      const error = new Error('Internal error');
      
      const result = errorHandler.handleError(error, 'SYSTEM_ERROR');
      
      expect(result).toEqual({
        error: {
          code: 'SYSTEM_ERROR',
          message: 'Internal system error',
          timestamp: fixedTimestamp,
          details: {
            name: 'Error',
            message: 'Internal error'
          }
        },
        httpStatus: 500,
        requestId: 'test-request-id-123'
      });
    });

    it('should default to API_ERROR for unknown types', () => {
      const error = new Error('Unknown error');
      
      const result = errorHandler.handleError(error, 'API_ERROR');
      
      expect(result).toEqual({
        error: {
          code: 'API_ERROR',
          message: 'Unknown error',
          timestamp: fixedTimestamp,
          details: {
            name: 'Error',
            message: 'Unknown error'
          }
        },
        httpStatus: 500,
        requestId: 'test-request-id-123'
      });
    });
  });

  describe('handleTimeout', () => {
    it('should return descriptive timeout error', () => {
      const result = errorHandler.handleTimeout();
      
      expect(result).toEqual({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout after 5000ms - The Matrix Booking API did not respond within the expected time limit',
          timestamp: fixedTimestamp
        },
        httpStatus: 408,
        requestId: 'test-request-id-123'
      });
    });
  });

  describe('handleAPIError', () => {
    it('should preserve HTTP status code from Matrix API response', () => {
      const mockResponse = {
        status: 422,
        statusText: 'Unprocessable Entity'
      } as Response;
      
      const result = errorHandler.handleAPIError(mockResponse);
      
      expect(result.httpStatus).toBe(422);
      expect(result.error.message).toBe('Matrix API error: 422 Unprocessable Entity');
    });

    it('should pass through Matrix API error body without modification', () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request'
      } as Response;
      
      const matrixErrorBody = {
        code: 'INVALID_BOOKING',
        message: 'Room is not available at the requested time',
        details: {
          roomId: 123,
          requestedTime: '2025-01-01T10:00:00Z'
        }
      };
      
      const result = errorHandler.handleAPIError(mockResponse, matrixErrorBody);
      
      expect(result).toEqual({
        error: {
          code: 'INVALID_BOOKING',
          message: 'Room is not available at the requested time',
          timestamp: fixedTimestamp,
          details: matrixErrorBody
        },
        httpStatus: 400,
        requestId: 'test-request-id-123'
      });
    });

    it('should handle Matrix API error with different error property names', () => {
      const mockResponse = {
        status: 401,
        statusText: 'Unauthorized'
      } as Response;
      
      const matrixErrorBody = {
        errorCode: 'AUTH_EXPIRED',
        error: 'Session has expired'
      };
      
      const result = errorHandler.handleAPIError(mockResponse, matrixErrorBody);
      
      expect(result.error.code).toBe('AUTH_EXPIRED');
      expect(result.error.message).toBe('Session has expired');
      expect(result.error.details).toEqual(matrixErrorBody);
    });

    it('should handle Matrix API response without error body', () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error'
      } as Response;
      
      const result = errorHandler.handleAPIError(mockResponse);
      
      expect(result).toEqual({
        error: {
          code: 'MATRIX_API_ERROR',
          message: 'Matrix API error: 500 Internal Server Error',
          timestamp: fixedTimestamp
        },
        httpStatus: 500,
        requestId: 'test-request-id-123'
      });
    });

    it('should handle non-object error body', () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found'
      } as Response;
      
      const result = errorHandler.handleAPIError(mockResponse, 'Simple error message');
      
      expect(result.error.details).toBe('Simple error message');
      expect(result.error.message).toBe('Matrix API error: 404 Not Found');
    });
  });

  describe('handleNetworkError', () => {
    it('should classify AbortError as REQUEST_TIMEOUT', () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      
      const result = errorHandler.handleNetworkError(abortError);
      
      expect(result).toEqual({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout after 5000ms',
          timestamp: fixedTimestamp,
          details: {
            name: 'AbortError',
            message: 'The operation was aborted'
          }
        },
        httpStatus: 408,
        requestId: 'test-request-id-123'
      });
    });

    it('should classify DNS errors correctly', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
      
      const result = errorHandler.handleNetworkError(dnsError);
      
      expect(result.error.code).toBe('DNS_ERROR');
      expect(result.error.message).toBe('DNS resolution failed');
      expect(result.httpStatus).toBe(503);
    });

    it('should classify connection refused errors', () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:8080');
      
      const result = errorHandler.handleNetworkError(connError);
      
      expect(result.error.code).toBe('CONNECTION_REFUSED');
      expect(result.error.message).toBe('Connection refused by server');
      expect(result.httpStatus).toBe(503);
    });

    it('should classify connection timeout errors', () => {
      const timeoutError = new Error('connect ETIMEDOUT 192.168.1.1:443');
      
      const result = errorHandler.handleNetworkError(timeoutError);
      
      expect(result.error.code).toBe('CONNECTION_TIMEOUT');
      expect(result.error.message).toBe('Connection timeout');
      expect(result.httpStatus).toBe(408);
    });

    it('should preserve original error message for other network errors', () => {
      const networkError = new Error('Socket hang up');
      
      const result = errorHandler.handleNetworkError(networkError);
      
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toBe('Socket hang up');
      expect(result.httpStatus).toBe(503);
    });

    it('should handle error with no message', () => {
      const error = new Error();
      
      const result = errorHandler.handleNetworkError(error);
      
      expect(result.error.message).toBe('Network connection failed');
    });
  });

  describe('error sanitization', () => {
    it('should remove sensitive properties from error objects', () => {
      const errorWithSensitiveData = {
        message: 'Request failed',
        password: 'secret123',
        token: 'bearer-token',
        username: 'testuser',
        data: 'some data'
      };
      
      const result = errorHandler.handleError(errorWithSensitiveData, 'SYSTEM_ERROR');
      
      const details = result.error.details as Record<string, unknown>;
      expect(details).toHaveProperty('message');
      expect(details).toHaveProperty('data');
      expect(details).not.toHaveProperty('password');
      expect(details).not.toHaveProperty('token');
      expect(details).not.toHaveProperty('username');
    });

    it('should sanitize Error objects properly', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      const result = errorHandler.handleError(error, 'SYSTEM_ERROR');
      
      const details = result.error.details as Record<string, unknown>;
      expect(details).toEqual({
        name: 'Error',
        message: 'Test error'
      });
      expect(details).not.toHaveProperty('stack');
    });

    it('should handle non-object, non-Error values', () => {
      const result = errorHandler.handleError('simple string error', 'SYSTEM_ERROR');
      
      expect(result.error.details).toBe('simple string error');
    });
  });

  describe('error message extraction', () => {
    it('should extract message from Error objects', () => {
      const error = new Error('Custom error message');
      
      const result = errorHandler.handleError(error, 'VALIDATION_ERROR');
      
      expect(result.error.message).toBe('Custom error message');
    });

    it('should extract message from string errors', () => {
      const result = errorHandler.handleError('String error message', 'VALIDATION_ERROR');
      
      expect(result.error.message).toBe('String error message');
    });

    it('should extract message from objects with message property', () => {
      const errorObj = { message: 'Object error message', code: 'ERR001' };
      
      const result = errorHandler.handleError(errorObj, 'VALIDATION_ERROR');
      
      expect(result.error.message).toBe('Object error message');
    });

    it('should use default message when extraction fails', () => {
      const errorObj = { code: 'ERR001', data: 'no message prop' };
      
      const result = errorHandler.handleError(errorObj, 'VALIDATION_ERROR');
      
      expect(result.error.message).toBe('Validation failed');
    });
  });

  describe('request ID and timestamp', () => {
    it('should include unique request ID in all error responses', () => {
      const error = new Error('Test error');
      
      const result1 = errorHandler.handleError(error, 'SYSTEM_ERROR');
      const result2 = errorHandler.handleError(error, 'API_ERROR');
      
      expect(result1.requestId).toBe('test-request-id-123');
      expect(result2.requestId).toBe('test-request-id-123');
    });

    it('should include timestamp in all error responses', () => {
      const error = new Error('Test error');
      
      const result = errorHandler.handleError(error, 'SYSTEM_ERROR');
      
      expect(result.error.timestamp).toBe(fixedTimestamp);
    });
  });

  describe('pass-through policy compliance', () => {
    it('should preserve Matrix API error structure without modification', () => {
      const mockResponse = {
        status: 409,
        statusText: 'Conflict'
      } as Response;
      
      const originalMatrixError = {
        errorCode: 'BOOKING_CONFLICT',
        message: 'The requested time slot conflicts with an existing booking',
        details: {
          conflictingBookingId: 'B123456',
          suggestedAlternatives: ['10:00-11:00', '14:00-15:00']
        }
      };
      
      const result = errorHandler.handleAPIError(mockResponse, originalMatrixError);
      
      // Verify the original structure is preserved in details
      expect(result.error.details).toEqual(originalMatrixError);
      // Verify Matrix error properties are extracted but original is preserved
      expect(result.error.code).toBe('BOOKING_CONFLICT');
      expect(result.error.message).toBe('The requested time slot conflicts with an existing booking');
      // Verify HTTP status is preserved
      expect(result.httpStatus).toBe(409);
    });
  });
});