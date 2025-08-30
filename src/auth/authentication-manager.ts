import { IAuthenticationManager, ICredentials, IUserProfile } from '../types/authentication.types.js';
import { IConfigurationManager } from '../config/config-manager.js';

export class AuthenticationManager implements IAuthenticationManager {
  private configManager: IConfigurationManager;

  constructor(configManager: IConfigurationManager) {
    this.configManager = configManager;
  }

  async getCredentials(): Promise<ICredentials> {
    const config = this.configManager.getConfig();
    
    // Validate credentials exist
    if (!config.matrixUsername || !config.matrixPassword) {
      throw new Error('Authentication credentials not available');
    }

    const encodedCredentials = this.encodeCredentials(config.matrixUsername, config.matrixPassword);

    return {
      username: config.matrixUsername,
      password: config.matrixPassword,
      encodedCredentials
    };
  }

  encodeCredentials(username: string, password: string): string {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Create base64 encoded credentials for HTTP Basic Authentication
    const credentials = `${username}:${password}`;
    return Buffer.from(credentials, 'utf-8').toString('base64');
  }

  createAuthHeader(credentials: ICredentials): Record<string, string> {
    if (!credentials.encodedCredentials) {
      throw new Error('Encoded credentials are required');
    }

    return {
      'Authorization': `Basic ${credentials.encodedCredentials}`,
      'Content-Type': 'application/json;charset=UTF-8',
      'x-matrix-source': 'WEB',
      'x-time-zone': 'Europe/London'
    };
  }

  async getCurrentUser(credentials: ICredentials): Promise<IUserProfile> {
    const config = this.configManager.getConfig();
    const headers = this.createAuthHeader(credentials);
    
    const response = await globalThis.fetch(`${config.apiBaseUrl}/user/current`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(config.apiTimeout)
    });

    if (!response.ok) {
      throw new Error(`Failed to get current user: ${response.status} ${response.statusText}`);
    }

    const userData = await response.json() as IUserProfile;
    
    // Validate required fields
    if (!userData.personId || !userData.email || !userData.name) {
      throw new Error('Invalid user profile response: missing required fields');
    }

    return userData;
  }
}