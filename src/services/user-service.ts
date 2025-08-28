import { IUserService, ICurrentUserResponse, IUserBookingsRequest, IUserBookingsResponse } from '../types/user.types.js';
import { IMatrixAPIClient } from '../types/api.types.js';
import { IConfigurationManager } from '../config/config-manager.js';
import { IAuthenticationManager } from '../types/authentication.types.js';
import { IErrorHandler } from '../types/error.types.js';
import { ErrorHandler } from '../error/error-handler.js';

export class UserService implements IUserService {
  private apiClient: IMatrixAPIClient;
  private authManager: IAuthenticationManager;
  private errorHandler: IErrorHandler;

  constructor(
    apiClient: IMatrixAPIClient,
    _configManager: IConfigurationManager,
    authManager: IAuthenticationManager,
    errorHandler?: IErrorHandler
  ) {
    this.apiClient = apiClient;
    this.authManager = authManager;
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  async getCurrentUser(): Promise<ICurrentUserResponse> {
    try {
      const credentials = this.authManager.getCredentials();
      const userProfile = await this.apiClient.getCurrentUser(credentials);
      
      if (!userProfile.personId || !userProfile.email || !userProfile.name) {
        throw new Error('Invalid user profile response: missing required fields');
      }

      return userProfile;
    } catch (error) {
      console.error('UserService: Error getting current user:', error);
      if (error instanceof Error) {
        throw error;
      }
      const errorResponse = this.errorHandler.handleError(error, 'USER_SERVICE_ERROR');
      throw new Error(errorResponse.error.message);
    }
  }

  async getUserBookings(request: IUserBookingsRequest = {}): Promise<IUserBookingsResponse> {
    try {
      const credentials = this.authManager.getCredentials();
      const bookingsResponse = await this.apiClient.getUserBookings(request, credentials);
      
      return bookingsResponse;
    } catch (error) {
      console.error('UserService: Error getting user bookings:', error);
      if (error instanceof Error) {
        throw error;
      }
      const errorResponse = this.errorHandler.handleError(error, 'USER_SERVICE_ERROR');
      throw new Error(errorResponse.error.message);
    }
  }
}