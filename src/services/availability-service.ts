import { IAvailabilityService, IAvailabilityRequest, IAvailabilityResponse } from '../types/availability.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';
import { InputValidator, InputSanitizer } from '../validation/index.js';
import { IInputValidator, IInputSanitizer } from '../types/validation.types.js';

export class AvailabilityService implements IAvailabilityService {
  private apiClient: IMatrixAPIClient;
  private configManager: IConfigurationManager;
  private authManager: IAuthenticationManager;
  private errorHandler: IErrorHandler;
  private validator: IInputValidator;
  private sanitizer: IInputSanitizer;

  constructor(
    apiClient: IMatrixAPIClient,
    configManager: IConfigurationManager,
    authManager: IAuthenticationManager,
    errorHandler?: IErrorHandler,
    validator?: IInputValidator,
    sanitizer?: IInputSanitizer
  ) {
    this.apiClient = apiClient;
    this.configManager = configManager;
    this.authManager = authManager;
    this.errorHandler = errorHandler || new ErrorHandler();
    this.validator = validator || new InputValidator();
    this.sanitizer = sanitizer || new InputSanitizer();
  }

  async checkAvailability(request: Partial<IAvailabilityRequest>): Promise<IAvailabilityResponse> {
    try {
      console.error('AvailabilityService: Checking availability with request:', request);
      
      // Validate the request before processing if required fields are present
      if (request.dateFrom || request.dateTo) {
        this.validateAvailabilityRequest(request as IAvailabilityRequest);
      }
      
      // Format the request to ensure all required fields are set
      const formattedRequest = this.formatAvailabilityRequest(request);
      console.error('AvailabilityService: Formatted request:', formattedRequest);
      
      // Get credentials from authentication manager
      const credentials = this.authManager.getCredentials();
      
      // Call the Matrix API through the API client
      const response = await this.apiClient.checkAvailability(formattedRequest, credentials);
      
      console.error('AvailabilityService: Received availability response:', response);
      return response;
      
    } catch (error) {
      console.error('AvailabilityService: Error checking availability:', error);
      
      // Pass-through error handling - let the error bubble up
      if (error instanceof Error) {
        throw error;
      }
      
      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'AVAILABILITY_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  formatAvailabilityRequest(request: Partial<IAvailabilityRequest>): IAvailabilityRequest {
    console.error('AvailabilityService: Formatting availability request:', request);
    
    const now = new Date();
    const config = this.configManager.getConfig();
    
    // Default dateFrom to current date if not provided
    let dateFrom = request.dateFrom;
    if (!dateFrom) {
      dateFrom = now.toISOString();
      console.error('AvailabilityService: Using default dateFrom:', dateFrom);
    }
    
    // Default dateTo to end of day if not provided
    let dateTo = request.dateTo;
    if (!dateTo) {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      dateTo = endOfDay.toISOString();
      console.error('AvailabilityService: Using default dateTo:', dateTo);
    }
    
    // Default locationId to preferred location if not provided
    let locationId = request.locationId;
    if (!locationId) {
      const preferredLocationString = config.matrixPreferredLocation;
      locationId = parseInt(preferredLocationString, 10);
      
      if (isNaN(locationId)) {
        throw new Error(`Invalid MATRIX_PREFERED_LOCATION: '${preferredLocationString}' is not a valid number`);
      }
      
      console.error('AvailabilityService: Using default locationId:', locationId);
    }
    
    const formattedRequest: IAvailabilityRequest = {
      dateFrom,
      dateTo,
      locationId
    };
    
    if (request.bookingCategory !== undefined) {
      formattedRequest.bookingCategory = request.bookingCategory;
    }
    
    // Validate that dateFrom is before dateTo using centralized validator
    const timeRangeValidation = this.validator.validateTimeRange(dateFrom, dateTo);
    if (!timeRangeValidation.isValid) {
      throw new Error(`Invalid date range: ${timeRangeValidation.errors.join(', ')}`);
    }
    
    console.error('AvailabilityService: Request formatted successfully:', formattedRequest);
    return formattedRequest;
  }

  private validateAvailabilityRequest(request: IAvailabilityRequest): void {
    const errors: string[] = [];

    // Validate dates if provided
    if (request.dateFrom) {
      const dateFromValidation = this.validator.validateDate(request.dateFrom);
      if (!dateFromValidation.isValid) {
        errors.push(`Invalid dateFrom: ${dateFromValidation.errors.join(', ')}`);
      }
    }

    if (request.dateTo) {
      const dateToValidation = this.validator.validateDate(request.dateTo);
      if (!dateToValidation.isValid) {
        errors.push(`Invalid dateTo: ${dateToValidation.errors.join(', ')}`);
      }
    }

    // Validate location ID if provided
    if (request.locationId !== undefined) {
      const locationValidation = this.validator.validateLocationId(request.locationId);
      if (!locationValidation.isValid) {
        errors.push(`Invalid locationId: ${locationValidation.errors.join(', ')}`);
      }
    }

    // Validate booking category if provided
    if (request.bookingCategory !== undefined) {
      const sanitizedCategory = this.sanitizer.sanitizeNumericId(request.bookingCategory);
      if (sanitizedCategory === null || sanitizedCategory <= 0) {
        errors.push('Booking category must be a positive number');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid availability request: ${errors.join(', ')}`);
    }
  }
}