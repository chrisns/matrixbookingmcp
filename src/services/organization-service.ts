import { IOrganizationService, IOrganizationResponse, IBookingCategory, ILocationKind } from '../types/organization.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';

interface ICacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class OrganizationService implements IOrganizationService {
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private errorHandler: IErrorHandler;
  private configManager: IConfigurationManager;
  private cache: Map<string, ICacheEntry<unknown>> = new Map();

  private readonly CACHE_TTL = {
    ORGANIZATION: 24 * 60 * 60 * 1000, // 24 hours
    CATEGORIES: 24 * 60 * 60 * 1000,   // 24 hours
    LOCATION_KINDS: 24 * 60 * 60 * 1000 // 24 hours
  };

  constructor(
    apiClient: IMatrixAPIClient,
    configManager: IConfigurationManager,
    authManager: IAuthenticationManager,
    errorHandler?: IErrorHandler
  ) {
    this.apiClient = apiClient;
    this.configManager = configManager;
    this.authManager = authManager;
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  async getOrganization(organizationId: number): Promise<IOrganizationResponse> {
    try {
      console.error('OrganizationService: Getting organization with ID:', organizationId);

      // Validate organization ID
      if (!this.validateOrganizationId(organizationId)) {
        throw new Error(`Invalid organization ID: ${organizationId}. Organization ID must be a positive integer.`);
      }

      // Check cache first (only if caching is enabled)
      const cacheKey = `org_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<IOrganizationResponse>(cacheKey);
        if (cachedData) {
          console.error('OrganizationService: Returning cached organization data');
          return cachedData;
        }
      }

      // Get credentials from authentication manager
      const credentials = this.authManager.getCredentials();

      // Call the Matrix API through the API client
      const organization = await this.apiClient.getOrganization(organizationId, credentials);

      // Cache the result (only if caching is enabled)
      if (this.configManager.getConfig().cacheEnabled) {
        this.setCachedData(cacheKey, organization, this.CACHE_TTL.ORGANIZATION);
      }

      console.error('OrganizationService: Retrieved organization:', organization);
      return organization;

    } catch (error) {
      console.error('OrganizationService: Error getting organization:', error);

      // Pass-through error handling
      if (error instanceof Error) {
        throw error;
      }

      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'ORGANIZATION_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  async getBookingCategories(organizationId: number): Promise<IBookingCategory[]> {
    try {
      console.error('OrganizationService: Getting booking categories for organization:', organizationId);

      // Check cache first (only if caching is enabled)
      const cacheKey = `categories_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<IBookingCategory[]>(cacheKey);
        if (cachedData) {
          console.error('OrganizationService: Returning cached booking categories');
          return cachedData;
        }
      }

      // Get full organization data (which includes categories)
      const organization = await this.getOrganization(organizationId);
      const categories = organization.categories;

      // Cache the categories separately for more granular caching (only if caching is enabled)
      if (this.configManager.getConfig().cacheEnabled) {
        this.setCachedData(cacheKey, categories, this.CACHE_TTL.CATEGORIES);
      }

      console.error('OrganizationService: Retrieved booking categories:', categories);
      return categories;

    } catch (error) {
      console.error('OrganizationService: Error getting booking categories:', error);

      // Pass-through error handling
      if (error instanceof Error) {
        throw error;
      }

      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'ORGANIZATION_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  async getLocationKinds(organizationId: number): Promise<ILocationKind[]> {
    try {
      console.error('OrganizationService: Getting location kinds for organization:', organizationId);

      // Check cache first (only if caching is enabled)
      const cacheKey = `locationKinds_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<ILocationKind[]>(cacheKey);
        if (cachedData) {
          console.error('OrganizationService: Returning cached location kinds');
          return cachedData;
        }
      }

      // Get full organization data (which includes location kinds)
      const organization = await this.getOrganization(organizationId);
      const locationKinds = organization.locationKinds;

      // Cache the location kinds separately for more granular caching (only if caching is enabled)
      if (this.configManager.getConfig().cacheEnabled) {
        this.setCachedData(cacheKey, locationKinds, this.CACHE_TTL.LOCATION_KINDS);
      }

      console.error('OrganizationService: Retrieved location kinds:', locationKinds);
      return locationKinds;

    } catch (error) {
      console.error('OrganizationService: Error getting location kinds:', error);

      // Pass-through error handling
      if (error instanceof Error) {
        throw error;
      }

      // Handle unknown errors using error handler
      const errorResponse = this.errorHandler.handleError(error, 'ORGANIZATION_ERROR');
      const serviceError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
      serviceError.errorResponse = errorResponse;
      throw serviceError;
    }
  }

  private validateOrganizationId(organizationId: number): boolean {
    return Number.isInteger(organizationId) && organizationId > 0;
  }

  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      console.error(`OrganizationService: Cache entry expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.error(`OrganizationService: Cache hit for key: ${key}`);
    return entry.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    console.error(`OrganizationService: Data cached for key: ${key}, TTL: ${ttl}ms`);
  }

  clearCache(): void {
    console.error('OrganizationService: Clearing all cache entries');
    this.cache.clear();
  }

  clearCacheForOrganization(organizationId: number): void {
    console.error(`OrganizationService: Clearing cache for organization: ${organizationId}`);
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(`_${organizationId}`)
    );
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}