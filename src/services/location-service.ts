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
      
      // Validate location ID
      if (!this.validateLocationId(locationId)) {
        throw new Error(`Invalid location ID: ${locationId}. Location ID must be a positive integer.`);
      }
      
      // Get credentials from authentication manager
      const credentials = await this.authManager.getCredentials();
      
      // Call the Matrix API through the API client
      const location = await this.apiClient.getLocation(locationId, credentials);
      
      return location;
      
    } catch (error) {
      
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
      
      const config = this.configManager.getConfig();
      const preferredLocationString = config.matrixPreferredLocation;
      const preferredLocationId = parseInt(preferredLocationString, 10);
      
      if (isNaN(preferredLocationId)) {
        throw new Error(`Invalid MATRIX_PREFERED_LOCATION: '${preferredLocationString}' is not a valid number`);
      }
      
      
      // Use the getLocation method to retrieve the preferred location
      return await this.getLocation(preferredLocationId);
      
    } catch (error) {
      
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
    
    // Use centralized validator for consistency
    const validationResult = this.validator.validateLocationId(locationId);
    
    if (!validationResult.isValid) {
    }
    
    return validationResult.isValid;
  }

  async getLocationHierarchy(request?: ILocationQueryRequest): Promise<ILocationHierarchyResponse> {
    try {
      
      // Get credentials from authentication manager
      const credentials = await this.authManager.getCredentials();
      
      // Use default request if none provided
      const queryRequest = request || {};
      
      // Call the Matrix API through the API client
      const hierarchy = await this.apiClient.getLocationHierarchy(queryRequest, credentials);
      
      return hierarchy;
      
    } catch (error) {
      
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
      
      // Validate kind parameter
      if (!kind || typeof kind !== 'string' || kind.trim().length === 0) {
        throw new Error('Invalid kind parameter: must be a non-empty string');
      }
      
      // Get location hierarchy - don't pass kind as a filter to API
      const queryRequest: ILocationQueryRequest = {
        includeFacilities: true,
        includeChildren: true
      };
      
      const hierarchy = await this.getLocationHierarchy(queryRequest);
      
      // Filter the results by kind locally
      const filteredLocations = hierarchy.locations.filter(
        (location: ILocation) => location.kind === kind.trim()
      );
      
      return filteredLocations;
      
    } catch (error) {
      
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