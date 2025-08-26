/**
 * Location management interfaces and types
 */
/* eslint-disable no-unused-vars */

export interface ILocation {
  id: number;
  name: string;
  capacity?: number;
  features?: string[];
}

export interface ILocationService {
  getLocation(_locationId: number): Promise<ILocation>;
  getPreferredLocation(): Promise<ILocation>;
  validateLocationId(_locationId: number): boolean;
}