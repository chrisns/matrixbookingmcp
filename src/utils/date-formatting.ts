/**
 * Date formatting utilities for Matrix Booking API
 * 
 * IMPORTANT: Matrix API expects dates in local timezone format (no Z suffix),
 * NOT in UTC format. This is critical for correct booking times.
 */

/**
 * Formats a Date object for Matrix API consumption.
 * 
 * Matrix API expects format: "YYYY-MM-DDTHH:mm:ss.sss" (no Z suffix)
 * This represents the time in the location's local timezone.
 * 
 * @param date - The Date object to format
 * @returns Formatted date string for Matrix API
 */
export function formatDateForMatrixAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;
}

/**
 * Creates a Date object from Matrix API date string.
 * 
 * @param matrixDateString - Date string from Matrix API (YYYY-MM-DDTHH:mm:ss.sss)
 * @returns Date object representing the local time
 */
export function parseDateFromMatrixAPI(matrixDateString: string): Date {
  // Matrix API dates are in local timezone, so we parse them as such
  // by adding 'Z' temporarily and then adjusting for timezone offset
  const tempDate = new Date(matrixDateString + 'Z');
  const timezoneOffset = new Date().getTimezoneOffset();
  return new Date(tempDate.getTime() + (timezoneOffset * 60 * 1000));
}

/**
 * Gets the current date in YYYY-MM-DD format.
 * 
 * @returns Current date in YYYY-MM-DD format
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}