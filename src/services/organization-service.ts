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

      // Validate organization ID
      if (!this.validateOrganizationId(organizationId)) {
        throw new Error(`Invalid organization ID: ${organizationId}. Organization ID must be a positive integer.`);
      }

      // Check cache first (only if caching is enabled)
      const cacheKey = `org_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<IOrganizationResponse>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      // Get credentials from authentication manager
      const credentials = await this.authManager.getCredentials();

      // Call the Matrix API through the API client
      const organization = await this.apiClient.getOrganization(organizationId, credentials);

      // Cache the result (only if caching is enabled)
      if (this.configManager.getConfig().cacheEnabled) {
        this.setCachedData(cacheKey, organization, this.CACHE_TTL.ORGANIZATION);
      }

      return organization;

    } catch (error) {

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

      // Check cache first (only if caching is enabled)
      const cacheKey = `categories_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<IBookingCategory[]>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      // Get full organization data (which includes categories)
      const organization = await this.getOrganization(organizationId);
      
      // Transform Matrix API categories to our interface format
      interface MatrixAPICategory {
        id: number;
        nameSingle?: string;
        namePlural?: string;
        name?: string;
        shortNamePlural?: string;
        locationKind?: string;
        color?: string;
      }
      
      const categories: IBookingCategory[] = (organization.categories || []).map((apiCategory: MatrixAPICategory) => ({
        id: apiCategory.id,
        name: apiCategory.nameSingle || apiCategory.name || 'Unknown Category',
        description: `${apiCategory.namePlural || apiCategory.shortNamePlural || ''} (${apiCategory.locationKind || 'UNKNOWN'})`.trim(),
        color: apiCategory.color || '#007bff', // Default blue color
        isActive: true // Assume active if returned by API
      }));

      // Cache the categories separately for more granular caching (only if caching is enabled)
      if (this.configManager.getConfig().cacheEnabled) {
        this.setCachedData(cacheKey, categories, this.CACHE_TTL.CATEGORIES);
      }

      return categories;

    } catch (error) {

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

      // Check cache first (only if caching is enabled)
      const cacheKey = `locationKinds_${organizationId}`;
      if (this.configManager.getConfig().cacheEnabled) {
        const cachedData = this.getCachedData<ILocationKind[]>(cacheKey);
        if (cachedData) {
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

      return locationKinds;

    } catch (error) {

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
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForOrganization(organizationId: number): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(`_${organizationId}`)
    );
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}