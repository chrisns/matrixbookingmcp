import { IInputSanitizer, ISanitizationOptions } from '../types/validation.types.js';

export class InputSanitizer implements IInputSanitizer {
  private static readonly HTML_TAG_REGEX = /<[^>]*>/g;
  private static readonly SCRIPT_REGEX = /<script[^>]*>.*?<\/script>/gi;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  sanitizeString(input: string, options?: ISanitizationOptions): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove script tags first (most dangerous)
    sanitized = sanitized.replace(InputSanitizer.SCRIPT_REGEX, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Strip HTML tags if requested (default: true)
    if (options?.stripHtml !== false) {
      sanitized = sanitized.replace(InputSanitizer.HTML_TAG_REGEX, '');
    }

    // Escape dangerous characters - but handle & last to avoid double-encoding
    sanitized = sanitized.replace(/[<>'"]/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        default: return match;
      }
    });
    
    // Handle ampersands - but preserve already encoded entities
    sanitized = sanitized.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');

    // Apply allowed characters filter if specified (before trimming)
    if (options?.allowedCharacters) {
      // Extract the character set from the regex source, handling both [chars] and plain chars patterns
      let charSet = options.allowedCharacters.source;
      if (charSet.startsWith('[') && charSet.endsWith(']')) {
        charSet = charSet.slice(1, -1); // Remove outer brackets
      }
      sanitized = sanitized.replace(new RegExp(`[^${charSet}]`, 'g'), '');
    }

    // Trim whitespace if requested (default: true)
    if (options?.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Apply max length if specified
    if (options?.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
      return '';
    }

    // Basic sanitization
    let sanitized = email.trim().toLowerCase();

    // Remove dangerous characters that shouldn't be in emails
    sanitized = sanitized.replace(/[<>"'&]/g, '');

    // Validate email format and return empty string if invalid
    if (!InputSanitizer.EMAIL_REGEX.test(sanitized)) {
      return '';
    }

    // Additional length check
    if (sanitized.length > 254) {
      return '';
    }

    return sanitized;
  }

  sanitizeNumericId(id: string | number): number | null {
    // Handle number input
    if (typeof id === 'number') {
      if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
        return null;
      }
      return id;
    }

    // Handle string input
    if (typeof id !== 'string') {
      return null;
    }

    // Remove any non-numeric characters
    const cleaned = id.replace(/[^\d]/g, '');
    
    if (cleaned === '') {
      return null;
    }

    const numericId = parseInt(cleaned, 10);
    
    if (isNaN(numericId) || numericId <= 0) {
      return null;
    }

    return numericId;
  }

  /**
   * Comprehensive input sanitization for API parameters
   * This method provides additional security for data going to external APIs
   */
  sanitizeApiParameter(input: unknown, type: 'string' | 'number' | 'email' | 'date'): string | number | null {
    switch (type) {
      case 'string':
        if (typeof input === 'string') {
          return this.sanitizeString(input, {
            stripHtml: true,
            trimWhitespace: true,
            maxLength: 1000
          });
        }
        return '';

      case 'number':
        return this.sanitizeNumericId(input as string | number);

      case 'email':
        if (typeof input === 'string') {
          return this.sanitizeEmail(input);
        }
        return '';

      case 'date':
        if (typeof input === 'string') {
          // Basic date string sanitization
          const sanitized = this.sanitizeString(input, {
            stripHtml: true,
            trimWhitespace: true,
            allowedCharacters: /[\d\-T:.Z]/
          });
          
          // Validate ISO 8601 format
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(sanitized)) {
            return sanitized;
          }
        }
        return null;

      default:
        return null;
    }
  }
}