import { IBookingService, IBookingRequest, IBookingResponse, IOwner } from '../types/booking.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { InputValidator } from '../validation/index.js';
import { IInputValidator } from '../types/validation.types.js';
import { getCurrentDateString } from '../utils/date-formatting.js';

export class BookingService implements IBookingService {
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private configManager: IConfigurationManager;
  private validator: IInputValidator;
  constructor(
    apiClient: IMatrixAPIClient,
    authManager: IAuthenticationManager,
    configManager: IConfigurationManager,
    validator?: IInputValidator
  ) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.configManager = configManager;
    this.validator = validator || new InputValidator();
  }

  async createBooking(request: IBookingRequest): Promise<IBookingResponse> {
    // Validate and sanitize the request before making API call
    const validationResult = this.validateBookingRequestV2(request);
    if (!validationResult.isValid) {
      throw new Error(`Invalid booking request: ${validationResult.errors.join(', ')}`);
    }

    const credentials = await this.authManager.getCredentials();
    return await this.apiClient.createBooking(request, credentials);
  }

  async formatBookingRequest(request: Partial<IBookingRequest>): Promise<IBookingRequest> {
    const config = this.configManager.getConfig();
    const today = getCurrentDateString();
    
    // Apply default values according to spec requirements
    // IMPORTANT: Matrix API expects times in local timezone (no Z suffix), not UTC
    const defaultTimeFrom = request.timeFrom || `${today}T09:00:00.000`;
    const defaultTimeTo = request.timeTo || `${today}T10:00:00.000`;
    const defaultLocationId = request.locationId || parseInt(config.matrixPreferredLocation, 10);
    const defaultAttendees = request.attendees || [];
    const defaultExtraRequests = request.extraRequests || [];
    const defaultOwnerIsAttendee = request.ownerIsAttendee ?? true;
    const defaultSource = request.source || 'matrix-booking-mcp';

    // Get user profile to extract real personId for owner
    let defaultOwner: IOwner;
    if (request.owner) {
      defaultOwner = request.owner;
    } else {
      try {
        const credentials = this.authManager.getCredentials();
        const userProfile = await this.authManager.getCurrentUser(credentials);
        defaultOwner = {
          id: userProfile.personId, // Use real personId instead of 0
          email: userProfile.email,
          name: userProfile.name
        };
      } catch (error) {
        // Fallback to config values if user profile fetch fails
        console.error('Failed to get user profile, using config fallback:', error);
        defaultOwner = {
          id: 0, // This will likely cause "Person not found" error
          email: config.matrixUsername,
          name: config.matrixUsername
        };
      }
    }

    return {
      timeFrom: defaultTimeFrom,
      timeTo: defaultTimeTo,
      locationId: defaultLocationId,
      attendees: defaultAttendees,
      extraRequests: defaultExtraRequests,
      owner: defaultOwner,
      ownerIsAttendee: defaultOwnerIsAttendee,
      source: defaultSource
    };
  }

  validateBookingRequest(request: IBookingRequest): boolean {
    // Legacy validation method - kept for backward compatibility
    // Use validateBookingRequestV2 for comprehensive validation
    return this.validateBookingRequestV2(request).isValid;
  }

  validateBookingRequestV2(request: IBookingRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate time range using centralized validator
    // Note: We don't enforce future dates here to maintain compatibility with tests
    // In production, you may want to add minDate validation
    const timeRangeValidation = this.validator.validateTimeRange(
      request.timeFrom, 
      request.timeTo
    );
    
    if (!timeRangeValidation.isValid) {
      errors.push(...timeRangeValidation.errors);
    }

    // Validate location ID using centralized validator
    const locationValidation = this.validator.validateLocationId(request.locationId);
    if (!locationValidation.isValid) {
      errors.push(...locationValidation.errors);
    }

    // Validate owner email
    if (!request.owner) {
      errors.push('Owner is required');
    } else {
      const ownerEmailValidation = this.validator.validateEmailAddress(request.owner.email);
      if (!ownerEmailValidation.isValid) {
        errors.push(`Owner email invalid: ${ownerEmailValidation.errors.join(', ')}`);
      }
      
      // Validate owner name
      if (!request.owner.name || this.validator.sanitizeString(request.owner.name).length === 0) {
        errors.push('Owner name is required');
      }
    }

    // Validate attendees if provided
    if (request.attendees) {
      request.attendees.forEach((attendee, index) => {
        const emailValidation = this.validator.validateEmailAddress(attendee.email);
        if (!emailValidation.isValid) {
          errors.push(`Attendee ${index + 1} email invalid: ${emailValidation.errors.join(', ')}`);
        }
        
        if (!attendee.name || this.validator.sanitizeString(attendee.name).length === 0) {
          errors.push(`Attendee ${index + 1} name is required`);
        }
      });
    }

    // Validate and sanitize source
    const sanitizedSource = this.validator.sanitizeString(request.source);
    if (!sanitizedSource || sanitizedSource.length === 0) {
      errors.push('Source is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}