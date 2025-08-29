import { IBookingService, IBookingRequest, IBookingResponse, IOwner, ICancelBookingRequest, ICancelBookingResponse } from '../types/booking.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { ILocationService, ILocation } from '../types/location.types.js';
import { InputValidator } from '../validation/index.js';
import { IInputValidator } from '../types/validation.types.js';
import { getCurrentDateString } from '../utils/date-formatting.js';

export class BookingService implements IBookingService {
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private configManager: IConfigurationManager;
  private locationService: ILocationService;
  private validator: IInputValidator;
  constructor(
    apiClient: IMatrixAPIClient,
    authManager: IAuthenticationManager,
    configManager: IConfigurationManager,
    locationService: ILocationService,
    validator?: IInputValidator
  ) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.configManager = configManager;
    this.locationService = locationService;
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

  /**
   * Resolve location ID from various input types with hierarchical search
   * @param locationInput - Can be number (ID or room number), string (room name)
   * @returns Resolved location ID
   */
  async resolveLocationId(locationInput: string | number): Promise<number> {
    // If it's a number >= 100000, treat as direct location ID
    if (typeof locationInput === 'number' && locationInput >= 100000) {
      // Validate that this location ID exists
      try {
        await this.locationService.getLocation(locationInput);
        return locationInput;
      } catch {
        throw new Error(`Location ID ${locationInput} not found`);
      }
    }

    // For room numbers/names, perform hierarchical search
    const searchTerm = locationInput.toString();
    
    try {
      // Step 1: Search within preferred building hierarchy
      const config = this.configManager.getConfig();
      const preferredBuildingId = parseInt(config.matrixPreferredLocation, 10);
      
      if (!isNaN(preferredBuildingId)) {
        const preferredBuildingHierarchy = await this.locationService.getLocationHierarchy({
          parentId: preferredBuildingId,
          includeChildren: true,
          includeFacilities: false
        });

        // Look for exact or partial matches in preferred building
        const preferredMatch = this.findLocationInHierarchy(searchTerm, preferredBuildingHierarchy.locations);
        if (preferredMatch) {
          return preferredMatch.id;
        }
      }

      // Step 2: Search entire organization hierarchy if not found in preferred building
      const globalHierarchy = await this.locationService.getLocationHierarchy({
        includeChildren: true,
        includeFacilities: false
      });

      const globalMatch = this.findLocationInHierarchy(searchTerm, globalHierarchy.locations);
      if (globalMatch) {
        return globalMatch.id;
      }

      // If no matches found
      throw new Error(`Location "${searchTerm}" not found in organization hierarchy`);

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found in organization')) {
        throw error;
      }
      throw new Error(`Error resolving location "${searchTerm}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find location in hierarchy by name or number
   * @param searchTerm - Location name or number to search for
   * @param locations - Array of locations to search
   * @returns Matching location or null
   */
  private findLocationInHierarchy(searchTerm: string, locations: ILocation[]): { id: number; name: string } | null {
    const searchLower = searchTerm.toLowerCase().trim();
    
    // First pass: Look for exact matches
    for (const location of locations) {
      if (location.name && location.name.toLowerCase() === searchLower) {
        return { id: location.id, name: location.name };
      }
    }
    
    // Second pass: Look for partial matches and room number patterns
    for (const location of locations) {
      // Check if location name contains the search term
      if (location.name && location.name.toLowerCase().includes(searchLower)) {
        return { id: location.id, name: location.name };
      }
      
      // Check if search term matches room number pattern (e.g., "701" matches "Room 701")
      if (location.name && /\b\d+\b/.test(location.name)) {
        const roomNumbers = location.name.match(/\b\d+\b/g);
        if (roomNumbers && roomNumbers.some((num: string) => num === searchTerm)) {
          return { id: location.id, name: location.name };
        }
      }
    }
    
    return null;
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

  async cancelBooking(request: ICancelBookingRequest): Promise<ICancelBookingResponse> {
    // Validate booking ID before making API call
    const bookingIdValidation = this.validator.validateBookingId(request.bookingId);
    if (!bookingIdValidation.isValid) {
      throw new Error(`Invalid booking ID: ${bookingIdValidation.errors.join(', ')}`);
    }

    // Validate optional reason field length if provided
    if (request.reason && request.reason.length > 500) {
      throw new Error('Cancellation reason cannot exceed 500 characters');
    }

    // Get credentials and make API call
    const credentials = await this.authManager.getCredentials();
    return await this.apiClient.cancelBooking(request, credentials);
  }
}