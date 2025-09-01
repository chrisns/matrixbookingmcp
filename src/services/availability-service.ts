import { IAvailabilityService, IAvailabilityRequest, IAvailabilityResponse } from '../types/availability.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IAuthenticationManager } from '../types/authentication.types.js';

export class AvailabilityService implements IAvailabilityService {
  private apiClient: IMatrixAPIClient;
  private configManager: IConfigurationManager;
  private authManager: IAuthenticationManager;

  constructor(
    apiClient: IMatrixAPIClient,
    configManager: IConfigurationManager,
    authManager: IAuthenticationManager
  ) {
    this.apiClient = apiClient;
    this.configManager = configManager;
    this.authManager = authManager;
  }

  async checkAvailability(request: IAvailabilityRequest): Promise<IAvailabilityResponse> {
    try {
      
      // Get credentials
      const credentials = await this.authManager.getCredentials();
      
      // Call API
      const response = await this.apiClient.checkAvailability(request, credentials);
      
      return response;
      
    } catch (error) {
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to check availability');
    }
  }

  async checkAvailabilitySimple(
    locationId: number,
    dateFrom: string,
    dateTo: string,
    bookingCategory?: number
  ): Promise<IAvailabilityResponse> {
    const request: IAvailabilityRequest = {
      locationId,
      dateFrom,
      dateTo
    };
    
    const defaultCategory = bookingCategory || this.configManager.getConfig().defaultBookingCategory;
    if (defaultCategory) {
      request.bookingCategory = defaultCategory;
    }
    
    return this.checkAvailability(request);
  }

  formatAvailabilityRequest(request: Partial<IAvailabilityRequest>): IAvailabilityRequest {
    // Provide defaults for missing fields
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const result: IAvailabilityRequest = {
      locationId: request.locationId || 1000001, // Default location
      dateFrom: request.dateFrom || now.toISOString(),
      dateTo: request.dateTo || tomorrow.toISOString()
    };
    
    const category = request.bookingCategory || this.configManager.getConfig().defaultBookingCategory;
    if (category) {
      result.bookingCategory = category;
    }
    
    return result;
  }
}