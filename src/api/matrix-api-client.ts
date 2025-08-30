import { IMatrixAPIClient, IAPIRequest, IAPIResponse } from '../types/api.types.js';
import { ICredentials } from '../types/authentication.types.js';
import { IAvailabilityRequest, IAvailabilityResponse } from '../types/availability.types.js';
import { IBookingRequest, IBookingResponse, ICancelBookingRequest, ICancelBookingResponse } from '../types/booking.types.js';
import { ILocation, ILocationHierarchyResponse, ILocationQueryRequest } from '../types/location.types.js';
import { ICurrentUserResponse, IUserBookingsRequest, IUserBookingsResponse } from '../types/user.types.js';
import { IOrganizationResponse } from '../types/organization.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';

// API optimization constants based on successful patterns from design document
const DESK_BOOKING_CATEGORY = 9000001; // Generic desk category ID
const ROOM_BOOKING_CATEGORY = 9000002; // Generic room category ID

// Cache interface for request caching
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

export class MatrixAPIClient implements IMatrixAPIClient {
  private authManager: IAuthenticationManager;
  private configManager: IConfigurationManager;
  private errorHandler: IErrorHandler;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private retryConfig: RetryConfig;

  constructor(authManager: IAuthenticationManager, configManager: IConfigurationManager, errorHandler?: IErrorHandler) {
    this.authManager = authManager;
    this.configManager = configManager;
    this.errorHandler = errorHandler || new ErrorHandler();
    
    // Initialize retry configuration
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000  // 10 seconds
    };
  }

  /**
   * Generate cache key for request caching
   */
  private generateCacheKey(method: string, url: string, body?: unknown): string {
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyHash}`;
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Cache response with TTL
   */
  private setCachedResponse<T>(cacheKey: string, data: T, ttl = 300000): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Implement exponential backoff retry logic
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    _context: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication or client errors (4xx)
        if (error instanceof Error) {
          const errorWithStatus = error as Error & { status?: number; errorResponse?: { error?: { httpStatus?: number } } };
          const status = errorWithStatus.status || errorWithStatus.errorResponse?.error?.httpStatus;
          if (status && status >= 400 && status < 500) {
            throw error;
          }
        }
        
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  async checkAvailability(request: IAvailabilityRequest, credentials: ICredentials): Promise<IAvailabilityResponse> {
    const config = this.configManager.getConfig();
    
    // Generate cache key for availability requests
    const cacheKey = this.generateCacheKey('GET', 'availability', request);
    
    // Check cache first (shorter TTL for availability data)
    const cached = this.getCachedResponse<IAvailabilityResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const headers = this.authManager.createAuthHeader(credentials);
    const params = new URLSearchParams();
    
    // Required parameters - validate locationId exists
    if (!request.locationId) {
      throw new Error('locationId is required for availability check');
    }
    
    params.append('l', request.locationId.toString());
    params.append('f', request.dateFrom);
    params.append('t', request.dateTo);
    
    // Use correct booking category based on request type or default to desk
    const bookingCategory = request.bookingCategory || DESK_BOOKING_CATEGORY;
    params.append('bc', bookingCategory.toString());
    
    // Optimized include flags based on successful API patterns from design document
    params.append('include', 'locations');
    params.append('include', 'facilities');
    params.append('include', 'occupancy');
    params.append('include', 'bookings');
    
    // Add status filtering for available slots only
    params.append('status', 'available');
    
    const url = `${config.apiBaseUrl}/availability?${params.toString()}`;
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url,
      headers
    };

    const response = await this.retryWithBackoff(
      () => this.makeRequest<IAvailabilityResponse>(apiRequest),
      'Availability check'
    );
    
    // Cache the response for 2 minutes (availability changes frequently)
    this.setCachedResponse(cacheKey, response.data, 120000);
    
    return response.data;
  }

  async createBooking(request: IBookingRequest, credentials: ICredentials): Promise<IBookingResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'POST',
      url: `${config.apiBaseUrl}/booking?notifyScope=ALL_ATTENDEES`,
      headers,
      body: request
    };

    const response = await this.makeRequest<IBookingResponse>(apiRequest);
    return response.data;
  }

  async getBooking(bookingId: number, credentials: ICredentials): Promise<IBookingResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url: `${config.apiBaseUrl}/booking/${bookingId}`,
      headers
    };

    const response = await this.makeRequest<IBookingResponse>(apiRequest);
    return response.data;
  }

  async cancelBooking(request: ICancelBookingRequest, credentials: ICredentials): Promise<ICancelBookingResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    // Build query parameters with defaults
    const params = new URLSearchParams();
    params.append('notifyScope', request.notifyScope || 'ALL_ATTENDEES');
    params.append('sendNotifications', (request.sendNotifications !== false).toString());
    
    if (request.reason) {
      params.append('reason', request.reason);
    }

    const url = `${config.apiBaseUrl}/booking/${request.bookingId}?${params.toString()}`;
    
    const apiRequest: IAPIRequest = {
      method: 'DELETE',
      url,
      headers
    };

    const response = await this.makeRequest<ICancelBookingResponse>(apiRequest);
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

  async getCurrentUser(credentials: ICredentials): Promise<ICurrentUserResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url: `${config.apiBaseUrl}/user/current`,
      headers
    };

    const response = await this.makeRequest<ICurrentUserResponse>(apiRequest);
    return response.data;
  }

  async getUserBookings(request: IUserBookingsRequest, credentials: ICredentials): Promise<IUserBookingsResponse> {
    const config = this.configManager.getConfig();
    
    // Generate cache key for user bookings
    const cacheKey = this.generateCacheKey('GET', 'user-bookings', request);
    
    // Check cache first (longer TTL for user bookings as they change less frequently)
    const cached = this.getCachedResponse<IUserBookingsResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const headers = this.authManager.createAuthHeader(credentials);
    const queryParams = new URLSearchParams();
    
    // Use optimized parameter format based on design document patterns
    if (request.startDate) queryParams.append('f', request.startDate);
    if (request.endDate) queryParams.append('t', request.endDate);
    if (request.status) queryParams.append('status', request.status);
    if (request.page) queryParams.append('page', request.page.toString());
    if (request.pageSize) queryParams.append('pageSize', request.pageSize.toString());
    
    // Add booking category for better filtering
    if (request.bookingCategory) {
      queryParams.append('bc', request.bookingCategory.toString());
    }
    
    // Optimized include parameters based on successful API patterns
    queryParams.append('include', 'ancestors');
    queryParams.append('include', 'locations');
    queryParams.append('include', 'facilities');
    queryParams.append('include', 'layouts');
    queryParams.append('include', 'bookingSettings');
    queryParams.append('include', 'groups');
    
    const queryString = queryParams.toString();
    const url = queryString ? 
      `${config.apiBaseUrl}/user/current/bookings?${queryString}` : 
      `${config.apiBaseUrl}/user/current/bookings`;
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url,
      headers
    };

    const response = await this.retryWithBackoff(
      () => this.makeRequest<IUserBookingsResponse>(apiRequest),
      'User bookings fetch'
    );
    
    // Cache for 5 minutes (user bookings don't change very frequently)
    this.setCachedResponse(cacheKey, response.data, 300000);
    
    return response.data;
  }

  /**
   * Optimized desk availability check with correct parameters
   */
  async checkDeskAvailability(
    locationId: number,
    dateFrom: string,
    dateTo: string,
    credentials: ICredentials
  ): Promise<IAvailabilityResponse> {
    return this.checkAvailability({
      locationId,
      dateFrom,
      dateTo,
      bookingCategory: DESK_BOOKING_CATEGORY
    }, credentials);
  }

  /**
   * Optimized room availability check with correct parameters
   */
  async checkRoomAvailability(
    locationId: number,
    dateFrom: string,
    dateTo: string,
    credentials: ICredentials
  ): Promise<IAvailabilityResponse> {
    return this.checkAvailability({
      locationId,
      dateFrom,
      dateTo,
      bookingCategory: ROOM_BOOKING_CATEGORY
    }, credentials);
  }

  /**
   * Clear cache entries (useful for testing or when fresh data is needed)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));
    
    return {
      size: this.cache.size,
      entries
    };
  }

  async getAllBookings(credentials: ICredentials, bookingCategory?: number, dateFrom?: string, dateTo?: string): Promise<IUserBookingsResponse> {
    const config = this.configManager.getConfig();
    
    // Generate cache key for all bookings
    const cacheKey = this.generateCacheKey('GET', 'all-bookings', { bookingCategory, dateFrom, dateTo });
    
    // Check cache first
    const cached = this.getCachedResponse<IUserBookingsResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const headers = this.authManager.createAuthHeader(credentials);
    const queryParams = new URLSearchParams();
    
    // Add optimized parameters based on design document patterns
    if (bookingCategory) {
      queryParams.append('bc', bookingCategory.toString());
    }
    if (dateFrom) {
      queryParams.append('f', dateFrom);
    }
    if (dateTo) {
      queryParams.append('t', dateTo);
    }
    
    // Add optimized include flags
    queryParams.append('include', 'ancestors');
    queryParams.append('include', 'locations');
    queryParams.append('include', 'facilities');
    queryParams.append('include', 'layouts');
    queryParams.append('include', 'bookingSettings');
    queryParams.append('include', 'groups');
    
    const queryString = queryParams.toString();
    const url = queryString ? 
      `${config.apiBaseUrl}/booking?${queryString}` : 
      `${config.apiBaseUrl}/booking`;
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url,
      headers
    };

    const response = await this.retryWithBackoff(
      () => this.makeRequest<IUserBookingsResponse>(apiRequest),
      'All bookings fetch'
    );
    
    // Cache for 3 minutes (booking data changes moderately frequently)
    this.setCachedResponse(cacheKey, response.data, 180000);
    
    return response.data;
  }


  async getLocationHierarchy(request: ILocationQueryRequest, credentials: ICredentials): Promise<ILocationHierarchyResponse> {
    const config = this.configManager.getConfig();
    
    // Generate cache key for location hierarchy (this data changes infrequently)
    const cacheKey = this.generateCacheKey('GET', 'location-hierarchy', request);
    
    // Check cache first (longer TTL for location hierarchy as it's relatively static)
    const cached = this.getCachedResponse<ILocationHierarchyResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const headers = this.authManager.createAuthHeader(credentials);
    const queryParams = new URLSearchParams();
    
    // When using kind filter, use simpler parameters
    if (request.kind) {
      // Add kind filter (can be multiple for ROOM and DESK)
      if (request.kind.includes(',')) {
        // Support multiple kinds like "ROOM,DESK"
        request.kind.split(',').forEach(k => queryParams.append('kind', k.trim()));
      } else {
        queryParams.append('kind', request.kind);
      }
      
      // Add location filter
      if (request.locationId || request.parentId) {
        queryParams.append('l', (request.locationId || request.parentId)!.toString());
      }
      
      // Optionally include facilities
      if (request.includeFacilities) {
        queryParams.append('include', 'facilities');
      }
    } else {
      // Use full parameters when not filtering by kind
      queryParams.append('select', 'higher');
      queryParams.append('include', 'locations');
      queryParams.append('include', 'nested');
      
      // Include facilities if requested
      if (request.includeFacilities) {
        queryParams.append('include', 'facilities');
      }
      
      // Add specific location ID if provided for targeted queries
      if (request.locationId || request.parentId) {
        queryParams.append('l', (request.locationId || request.parentId)!.toString());
      }
    }
    
    const url = `${config.apiBaseUrl}/location?${queryParams.toString()}`;
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url,
      headers
    };

    // Matrix API returns an array of locations directly
    const response = await this.retryWithBackoff(
      () => this.makeRequest<ILocation[]>(apiRequest),
      'Location hierarchy fetch'
    );
    
    // Transform the raw array response into the expected format
    const locations = response.data || [];
    const hierarchyResponse: ILocationHierarchyResponse = {
      locations: locations,
      total: locations.length,
      hierarchy: {}
    };
    
    // Build hierarchy map from nested locations
    for (const location of locations) {
      if (location.locations && Array.isArray(location.locations)) {
        hierarchyResponse.hierarchy[location.id] = location.locations.map((child: ILocation) => child.id);
      }
    }
    
    // Cache for 15 minutes (location hierarchy is relatively static)
    this.setCachedResponse(cacheKey, hierarchyResponse, 900000);
    
    return hierarchyResponse;
  }

  async getOrganization(organizationId: number, credentials: ICredentials): Promise<IOrganizationResponse> {
    const config = this.configManager.getConfig();
    const headers = this.authManager.createAuthHeader(credentials);
    
    const apiRequest: IAPIRequest = {
      method: 'GET',
      url: `${config.apiBaseUrl}/org/${organizationId}?include=categories&include=locationKinds&include=conferenceProviders&include=rootLocation&scope=SHARED`,
      headers
    };

    const response = await this.makeRequest<IOrganizationResponse>(apiRequest);
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
        const error = new Error(errorResponse.error.message) as Error & { 
          errorResponse: typeof errorResponse;
          status: number;
        };
        error.errorResponse = errorResponse;
        error.status = response.status; // Preserve status for retry logic
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