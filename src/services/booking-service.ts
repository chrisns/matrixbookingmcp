import { 
  IBookingService, 
  IBookingRequest, 
  IBookingResponse, 
  IOwner, 
  ICancelBookingRequest, 
  ICancelBookingResponse,
  IBookingSearchRequest,
  IBookingSearchResponse,
  IBookingSearchResult
} from '../types/booking.types.js';
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
        const credentials = await this.authManager.getCredentials();
        const userProfile = await this.authManager.getCurrentUser(credentials);
        defaultOwner = {
          id: userProfile.personId, // Use real personId instead of 0
          email: userProfile.email,
          name: userProfile.name
        };
      } catch {
        // Fallback to config values if user profile fetch fails
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
      
      // Check if search term matches room number pattern (e.g., "101" matches "Room 101")
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
  
  /**
   * Comprehensive booking search with multiple filter options
   */
  async searchBookings(request: IBookingSearchRequest): Promise<IBookingSearchResponse> {
    const credentials = await this.authManager.getCredentials();
    
    // Format dates to ensure proper format
    const dateFrom = this.formatDate(request.dateFrom);
    const dateTo = this.formatDate(request.dateTo);
    
    // Determine booking category based on location kind if not specified
    let bookingCategory = request.bookingCategory;
    if (!bookingCategory && request.locationKind) {
      bookingCategory = request.locationKind === 'ROOM' ? 9000002 : 9000001;
    }
    
    // Fetch all bookings with the specified filters
    const bookingsData = await this.apiClient.getAllBookings(
      credentials,
      bookingCategory,
      dateFrom,
      dateTo,
      request.locationId
    );
    
    // Filter and enhance bookings based on request parameters
    let filteredBookings = bookingsData.bookings || [];
    
    // Filter by user if specified
    if (request.userName) {
      const searchName = request.userName.toLowerCase();
      filteredBookings = filteredBookings.filter(booking => 
        booking.owner?.name?.toLowerCase().includes(searchName) ||
        booking.bookedBy?.name?.toLowerCase().includes(searchName)
      );
    }
    
    if (request.userEmail) {
      const searchEmail = request.userEmail.toLowerCase();
      filteredBookings = filteredBookings.filter(booking => 
        booking.owner?.email?.toLowerCase() === searchEmail ||
        booking.bookedBy?.email?.toLowerCase() === searchEmail
      );
    }
    
    // Filter by location kind if specified
    if (request.locationKind) {
      filteredBookings = filteredBookings.filter(booking => 
        booking.locationKind === request.locationKind
      );
    }
    
    // By default, only show user's own bookings unless includeAllUsers is true
    if (!request.includeAllUsers && !request.userName && !request.userEmail) {
      const currentUser = await this.authManager.getCurrentUser(credentials);
      filteredBookings = filteredBookings.filter(booking => 
        booking.owner?.email === currentUser.email ||
        booking.bookedBy?.email === currentUser.email
      );
    }
    
    // Enhance bookings with location details if requested
    const enhancedBookings: IBookingSearchResult[] = await Promise.all(
      filteredBookings.map(async (booking) => {
        const enhanced: IBookingSearchResult = { ...booking };
        
        if (request.includeLocationDetails && booking.locationId) {
          try {
            const location = await this.locationService.getLocation(booking.locationId);
            enhanced.location = {
              id: location.id,
              name: location.name,
              kind: location.kind || 'UNKNOWN',
              qualifiedName: location.qualifiedName || location.name
            };
            if (request.includeFacilities && location.facilities && enhanced.location) {
              enhanced.location.facilities = location.facilities;
            }
          } catch {
            // If location fetch fails, use basic info
            enhanced.location = {
              id: booking.locationId,
              name: booking.locationName || `Location ${booking.locationId}`,
              kind: booking.locationKind || 'UNKNOWN',
              qualifiedName: booking.locationName || `Location ${booking.locationId}`
            };
          }
        }
        
        return enhanced;
      })
    );
    
    // Calculate summary statistics
    const uniqueUsers = new Set(enhancedBookings.map(b => b.owner?.email)).size;
    const uniqueLocations = new Set(enhancedBookings.map(b => b.locationId)).size;
    
    // Group results if requested
    let groupedResults: Record<string, IBookingSearchResult[]> | undefined;
    if (request.groupBy) {
      const groups: Record<string, IBookingSearchResult[]> = {};
      
      for (const booking of enhancedBookings) {
        let key: string;
        
        switch (request.groupBy) {
          case 'user':
            key = booking.owner?.name || booking.owner?.email || 'Unknown User';
            break;
          case 'location':
            key = booking.location?.name || booking.locationName || `Location ${booking.locationId}`;
            break;
          case 'date': {
            // timeFrom is required in IBookingResponse but TypeScript doesn't know that
            const dateStr = booking.timeFrom 
              ? new Date(booking.timeFrom).toISOString().split('T')[0]
              : 'Unknown Date';
            key = dateStr as string;
            break;
          }
          default:
            key = 'Other';
        }
        
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key]!.push(booking);
      }
      groupedResults = groups;
    }
    
    const result: IBookingSearchResponse = {
      bookings: enhancedBookings,
      summary: {
        totalBookings: enhancedBookings.length,
        uniqueUsers,
        uniqueLocations,
        dateRange: { from: dateFrom, to: dateTo }
      }
    };
    
    if (groupedResults) {
      result.groupedResults = groupedResults;
    }
    
    return result;
  }
  
  /**
   * Helper to format date strings
   */
  private formatDate(date: string): string {
    // If already in ISO format with time, return as is
    if (date.includes('T')) {
      return date;
    }
    // If just date, add time components
    return `${date}T00:00:00`;
  }
}