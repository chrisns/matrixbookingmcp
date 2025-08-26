/**
 * Authentication and credential management interfaces
 */
/* eslint-disable no-unused-vars */

export interface ICredentials {
  username: string;
  password: string;
  encodedCredentials: string;
}

export interface IAuthenticationManager {
  getCredentials(): ICredentials;
  encodeCredentials(_username: string, _password: string): string;
  createAuthHeader(_credentials: ICredentials): Record<string, string>;
}