import { describe, it, expect } from 'vitest';
import type { 
  DateString, 
  TimeZoneString, 
  IValidationResult, 
  IDateValidationOptions, 
  ILocationValidationOptions, 
  IInputValidator, 
  ISanitizationOptions, 
  IInputSanitizer 
} from '../../../src/types/validation.types.js';

describe('Validation Types', () => {
  describe('Type aliases', () => {
    it('should define DateString as string type', () => {
      const dateString: DateString = '2024-01-01T12:00:00Z';
      expect(typeof dateString).toBe('string');
    });

    it('should define TimeZoneString as string type', () => {
      const timezone: TimeZoneString = 'America/New_York';
      expect(typeof timezone).toBe('string');
    });

    it('should handle various timezone formats', () => {
      const timezones: TimeZoneString[] = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney'
      ];

      timezones.forEach(tz => {
        expect(typeof tz).toBe('string');
      });
    });
  });

  describe('IValidationResult interface', () => {
    it('should define correct validation result structure', () => {
      const validResult: IValidationResult = {
        isValid: true,
        errors: [],
        sanitizedValue: 'cleaned-value'
      };

      const invalidResult: IValidationResult = {
        isValid: false,
        errors: ['Invalid format', 'Out of range'],
        sanitizedValue: undefined
      };

      expect(validResult).toHaveProperty('isValid');
      expect(validResult).toHaveProperty('errors');
      expect(validResult).toHaveProperty('sanitizedValue');
      expect(typeof validResult.isValid).toBe('boolean');
      expect(Array.isArray(validResult.errors)).toBe(true);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });

    it('should handle optional sanitizedValue', () => {
      const resultWithoutSanitized: IValidationResult = {
        isValid: false,
        errors: ['Validation failed']
      };

      expect(resultWithoutSanitized.sanitizedValue).toBeUndefined();
    });

    it('should handle empty error arrays', () => {
      const validResultNoErrors: IValidationResult = {
        isValid: true,
        errors: []
      };

      expect(validResultNoErrors.errors).toHaveLength(0);
      expect(validResultNoErrors.isValid).toBe(true);
    });
  });

  describe('IDateValidationOptions interface', () => {
    it('should define correct date validation options structure', () => {
      const options: IDateValidationOptions = {
        minDate: new Date('2024-01-01'),
        maxDate: new Date('2024-12-31'),
        allowedFormats: ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss'],
        timezone: 'America/New_York'
      };

      expect(options).toHaveProperty('minDate');
      expect(options).toHaveProperty('maxDate');
      expect(options).toHaveProperty('allowedFormats');
      expect(options).toHaveProperty('timezone');
      expect(options.minDate instanceof Date).toBe(true);
      expect(options.maxDate instanceof Date).toBe(true);
      expect(Array.isArray(options.allowedFormats)).toBe(true);
      expect(typeof options.timezone).toBe('string');
    });

    it('should handle all optional properties', () => {
      const emptyOptions: IDateValidationOptions = {};
      const partialOptions: IDateValidationOptions = {
        minDate: new Date()
      };

      expect(emptyOptions.minDate).toBeUndefined();
      expect(partialOptions.maxDate).toBeUndefined();
    });
  });

  describe('ILocationValidationOptions interface', () => {
    it('should define correct location validation options structure', () => {
      const options: ILocationValidationOptions = {
        allowedLocationIds: [1, 2, 3, 100, 200],
        requireLocationId: true
      };

      expect(options).toHaveProperty('allowedLocationIds');
      expect(options).toHaveProperty('requireLocationId');
      expect(Array.isArray(options.allowedLocationIds)).toBe(true);
      expect(typeof options.requireLocationId).toBe('boolean');
      expect(options.allowedLocationIds?.every(id => typeof id === 'number')).toBe(true);
    });

    it('should handle optional properties', () => {
      const emptyOptions: ILocationValidationOptions = {};
      const partialOptions: ILocationValidationOptions = {
        requireLocationId: false
      };

      expect(emptyOptions.allowedLocationIds).toBeUndefined();
      expect(emptyOptions.requireLocationId).toBeUndefined();
      expect(partialOptions.allowedLocationIds).toBeUndefined();
      expect(partialOptions.requireLocationId).toBe(false);
    });
  });

  describe('IInputValidator interface', () => {
    it('should define all required validation methods', () => {
      class MockInputValidator implements IInputValidator {
        validateDate(dateString: string, _options?: IDateValidationOptions): IValidationResult {
          const isValidISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateString);
          return {
            isValid: isValidISO,
            errors: isValidISO ? [] : ['Invalid ISO 8601 format'],
            sanitizedValue: isValidISO ? dateString : undefined
          };
        }

        validateTimeRange(fromDate: string, toDate: string, _options?: IDateValidationOptions): IValidationResult {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          const isValidRange = from < to;
          
          return {
            isValid: isValidRange,
            errors: isValidRange ? [] : ['End time must be after start time']
          };
        }

        validateLocationId(locationId: number, _options?: ILocationValidationOptions): IValidationResult {
          const isValidId = Number.isInteger(locationId) && locationId > 0;
          const isAllowed = !_options?.allowedLocationIds || _options.allowedLocationIds.includes(locationId);
          
          return {
            isValid: isValidId && isAllowed,
            errors: !isValidId ? ['Invalid location ID'] : !isAllowed ? ['Location ID not allowed'] : []
          };
        }

        validateEmailAddress(email: string): IValidationResult {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const isValid = emailRegex.test(email);
          
          return {
            isValid,
            errors: isValid ? [] : ['Invalid email format'],
            sanitizedValue: isValid ? email.toLowerCase().trim() : undefined
          };
        }

        sanitizeString(input: string): string {
          return input.trim().replace(/[<>]/g, '');
        }
      }

      const validator = new MockInputValidator();

      expect(typeof validator.validateDate).toBe('function');
      expect(typeof validator.validateTimeRange).toBe('function');
      expect(typeof validator.validateLocationId).toBe('function');
      expect(typeof validator.validateEmailAddress).toBe('function');
      expect(typeof validator.sanitizeString).toBe('function');

      // Test method functionality
      const dateResult = validator.validateDate('2024-01-01T12:00:00Z');
      expect(dateResult.isValid).toBe(true);

      const emailResult = validator.validateEmailAddress('test@example.com');
      expect(emailResult.isValid).toBe(true);

      const sanitized = validator.sanitizeString('  <script>alert("test")</script>  ');
      expect(sanitized).toBe('scriptalert("test")/script');
    });

    it('should handle edge cases in validation', () => {
      class TestValidator implements IInputValidator {
        validateDate(dateString: string, _options?: IDateValidationOptions): IValidationResult {
          try {
            const date = new Date(dateString);
            const isValid = !isNaN(date.getTime());
            
            if (!isValid) {
              return { isValid: false, errors: ['Invalid date'] };
            }

            if (_options?.minDate && date < _options.minDate) {
              return { isValid: false, errors: ['Date is before minimum allowed'] };
            }

            if (_options?.maxDate && date > _options.maxDate) {
              return { isValid: false, errors: ['Date is after maximum allowed'] };
            }

            return { isValid: true, errors: [], sanitizedValue: date.toISOString() };
          } catch {
            return { isValid: false, errors: ['Date parsing failed'] };
          }
        }

        validateTimeRange(fromDate: string, toDate: string): IValidationResult {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          
          if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return { isValid: false, errors: ['Invalid date format in range'] };
          }
          
          if (from >= to) {
            return { isValid: false, errors: ['Start time must be before end time'] };
          }
          
          return { isValid: true, errors: [] };
        }

        validateLocationId(locationId: number, _options?: ILocationValidationOptions): IValidationResult {
          if (!Number.isInteger(locationId)) {
            return { isValid: false, errors: ['Location ID must be an integer'] };
          }
          
          if (locationId <= 0) {
            return { isValid: false, errors: ['Location ID must be positive'] };
          }
          
          return { isValid: true, errors: [] };
        }

        validateEmailAddress(email: string): IValidationResult {
          const trimmed = email.trim();
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          
          return {
            isValid: emailRegex.test(trimmed),
            errors: emailRegex.test(trimmed) ? [] : ['Invalid email format'],
            sanitizedValue: emailRegex.test(trimmed) ? trimmed.toLowerCase() : undefined
          };
        }

        sanitizeString(input: string): string {
          return input.replace(/[<>&"']/g, '').trim();
        }
      }

      const validator = new TestValidator();
      
      const dateWithRange = validator.validateDate('2024-01-01', {
        minDate: new Date('2023-01-01'),
        maxDate: new Date('2025-01-01')
      });
      expect(dateWithRange.isValid).toBe(true);

      const invalidRange = validator.validateTimeRange('2024-01-01T12:00:00Z', '2024-01-01T10:00:00Z');
      expect(invalidRange.isValid).toBe(false);

      const negativeLocation = validator.validateLocationId(-1);
      expect(negativeLocation.isValid).toBe(false);

      const emailWithSpaces = validator.validateEmailAddress('  TEST@EXAMPLE.COM  ');
      expect(emailWithSpaces.isValid).toBe(true);
      expect(emailWithSpaces.sanitizedValue).toBe('test@example.com');
    });
  });

  describe('ISanitizationOptions interface', () => {
    it('should define correct sanitization options structure', () => {
      const options: ISanitizationOptions = {
        stripHtml: true,
        trimWhitespace: true,
        maxLength: 100,
        allowedCharacters: /^[a-zA-Z0-9\s]+$/
      };

      expect(options).toHaveProperty('stripHtml');
      expect(options).toHaveProperty('trimWhitespace');
      expect(options).toHaveProperty('maxLength');
      expect(options).toHaveProperty('allowedCharacters');
      expect(typeof options.stripHtml).toBe('boolean');
      expect(typeof options.trimWhitespace).toBe('boolean');
      expect(typeof options.maxLength).toBe('number');
      expect(options.allowedCharacters instanceof RegExp).toBe(true);
    });

    it('should handle all optional properties', () => {
      const emptyOptions: ISanitizationOptions = {};
      const partialOptions: ISanitizationOptions = {
        stripHtml: true,
        maxLength: 50
      };

      expect(emptyOptions.stripHtml).toBeUndefined();
      expect(partialOptions.trimWhitespace).toBeUndefined();
    });
  });

  describe('IInputSanitizer interface', () => {
    it('should define all required sanitization methods', () => {
      class MockInputSanitizer implements IInputSanitizer {
        sanitizeString(input: string, options?: ISanitizationOptions): string {
          let result = input;
          
          if (options?.stripHtml) {
            result = result.replace(/<[^>]*>/g, '');
          }
          
          if (options?.trimWhitespace) {
            result = result.trim();
          }
          
          if (options?.maxLength && result.length > options.maxLength) {
            result = result.substring(0, options.maxLength);
          }
          
          return result;
        }

        sanitizeEmail(email: string): string {
          return email.trim().toLowerCase();
        }

        sanitizeNumericId(id: string | number): number | null {
          const num = typeof id === 'string' ? parseInt(id, 10) : id;
          return Number.isInteger(num) && num > 0 ? num : null;
        }
      }

      const sanitizer = new MockInputSanitizer();

      expect(typeof sanitizer.sanitizeString).toBe('function');
      expect(typeof sanitizer.sanitizeEmail).toBe('function');
      expect(typeof sanitizer.sanitizeNumericId).toBe('function');

      // Test method functionality
      const sanitizedString = sanitizer.sanitizeString('<p>Hello</p>  ', {
        stripHtml: true,
        trimWhitespace: true
      });
      expect(sanitizedString).toBe('Hello');

      const sanitizedEmail = sanitizer.sanitizeEmail('  TEST@EXAMPLE.COM  ');
      expect(sanitizedEmail).toBe('test@example.com');

      const sanitizedId = sanitizer.sanitizeNumericId('123');
      expect(sanitizedId).toBe(123);

      const invalidId = sanitizer.sanitizeNumericId('invalid');
      expect(invalidId).toBeNull();
    });

    it('should handle complex sanitization scenarios', () => {
      class AdvancedSanitizer implements IInputSanitizer {
        sanitizeString(input: string, options?: ISanitizationOptions): string {
          let result = input;
          
          if (options?.stripHtml) {
            result = result.replace(/<script[^>]*>.*?<\/script>/gi, '');
            result = result.replace(/<[^>]*>/g, '');
          }
          
          if (options?.allowedCharacters) {
            result = result.split('').filter(char => 
              options.allowedCharacters!.test(char)
            ).join('');
          }
          
          if (options?.trimWhitespace) {
            result = result.trim().replace(/\s+/g, ' ');
          }
          
          if (options?.maxLength) {
            result = result.substring(0, options.maxLength);
          }
          
          return result;
        }

        sanitizeEmail(email: string): string {
          const cleaned = email.trim().toLowerCase();
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          return emailRegex.test(cleaned) ? cleaned : '';
        }

        sanitizeNumericId(id: string | number): number | null {
          if (typeof id === 'number') {
            return Number.isInteger(id) && id > 0 ? id : null;
          }
          
          const cleaned = id.replace(/[^\d]/g, '');
          const num = parseInt(cleaned, 10);
          return !isNaN(num) && num > 0 ? num : null;
        }
      }

      const sanitizer = new AdvancedSanitizer();

      const maliciousScript = sanitizer.sanitizeString(
        '<script>alert("xss")</script><p>Safe content</p>',
        { stripHtml: true, trimWhitespace: true }
      );
      expect(maliciousScript).toBe('Safe content');

      const restrictedChars = sanitizer.sanitizeString(
        'Hello@#$%World123',
        { allowedCharacters: /^[a-zA-Z0-9\s]+$/ }
      );
      expect(restrictedChars).toBe('HelloWorld123');

      const invalidEmail = sanitizer.sanitizeEmail('invalid-email');
      expect(invalidEmail).toBe('');

      const messyId = sanitizer.sanitizeNumericId('id-123-test');
      expect(messyId).toBe(123);
    });
  });
});