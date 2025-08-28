import { ILocationService, ILocation, ILocationHierarchyResponse, ILocationQueryRequest } from '../types/location.types.js';
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
      console.error('LocationService: Getting location with ID:', locationId);
      
      // Validate location ID
      if (!this.validateLocationId(locationId)) {
        throw new Error(`Invalid location ID: ${locationId}. Location ID must be a positive integer.`);
      }
      
      // Get credentials from authentication manager
      const credentials = this.authManager.getCredentials();
      
      // Call the Matrix API through the API client
      const location = await this.apiClient.getLocation(locationId, credentials);
      
      console.error('LocationService: Retrieved location:', location);
      return location;
      
    } catch (error) {
      console.error('LocationService: Error getting location:', error);
      
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
      console.error('LocationService: Getting preferred location from configuration');
      
      const config = this.configManager.getConfig();
      const preferredLocationString = config.matrixPreferredLocation;
      const preferredLocationId = parseInt(preferredLocationString, 10);
      
      if (isNaN(preferredLocationId)) {
        throw new Error(`Invalid MATRIX_PREFERED_LOCATION: '${preferredLocationString}' is not a valid number`);
      }
      
      console.error('LocationService: Using preferred location ID:', preferredLocationId);
      
      // Use the getLocation method to retrieve the preferred location
      return await this.getLocation(preferredLocationId);
      
    } catch (error) {
      console.error('LocationService: Error getting preferred location:', error);
      
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
    console.error('LocationService: Validating location ID:', locationId);
    
    // Use centralized validator for consistency
    const validationResult = this.validator.validateLocationId(locationId);
    
    console.error('LocationService: Location ID validation result:', validationResult.isValid);
    if (!validationResult.isValid) {
      console.error('LocationService: Validation errors:', validationResult.errors);
    }
    
    return validationResult.isValid;
  }

  async getLocationHierarchy(request?: ILocationQueryRequest): Promise<ILocationHierarchyResponse> {
    try {
      console.error('LocationService: Getting location hierarchy with request:', request);
      
      // Get credentials from authentication manager
      const credentials = this.authManager.getCredentials();
      
      // Use default request if none provided
      const queryRequest = request || {};
      
      // Call the Matrix API through the API client
      const hierarchy = await this.apiClient.getLocationHierarchy(queryRequest, credentials);
      
      console.error('LocationService: Retrieved location hierarchy:', hierarchy);
      return hierarchy;
      
    } catch (error) {
      console.error('LocationService: Error getting location hierarchy:', error);
      
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

  async getLocationsByKind(kind: string): Promise<ILocation[]> {
    try {
      console.error('LocationService: Getting locations by kind:', kind);
      
      // Validate kind parameter
      if (!kind || typeof kind !== 'string' || kind.trim().length === 0) {
        throw new Error('Invalid kind parameter: must be a non-empty string');
      }
      
      // Get location hierarchy filtered by kind
      const queryRequest: ILocationQueryRequest = {
        kind: kind.trim(),
        includeFacilities: true,
        includeChildren: true
      };
      
      const hierarchy = await this.getLocationHierarchy(queryRequest);
      
      console.error('LocationService: Retrieved locations by kind:', hierarchy.locations);
      return hierarchy.locations;
      
    } catch (error) {
      console.error('LocationService: Error getting locations by kind:', error);
      
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
}