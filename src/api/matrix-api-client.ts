import { IMatrixAPIClient, IAPIRequest, IAPIResponse } from '../types/api.types.js';
import { ICredentials } from '../types/authentication.types.js';
import { IAvailabilityRequest, IAvailabilityResponse } from '../types/availability.types.js';
import { IBookingRequest, IBookingResponse } from '../types/booking.types.js';
import { ILocation } from '../types/location.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';

export class MatrixAPIClient implements IMatrixAPIClient {
  private authManager: IAuthenticationManager;
  private configManager: IConfigurationManager;
  private errorHandler: IErrorHandler;

  constructor(authManager: IAuthenticationManager, configManager: IConfigurationManager, errorHandler?: IErrorHandler) {
    this.authManager = authManager;
    this.configManager = configManager;
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  async checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'POST',
      url: `${config.apiBaseUrl}/availability`,
      headers,
      body: request
    };

    const response = await this.makeRequest<IAvailabilityResponse>(apiRequest);
    return response.data;
  }

  async createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'POST',
      url: `${config.apiBaseUrl}/booking`,
      headers,
      body: request
    };

    const response = await this.makeRequest<IBookingResponse>(apiRequest);
    return response.data;
  }

  async getLocation(locationId: number, credentials: ICredentials): Promise<ILocation> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url: `${config.apiBaseUrl}/location/${locationId}`,
      headers
    };

    const response = await this.makeRequest<ILocation>(apiRequest);
    return response.data;
  }

  async makeRequest<T>(request: IAPIRequest): Promise<IAPIResponse<T>> {
    const config = this.configManager.getConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: controller.signal
      };

      if (request.body !== undefined) {
        fetchOptions.body = JSON.stringify(request.body);
      }

      const response = await globalThis.fetch(request.url, fetchOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json() as T;
      } else {
        data = await response.text() as T;
      }

      if (!response.ok) {
        // Use ErrorHandler to handle API errors with pass-through policy
        const errorResponse = this.errorHandler.handleAPIError(response, data);
        const error = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
        error.errorResponse = errorResponse;
        throw error;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        // Check if this is already a handled error response
        const errorWithResponse = error as Error & { errorResponse?: unknown };
        if (errorWithResponse.errorResponse) {
          throw error;
        }
        
        if (error.name === 'AbortError') {
          const errorResponse = this.errorHandler.handleTimeout();
          const timeoutError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
          timeoutError.errorResponse = errorResponse;
          throw timeoutError;
        }
        
        // Handle as network error
        const errorResponse = this.errorHandler.handleNetworkError(error);
        const networkError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
        networkError.errorResponse = errorResponse;
        throw networkError;
      }
      
      // Handle unknown errors
      const errorResponse = this.errorHandler.handleError(error, 'SYSTEM_ERROR');
      const systemError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      systemError.errorResponse = errorResponse;
      throw systemError;
    }
  }
}