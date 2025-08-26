import { describe, it, expect } from 'vitest';
import type { 
  IAPIError, 
  IErrorResponse, 
  ErrorType, 
  IErrorHandler 
} from '../../../src/types/error.types.js';

describe('Error Types', () => {
  describe('IAPIError interface', () => {
    it('should define correct API error structure', () => {
      const apiError: IAPIError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: { field: 'locationId', issue: 'required' },
        timestamp: '2024-01-01T12:00:00Z'
      };

      expect(apiError).toHaveProperty('code');
      expect(apiError).toHaveProperty('message');
      expect(apiError).toHaveProperty('details');
      expect(apiError).toHaveProperty('timestamp');
      expect(typeof apiError.code).toBe('string');
      expect(typeof apiError.message).toBe('string');
      expect(typeof apiError.timestamp).toBe('string');
    });

    it('should handle optional details property', () => {
      const simpleError: IAPIError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        timestamp: new Date().toISOString()
      };

      expect(simpleError.details).toBeUndefined();
      expect(simpleError.code).toBe('NETWORK_ERROR');
    });

    it('should handle various detail types', () => {
      const stringDetailsError: IAPIError = {
        code: 'ERROR_1',
        message: 'Error with string details',
        details: 'Additional info',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const objectDetailsError: IAPIError = {
        code: 'ERROR_2',
        message: 'Error with object details',
        details: { field: 'test', value: 123 },
        timestamp: '2024-01-01T12:00:00Z'
      };

      const arrayDetailsError: IAPIError = {
        code: 'ERROR_3',
        message: 'Error with array details',
        details: ['error1', 'error2'],
        timestamp: '2024-01-01T12:00:00Z'
      };

      expect(typeof stringDetailsError.details).toBe('string');
      expect(typeof objectDetailsError.details).toBe('object');
      expect(Array.isArray(arrayDetailsError.details)).toBe(true);
    });
  });

  describe('IErrorResponse interface', () => {
    it('should define correct error response structure', () => {
      const apiError: IAPIError = {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const errorResponse: IErrorResponse = {
        error: apiError,
        httpStatus: 401,
        requestId: 'req-123-456'
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('httpStatus');
      expect(errorResponse).toHaveProperty('requestId');
      expect(typeof errorResponse.error).toBe('object');
      expect(typeof errorResponse.httpStatus).toBe('number');
      expect(typeof errorResponse.requestId).toBe('string');
    });

    it('should handle optional requestId property', () => {
      const apiError: IAPIError = {
        code: 'TIMEOUT',
        message: 'Request timed out',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const errorResponse: IErrorResponse = {
        error: apiError,
        httpStatus: 408
      };

      expect(errorResponse.requestId).toBeUndefined();
      expect(errorResponse.httpStatus).toBe(408);
    });

    it('should handle various HTTP status codes', () => {
      const baseError: IAPIError = {
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const responses = [
        { error: baseError, httpStatus: 400 }, // Bad Request
        { error: baseError, httpStatus: 401 }, // Unauthorized
        { error: baseError, httpStatus: 403 }, // Forbidden
        { error: baseError, httpStatus: 404 }, // Not Found
        { error: baseError, httpStatus: 408 }, // Request Timeout
        { error: baseError, httpStatus: 500 }, // Internal Server Error
        { error: baseError, httpStatus: 502 }, // Bad Gateway
        { error: baseError, httpStatus: 503 }  // Service Unavailable
      ];

      responses.forEach(response => {
        const errorResponse: IErrorResponse = response;
        expect(errorResponse.httpStatus).toBeGreaterThanOrEqual(400);
        expect(errorResponse.httpStatus).toBeLessThan(600);
      });
    });
  });

  describe('ErrorType type', () => {
    it('should define all expected error types', () => {
      const networkError: ErrorType = 'NETWORK_ERROR';
      const timeoutError: ErrorType = 'TIMEOUT_ERROR';
      const authError: ErrorType = 'AUTHENTICATION_ERROR';
      const validationError: ErrorType = 'VALIDATION_ERROR';
      const apiError: ErrorType = 'API_ERROR';
      const systemError: ErrorType = 'SYSTEM_ERROR';

      expect(networkError).toBe('NETWORK_ERROR');
      expect(timeoutError).toBe('TIMEOUT_ERROR');
      expect(authError).toBe('AUTHENTICATION_ERROR');
      expect(validationError).toBe('VALIDATION_ERROR');
      expect(apiError).toBe('API_ERROR');
      expect(systemError).toBe('SYSTEM_ERROR');
    });

    it('should restrict to only defined error types', () => {
      // TypeScript compilation test - this should cause a type error if uncommented
      // const invalidError: ErrorType = 'INVALID_ERROR_TYPE';

      const validErrors: ErrorType[] = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'AUTHENTICATION_ERROR',
        'VALIDATION_ERROR',
        'API_ERROR',
        'SYSTEM_ERROR'
      ];

      expect(validErrors).toHaveLength(6);
      validErrors.forEach(errorType => {
        expect(typeof errorType).toBe('string');
      });
    });
  });

  describe('IErrorHandler interface', () => {
    it('should define all required error handling methods', () => {
      class MockErrorHandler implements IErrorHandler {
        handleError(_error: unknown, type: ErrorType): IErrorResponse {
          return {
            error: {
              code: type,
              message: _error instanceof Error ? _error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            },
            httpStatus: this.getStatusCodeForType(type)
          };
        }

        handleTimeout(): IErrorResponse {
          return {
            error: {
              code: 'TIMEOUT_ERROR',
              message: 'Request timed out',
              timestamp: new Date().toISOString()
            },
            httpStatus: 408
          };
        }

        handleAPIError(response: Response, body?: any): IErrorResponse {
          return {
            error: {
              code: 'API_ERROR',
              message: `API error: ${response.status} ${response.statusText}`,
              details: body,
              timestamp: new Date().toISOString()
            },
            httpStatus: response.status
          };
        }

        handleNetworkError(error: Error): IErrorResponse {
          return {
            error: {
              code: 'NETWORK_ERROR',
              message: error.message,
              timestamp: new Date().toISOString()
            },
            httpStatus: 503
          };
        }

        private getStatusCodeForType(type: ErrorType): number {
          switch (type) {
            case 'AUTHENTICATION_ERROR': return 401;
            case 'VALIDATION_ERROR': return 400;
            case 'TIMEOUT_ERROR': return 408;
            case 'NETWORK_ERROR': return 503;
            case 'API_ERROR': return 502;
            case 'SYSTEM_ERROR': return 500;
            default: return 500;
          }
        }
      }

      const errorHandler = new MockErrorHandler();

      expect(typeof errorHandler.handleError).toBe('function');
      expect(typeof errorHandler.handleTimeout).toBe('function');
      expect(typeof errorHandler.handleAPIError).toBe('function');
      expect(typeof errorHandler.handleNetworkError).toBe('function');
    });

    it('should return correct error responses from methods', () => {
      class TestErrorHandler implements IErrorHandler {
        handleError(_error: unknown, type: ErrorType): IErrorResponse {
          return {
            error: {
              code: type,
              message: 'Handled error',
              timestamp: '2024-01-01T12:00:00Z'
            },
            httpStatus: 500
          };
        }

        handleTimeout(): IErrorResponse {
          return {
            error: {
              code: 'TIMEOUT_ERROR',
              message: 'Operation timed out after 5 seconds',
              timestamp: '2024-01-01T12:00:00Z'
            },
            httpStatus: 408
          };
        }

        handleAPIError(response: Response, body?: any): IErrorResponse {
          return {
            error: {
              code: 'API_ERROR',
              message: `Matrix API returned ${response.status}`,
              details: body,
              timestamp: '2024-01-01T12:00:00Z'
            },
            httpStatus: response.status
          };
        }

        handleNetworkError(error: Error): IErrorResponse {
          return {
            error: {
              code: 'NETWORK_ERROR',
              message: `Network failure: ${error.message}`,
              timestamp: '2024-01-01T12:00:00Z'
            },
            httpStatus: 503
          };
        }
      }

      const handler = new TestErrorHandler();
      
      const genericError = handler.handleError(new Error('test'), 'SYSTEM_ERROR');
      expect(genericError.error.code).toBe('SYSTEM_ERROR');
      expect(genericError.httpStatus).toBe(500);

      const timeoutError = handler.handleTimeout();
      expect(timeoutError.error.code).toBe('TIMEOUT_ERROR');
      expect(timeoutError.httpStatus).toBe(408);

      const mockResponse = { status: 404, statusText: 'Not Found' } as Response;
      const apiError = handler.handleAPIError(mockResponse, { errorDetails: 'test' });
      expect(apiError.error.code).toBe('API_ERROR');
      expect(apiError.httpStatus).toBe(404);
      expect(apiError.error.details).toEqual({ errorDetails: 'test' });

      const networkError = handler.handleNetworkError(new Error('Connection refused'));
      expect(networkError.error.code).toBe('NETWORK_ERROR');
      expect(networkError.httpStatus).toBe(503);
      expect(networkError.error.message).toContain('Connection refused');
    });
  });
});