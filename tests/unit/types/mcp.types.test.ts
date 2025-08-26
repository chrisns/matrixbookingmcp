import { describe, it, expect } from 'vitest';
import type { 
  IMCPRequest, 
  IMCPResponse, 
  IMCPServer, 
  ITransport, 
  MCPMethod, 
  IMCPHandler 
} from '../../../src/types/mcp.types.js';

describe('MCP Types', () => {
  describe('IMCPRequest interface', () => {
    it('should define correct MCP request structure', () => {
      const request: IMCPRequest = {
        method: 'matrix_booking/check_availability',
        params: {
          dateFrom: '2024-01-01T09:00:00Z',
          dateTo: '2024-01-01T17:00:00Z',
          locationId: 123
        },
        id: 'req-123'
      };

      expect(request).toHaveProperty('method');
      expect(request).toHaveProperty('params');
      expect(request).toHaveProperty('id');
      expect(typeof request.method).toBe('string');
      expect(typeof request.params).toBe('object');
      expect(typeof request.id).toBe('string');
    });

    it('should handle optional properties', () => {
      const minimalRequest: IMCPRequest = {
        method: 'matrix_booking/get_location'
      };

      expect(minimalRequest.params).toBeUndefined();
      expect(minimalRequest.id).toBeUndefined();
      expect(minimalRequest.method).toBe('matrix_booking/get_location');
    });

    it('should handle numeric id', () => {
      const requestWithNumericId: IMCPRequest = {
        method: 'matrix_booking/create_booking',
        id: 456
      };

      expect(typeof requestWithNumericId.id).toBe('number');
      expect(requestWithNumericId.id).toBe(456);
    });

    it('should handle complex params object', () => {
      const complexRequest: IMCPRequest = {
        method: 'matrix_booking/create_booking',
        params: {
          timeFrom: '2024-01-01T09:00:00Z',
          timeTo: '2024-01-01T10:00:00Z',
          locationId: 123,
          attendees: [
            { email: 'test@example.com', name: 'Test User' }
          ],
          extraRequests: ['projector'],
          owner: {
            id: 1,
            email: 'owner@example.com',
            name: 'Owner'
          }
        },
        id: 'complex-req-789'
      };

      expect(complexRequest.params).toBeDefined();
      expect(Array.isArray(complexRequest.params?.['attendees'])).toBe(true);
      expect(Array.isArray(complexRequest.params?.['extraRequests'])).toBe(true);
    });
  });

  describe('IMCPResponse interface', () => {
    it('should define correct MCP response structure for success', () => {
      const successResponse: IMCPResponse = {
        result: {
          available: true,
          slots: [
            {
              from: '2024-01-01T09:00:00Z',
              to: '2024-01-01T10:00:00Z',
              available: true,
              locationId: 123
            }
          ],
          location: {
            id: 123,
            name: 'Conference Room A'
          }
        },
        id: 'req-123'
      };

      expect(successResponse).toHaveProperty('result');
      expect(successResponse).toHaveProperty('id');
      expect(successResponse.error).toBeUndefined();
      expect(typeof successResponse.result).toBe('object');
    });

    it('should define correct MCP response structure for error', () => {
      const errorResponse: IMCPResponse = {
        error: {
          code: -32602,
          message: 'Invalid params',
          data: { field: 'locationId', issue: 'required' }
        },
        id: 'req-456'
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('id');
      expect(errorResponse.result).toBeUndefined();
      expect(typeof errorResponse.error?.code).toBe('number');
      expect(typeof errorResponse.error?.message).toBe('string');
    });

    it('should handle optional properties', () => {
      const responseWithoutId: IMCPResponse = {
        result: { success: true }
      };

      const responseWithoutResult: IMCPResponse = {
        error: {
          code: -32600,
          message: 'Invalid request'
        }
      };

      expect(responseWithoutId.id).toBeUndefined();
      expect(responseWithoutResult.result).toBeUndefined();
    });

    it('should handle various error codes and data types', () => {
      const parseError: IMCPResponse = {
        error: {
          code: -32700,
          message: 'Parse error'
        }
      };

      const methodNotFound: IMCPResponse = {
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: 'unknown_method' }
        },
        id: 'req-789'
      };

      const internalError: IMCPResponse = {
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Database connection failed'
        },
        id: 123
      };

      expect(parseError.error?.code).toBe(-32700);
      expect(methodNotFound.error?.code).toBe(-32601);
      expect(internalError.error?.code).toBe(-32603);
      expect(typeof methodNotFound.error?.data).toBe('object');
      expect(typeof internalError.error?.data).toBe('string');
    });
  });

  describe('MCPMethod type', () => {
    it('should define all expected MCP methods', () => {
      const checkAvailability: MCPMethod = 'matrix_booking/check_availability';
      const createBooking: MCPMethod = 'matrix_booking/create_booking';
      const getLocation: MCPMethod = 'matrix_booking/get_location';

      expect(checkAvailability).toBe('matrix_booking/check_availability');
      expect(createBooking).toBe('matrix_booking/create_booking');
      expect(getLocation).toBe('matrix_booking/get_location');
    });

    it('should restrict to only defined methods', () => {
      // TypeScript compilation test - this should cause a type error if uncommented
      // const invalidMethod: MCPMethod = 'invalid/method';

      const validMethods: MCPMethod[] = [
        'matrix_booking/check_availability',
        'matrix_booking/create_booking',
        'matrix_booking/get_location'
      ];

      expect(validMethods).toHaveLength(3);
      validMethods.forEach(method => {
        expect(typeof method).toBe('string');
        expect(method.startsWith('matrix_booking/')).toBe(true);
      });
    });
  });

  describe('IMCPHandler type', () => {
    it('should define handler function signature', () => {
      const availabilityHandler: IMCPHandler = async (_params) => {
        return {
          available: true,
          slots: [],
          location: { id: 1, name: 'Test Room' }
        };
      };

      const bookingHandler: IMCPHandler<any, { id: number }> = async (_params) => {
        return { id: 123 };
      };

      expect(typeof availabilityHandler).toBe('function');
      expect(typeof bookingHandler).toBe('function');
    });

    it('should handle typed parameters and results', async () => {
      interface AvailabilityParams {
        dateFrom: string;
        dateTo: string;
        locationId?: number;
      }

      interface AvailabilityResult {
        available: boolean;
        slots: Array<{
          from: string;
          to: string;
          available: boolean;
          locationId: number;
        }>;
      }

      const typedHandler: IMCPHandler<AvailabilityParams, AvailabilityResult> = async (params) => {
        return {
          available: true,
          slots: [
            {
              from: params.dateFrom,
              to: params.dateTo,
              available: true,
              locationId: params.locationId || 1
            }
          ]
        };
      };

      const result = await typedHandler({
        dateFrom: '2024-01-01T09:00:00Z',
        dateTo: '2024-01-01T10:00:00Z',
        locationId: 123
      });

      expect(result.available).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].locationId).toBe(123);
    });
  });

  describe('IMCPServer interface', () => {
    it('should define all required MCP server methods', async () => {
      class MockMCPServer implements IMCPServer {
        private handlers: Map<string, IMCPHandler> = new Map();
        private _running = false;

        async start(): Promise<void> {
          this._running = true;
        }

        async stop(): Promise<void> {
          this._running = false;
        }

        async handleRequest(request: IMCPRequest): Promise<IMCPResponse> {
          const handler = this.handlers.get(request.method);
          if (!handler) {
            return {
              error: {
                code: -32601,
                message: 'Method not found'
              },
              id: request.id || undefined
            };
          }

          try {
            const result = await handler(request.params);
            return {
              result,
              id: request.id || undefined
            };
          } catch (error) {
            return {
              error: {
                code: -32603,
                message: 'Internal error',
                data: error instanceof Error ? error.message : 'Unknown error'
              },
              id: request.id || undefined
            };
          }
        }

        registerHandler(method: string, handler: IMCPHandler): void {
          this.handlers.set(method, handler);
        }
      }

      const server = new MockMCPServer();

      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
      expect(typeof server.handleRequest).toBe('function');
      expect(typeof server.registerHandler).toBe('function');

      // Test functionality
      await server.start();
      
      server.registerHandler('test/method', async () => ({ success: true }));
      
      const response = await server.handleRequest({
        method: 'test/method',
        id: 'test-1'
      });

      expect(response.result).toEqual({ success: true });
      expect(response.id).toBe('test-1');

      await server.stop();
    });
  });

  describe('ITransport interface', () => {
    it('should define all required transport methods', async () => {
      class MockTransport implements ITransport {
        private messageCallback?: (message: IMCPRequest) => void;
        private closed = false;

        async send(message: IMCPResponse): Promise<void> {
          if (this.closed) {
            throw new Error('Transport is closed');
          }
          // Mock sending message
        }

        onMessage(callback: (message: IMCPRequest) => void): void {
          this.messageCallback = callback;
        }

        async close(): Promise<void> {
          this.closed = true;
          this.messageCallback = undefined as any;
        }

        // Test helper method
        simulateMessage(message: IMCPRequest): void {
          if (this.messageCallback) {
            this.messageCallback(message);
          }
        }
      }

      const transport = new MockTransport();

      expect(typeof transport.send).toBe('function');
      expect(typeof transport.onMessage).toBe('function');
      expect(typeof transport.close).toBe('function');

      // Test functionality
      let receivedMessage: IMCPRequest | null = null;
      transport.onMessage((message) => {
        receivedMessage = message;
      });

      const testMessage: IMCPRequest = {
        method: 'test/method',
        params: { test: true },
        id: 'msg-1'
      };

      transport.simulateMessage(testMessage);
      expect(receivedMessage).toEqual(testMessage);

      const response: IMCPResponse = {
        result: { success: true },
        id: 'msg-1'
      };

      await expect(transport.send(response)).resolves.toBeUndefined();
      
      await transport.close();
      await expect(transport.send(response)).rejects.toThrow('Transport is closed');
    });
  });
});