/**
 * Input validation and sanitization interfaces and types
 */
/* eslint-disable no-unused-vars */

export type DateString = string; // ISO 8601 format
export type TimeZoneString = string; // IANA timezone identifier

export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: unknown;
}

export interface IDateValidationOptions {
  minDate?: Date;
  maxDate?: Date;
  allowedFormats?: string[];
  timezone?: TimeZoneString;
}

export interface ILocationValidationOptions {
  allowedLocationIds?: number[];
  requireLocationId?: boolean;
}

export interface IInputValidator {
  validateDate(_dateString: string, _options?: IDateValidationOptions): IValidationResult;
  validateTimeRange(_fromDate: string, _toDate: string, _options?: IDateValidationOptions): IValidationResult;
  validateLocationId(_locationId: number, _options?: ILocationValidationOptions): IValidationResult;
  validateEmailAddress(_email: string): IValidationResult;
  sanitizeString(_input: string): string;
}

export interface ISanitizationOptions {
  stripHtml?: boolean;
  trimWhitespace?: boolean;
  maxLength?: number;
  allowedCharacters?: RegExp;
}

export interface IInputSanitizer {
  sanitizeString(_input: string, _options?: ISanitizationOptions): string;
  sanitizeEmail(_email: string): string;
  sanitizeNumericId(_id: string | number): number | null;
}