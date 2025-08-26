import {
  IInputValidator,
  IValidationResult,
  IDateValidationOptions,
  ILocationValidationOptions
} from '../types/validation.types.js';

export class InputValidator implements IInputValidator {
  private static readonly ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  validateDate(dateString: string, options?: IDateValidationOptions): IValidationResult {
    const errors: string[] = [];
    
    if (!dateString || typeof dateString !== 'string') {
      errors.push('Date string is required and must be a string');
      return { isValid: false, errors };
    }

    // Validate ISO 8601 format
    if (!InputValidator.ISO_8601_REGEX.test(dateString)) {
      errors.push('Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
      return { isValid: false, errors };
    }

    // Parse date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date value');
      return { isValid: false, errors };
    }

    // Validate date range if specified
    if (options?.minDate && date < options.minDate) {
      errors.push(`Date must be after ${options.minDate.toISOString()}`);
    }
    
    if (options?.maxDate && date > options.maxDate) {
      errors.push(`Date must be before ${options.maxDate.toISOString()}`);
    }

    // Validate timezone if specified
    if (options?.timezone) {
      try {
        // Test if timezone is valid by attempting to format a date with it
        new Intl.DateTimeFormat('en-US', { timeZone: options.timezone });
      } catch {
        errors.push(`Invalid timezone: ${options.timezone}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: date.toISOString()
    };
  }

  validateTimeRange(fromDate: string, toDate: string, options?: IDateValidationOptions): IValidationResult {
    const errors: string[] = [];
    
    // Validate individual dates
    const fromValidation = this.validateDate(fromDate, options);
    const toValidation = this.validateDate(toDate, options);
    
    if (!fromValidation.isValid) {
      errors.push(`From date invalid: ${fromValidation.errors.join(', ')}`);
    }
    
    if (!toValidation.isValid) {
      errors.push(`To date invalid: ${toValidation.errors.join(', ')}`);
    }
    
    // If both dates are valid, check time range
    if (fromValidation.isValid && toValidation.isValid) {
      const fromDateTime = new Date(fromDate);
      const toDateTime = new Date(toDate);
      
      if (toDateTime <= fromDateTime) {
        errors.push('End time must be after start time');
      }
      
      // Check for reasonable booking duration (max 24 hours)
      const durationHours = (toDateTime.getTime() - fromDateTime.getTime()) / (1000 * 60 * 60);
      if (durationHours > 24) {
        errors.push('Booking duration cannot exceed 24 hours');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: errors.length === 0 ? { from: fromDate, to: toDate } : undefined
    };
  }

  validateLocationId(locationId: number, options?: ILocationValidationOptions): IValidationResult {
    const errors: string[] = [];
    
    if (typeof locationId !== 'number' || isNaN(locationId)) {
      errors.push('Location ID must be a valid number');
      return { isValid: false, errors };
    }
    
    if (!Number.isInteger(locationId) || locationId <= 0) {
      errors.push('Location ID must be a positive integer');
      return { isValid: false, errors };
    }
    
    // Validate against allowed location IDs if specified
    if (options?.allowedLocationIds && options.allowedLocationIds.length > 0) {
      if (!options.allowedLocationIds.includes(locationId)) {
        errors.push(`Location ID ${locationId} is not in the allowed list: ${options.allowedLocationIds.join(', ')}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: locationId
    };
  }

  validateEmailAddress(email: string): IValidationResult {
    const errors: string[] = [];
    
    if (!email || typeof email !== 'string') {
      errors.push('Email address is required and must be a string');
      return { isValid: false, errors };
    }
    
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      errors.push('Email address cannot be empty');
      return { isValid: false, errors };
    }
    
    if (!InputValidator.EMAIL_REGEX.test(trimmedEmail)) {
      errors.push('Email address format is invalid');
    }
    
    if (trimmedEmail.length > 254) {
      errors.push('Email address is too long (max 254 characters)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: trimmedEmail.toLowerCase()
    };
  }

  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Use the more sophisticated sanitizer from InputSanitizer
    // This is a simplified version for basic use cases
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[&]/g, '&amp;') // Escape ampersands first
      .replace(/[<]/g, '&lt;') // Escape less than
      .replace(/[>]/g, '&gt;') // Escape greater than  
      .replace(/["]/g, '&quot;') // Escape quotes
      .replace(/[']/g, '&#x27;') // Escape single quotes
      .trim(); // Remove leading/trailing whitespace
  }
}