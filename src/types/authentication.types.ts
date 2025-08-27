/**
 * Authentication and credential management interfaces
 */
/* eslint-disable no-unused-vars */

export interface ICredentials {
  username: string;
  password: string;
  encodedCredentials: string;
}

export interface IUserProfile {
  id: number;           // User account ID
  personId: number;     // Person ID (needed for owner.id in bookings)
  organisationId: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  roles: string[];
}

export interface IAuthenticationManager {
  getCredentials(): ICredentials;
  encodeCredentials(_username: string, _password: string): string;
  createAuthHeader(_credentials: ICredentials): Record<string, string>;
  getCurrentUser(_credentials: ICredentials): Promise<IUserProfile>;
}