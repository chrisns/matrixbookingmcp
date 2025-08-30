import { config } from 'dotenv';

export interface IServerConfig {
  matrixUsername: string;
  matrixPassword: string;
  matrixPreferredLocation: string;
  apiTimeout: number;
  apiBaseUrl: string;
  cacheEnabled: boolean;
}

export interface IConfigurationManager {
  getConfig(): IServerConfig;
  validateConfig(): void;
  // eslint-disable-next-line no-unused-vars
  updateConfig?(configUpdate: Partial<IServerConfig>): void;
}

export class ConfigurationManager implements IConfigurationManager {
  private serverConfig: IServerConfig | null = null;

  constructor(loadDotenv: boolean = true) {
    if (loadDotenv) {
      // Suppress all dotenv output by redirecting stdout temporarily
      const originalWrite = process.stdout.write;
      process.stdout.write = (): boolean => true;
      try {
        config();
      } finally {
        process.stdout.write = originalWrite;
      }
    }
    this.validateConfig();
    this.serverConfig = this.loadConfig();
  }

  validateConfig(): void {
    const requiredVars = [
      'MATRIX_USERNAME',
      'MATRIX_PASSWORD', 
      'MATRIX_PREFERED_LOCATION'
    ];

    const missingVars = requiredVars.filter(varName => {
      const value = process.env[varName];
      return value === undefined || value === null || value.trim() === '';
    });

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please copy .env.example to .env and configure the required values.`
      );
    }
  }

  getConfig(): IServerConfig {
    if (!this.serverConfig) {
      throw new Error('Configuration not loaded. Call validateConfig() first.');
    }
    return this.serverConfig;
  }

  private loadConfig(): IServerConfig {
    const timeoutString = process.env['MATRIX_API_TIMEOUT'] || '5000';
    const parsedTimeout = parseInt(timeoutString, 10);
    const apiTimeout = isNaN(parsedTimeout) ? 5000 : parsedTimeout;

    const cacheEnabledString = process.env['CACHE_ENABLED'] || 'true';
    const cacheEnabled = cacheEnabledString.toLowerCase() !== 'false';

    return {
      matrixUsername: process.env['MATRIX_USERNAME']!,
      matrixPassword: process.env['MATRIX_PASSWORD']!,
      matrixPreferredLocation: process.env['MATRIX_PREFERED_LOCATION']!,
      apiTimeout,
      apiBaseUrl: process.env['MATRIX_API_BASE_URL'] || 'https://app.matrixbooking.com/api/v1',
      cacheEnabled
    };
  }
}