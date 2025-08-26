/**
 * MCP server and transport interfaces
 */
/* eslint-disable no-unused-vars */

export interface IMCPRequest {
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

export interface IMCPResponse<T = unknown> {
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id?: string | number;
}

export interface IMCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  handleRequest(_request: IMCPRequest): Promise<IMCPResponse>;
  registerHandler(_method: string, _handler: IMCPHandler): void;
}

export interface ITransport {
  send(_message: IMCPResponse): Promise<void>;
  onMessage(_callback: (message: IMCPRequest) => void): void;
  close(): Promise<void>;
}

export type MCPMethod = 
  | 'matrix_booking/check_availability'
  | 'matrix_booking/create_booking'
  | 'matrix_booking/get_location';

export interface IMCPHandler<TParams = unknown, TResult = unknown> {
  (_params: TParams): Promise<TResult>;
}