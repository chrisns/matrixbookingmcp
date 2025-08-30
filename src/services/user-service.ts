/**
 * User service implementation for managing user profile and bookings
 */

import { IUserService, ICurrentUserResponse, IUserBookingsRequest, IUserBookingsResponse } from '../types/user.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IInputValidator } from '../types/validation.types.js';
import { InputValidator } from '../validation/index.js';

export class UserService implements IUserService {
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private validator: IInputValidator;

  constructor(
    apiClient: IMatrixAPIClient,
    authManager: IAuthenticationManager,
    validator?: IInputValidator
  ) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.validator = validator || new InputValidator();
  }

  async getCurrentUser(): Promise<ICurrentUserResponse> {
    const credentials = await this.authManager.getCredentials();
    return await this.apiClient.getCurrentUser(credentials);
  }

  async getUserBookings(request?: IUserBookingsRequest): Promise<IUserBookingsResponse> {
    const credentials = await this.authManager.getCredentials();
    const formattedRequest = this.formatUserBookingsRequest(request || {});
    return await this.apiClient.getUserBookings(formattedRequest, credentials);
  }

  formatUserBookingsRequest(request: unknown): IUserBookingsRequest {
    // Type guard to ensure we have a valid object
    if (!request || typeof request !== 'object') {
      return this.getDefaultBookingsRequest();
    }

    const req = request as Partial<IUserBookingsRequest>;
    const defaults = this.getDefaultBookingsRequest();
    
    // Build the formatted request with only defined values
    const formattedRequest: IUserBookingsRequest = {
      page: this.validatePage(req.page),
      pageSize: this.validatePageSize(req.pageSize)
    };

    // Only add optional properties if they have valid values
    const startDate = this.validateAndFormatDate(req.startDate) || defaults.startDate;
    if (startDate) {
      formattedRequest.startDate = startDate;
    }

    const endDate = this.validateAndFormatDate(req.endDate) || defaults.endDate;
    if (endDate) {
      formattedRequest.endDate = endDate;
    }

    const status = this.validateStatus(req.status);
    if (status) {
      formattedRequest.status = status;
    }

    return formattedRequest;
  }

  private getDefaultBookingsRequest(): IUserBookingsRequest {
    // Default to last 6 months of bookings to capture historical usage patterns
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    return {
      startDate: startDateStr!,
      endDate: endDateStr!,
      page: 1,
      pageSize: 100 // Get more results for better historical analysis
    };
  }

  private validateAndFormatDate(date?: string): string | undefined {
    if (!date) {
      return undefined;
    }

    // Sanitize the date string
    const sanitizedDate = this.validator.sanitizeString(date);
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(sanitizedDate)) {
      return undefined;
    }

    // Validate that it's a valid date
    const parsedDate = new Date(sanitizedDate);
    if (isNaN(parsedDate.getTime())) {
      return undefined;
    }

    return sanitizedDate;
  }

  private validateStatus(status?: string): 'ACTIVE' | 'CANCELLED' | 'COMPLETED' | undefined {
    if (!status) {
      return undefined;
    }

    const sanitizedStatus = this.validator.sanitizeString(status).toUpperCase();
    
    if (['ACTIVE', 'CANCELLED', 'COMPLETED'].includes(sanitizedStatus)) {
      return sanitizedStatus as 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
    }

    return undefined;
  }

  private validatePage(page?: number): number {
    if (typeof page !== 'number' || page < 1) {
      return 1;
    }
    return Math.floor(page);
  }

  private validatePageSize(pageSize?: number): number {
    if (typeof pageSize !== 'number' || pageSize < 1) {
      return 100; // Default to 100 for better historical analysis
    }
    // Cap at reasonable maximum to prevent performance issues
    return Math.min(Math.floor(pageSize), 500);
  }
}