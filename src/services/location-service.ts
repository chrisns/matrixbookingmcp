import { ILocationService, ILocation } from '../types/location.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';
import { InputValidator } from '../validation/index.js';
import { IInputValidator } from '../types/validation.types.js';

export class LocationService implements ILocationService {
  private apiClient: IMatrixAPIClient;
  private configManager: IConfigurationManager;
  private authManager: IAuthenticationManager;
  private errorHandler: IErrorHandler;
  private validator: IInputValidator;
  constructor(
    apiClient: IMatrixAPIClient,
    configManager: IConfigurationManager,
    authManager: IAuthenticationManager,
    errorHandler?: IErrorHandler,
    validator?: IInputValidator
  ) {
    this.apiClient = apiClient;
    this.configManager = configManager;
    this.authManager = authManager;
    this.errorHandler = errorHandler || new ErrorHandler();
    this.validator = validator || new InputValidator();
  }

  async getLocation(locationId: number): Promise<ILocation> {
    try {
      console.log('LocationService: Getting location with ID:', locationId);
      
      // Validate location ID
      if (!this.validateLocationId(locationId)) {
        throw new Error(`Invalid location ID: ${locationId}. Location ID must be a positive integer.`);
      }
      
      // Get credentials from authentication manager
      const credentials = this.authManager.getCredentials();
      
      // Call the Matrix API through the API client
      const location = await this.apiClient.getLocation(locationId, credentials);
      
      console.log('LocationService: Retrieved location:', location);
      return location;
      
    } catch (error) {
      console.log('LocationService: Error getting location:', error);
      
      // Pass-through error handling - let the error bubble up
      if (error instanceof Error) {
        throw error;
      }
      
      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'LOCATION_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  async getPreferredLocation(): Promise<ILocation> {
    try {
      console.log('LocationService: Getting preferred location from configuration');
      
      const config = this.configManager.getConfig();
      const preferredLocationString = config.matrixPreferredLocation;
      const preferredLocationId = parseInt(preferredLocationString, 10);
      
      if (isNaN(preferredLocationId)) {
        throw new Error(`Invalid MATRIX_PREFERED_LOCATION: '${preferredLocationString}' is not a valid number`);
      }
      
      console.log('LocationService: Using preferred location ID:', preferredLocationId);
      
      // Use the getLocation method to retrieve the preferred location
      return await this.getLocation(preferredLocationId);
      
    } catch (error) {
      console.log('LocationService: Error getting preferred location:', error);
      
      // Pass-through error handling - let the error bubble up
      if (error instanceof Error) {
        throw error;
      }
      
      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'LOCATION_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  validateLocationId(locationId: number): boolean {
    console.log('LocationService: Validating location ID:', locationId);
    
    // Use centralized validator for consistency
    const validationResult = this.validator.validateLocationId(locationId);
    
    console.log('LocationService: Location ID validation result:', validationResult.isValid);
    if (!validationResult.isValid) {
      console.log('LocationService: Validation errors:', validationResult.errors);
    }
    
    return validationResult.isValid;
  }
}