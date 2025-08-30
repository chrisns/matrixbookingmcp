/**
 * Date formatting utilities for the Matrix booking system
 */

/**
 * Get the current date as a string in YYYY-MM-DD format
 * @returns Current date string
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const isoString = now.toISOString();
  const datePart = isoString.split('T')[0];
  return datePart!; // We know this will always have a value
}

/**
 * Format a date to ISO string format for API calls
 * @param date - Date to format
 * @returns ISO string format
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString();
}

/**
 * Legacy alias for formatDateForAPI
 * @param date - Date to format
 * @returns ISO string format
 */
export function formatDateForMatrixAPI(date: Date): string {
  return formatDateForAPI(date);
}

/**
 * Parse a date from Matrix API response
 * @param dateString - Date string from API
 * @returns Parsed Date object
 */
export function parseDateFromMatrixAPI(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Parse a date string and return a Date object
 * @param dateString - Date string to parse
 * @returns Parsed Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Check if a date string is valid
 * @param dateString - Date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param durationMs - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(durationMs: number): string {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let result = '';
  if (hours > 0) {
    result += `${hours}h`;
  }
  if (minutes > 0) {
    result += `${result ? ' ' : ''}${minutes}m`;
  }
  if (!result) {
    result = '0m';
  }
  
  return result;
}