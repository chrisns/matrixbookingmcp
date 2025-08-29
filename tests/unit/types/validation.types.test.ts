import { describe, it, expect } from 'vitest';
import type { 
  DateString, 
  TimeZoneString, 
  IValidationResult, 
  IDateValidationOptions, 
  ILocationValidationOptions, 
  IInputValidator, 
  ISanitizationOptions, 
  IInputSanitizer,
  IBookingIdValidationOptions,
  IBookingIdValidation
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

        validateBookingId(bookingId: string | number, _options?: IBookingIdValidationOptions): IBookingIdValidation {
          const errors: string[] = [];
          let numericValue: number;

          if (typeof bookingId === 'number') {
            numericValue = bookingId;
          } else {
            numericValue = parseInt(bookingId, 10);
            if (isNaN(numericValue)) {
              errors.push('Invalid booking ID format');
            }
          }

          if (numericValue <= 0) {
            errors.push('Booking ID must be positive');
          }

          return {
            isValid: errors.length === 0,
            errors
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

        validateBookingId(bookingId: string | number, _options?: IBookingIdValidationOptions): IBookingIdValidation {
          const errors: string[] = [];
          let numericValue: number;

          if (typeof bookingId === 'number') {
            numericValue = bookingId;
          } else {
            numericValue = parseInt(bookingId, 10);
            if (isNaN(numericValue)) {
              errors.push('Invalid booking ID format');
            }
          }

          if (numericValue <= 0) {
            errors.push('Booking ID must be positive');
          }

          return {
            isValid: errors.length === 0,
            errors
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

  describe('IBookingIdValidationOptions interface', () => {
    it('should define correct booking ID validation options structure', () => {
      const options: IBookingIdValidationOptions = {
        allowStringFormat: true,
        requirePositiveNumber: true,
        minValue: 1
      };

      expect(options).toHaveProperty('allowStringFormat');
      expect(options).toHaveProperty('requirePositiveNumber');
      expect(options).toHaveProperty('minValue');
      expect(typeof options.allowStringFormat).toBe('boolean');
      expect(typeof options.requirePositiveNumber).toBe('boolean');
      expect(typeof options.minValue).toBe('number');
    });

    it('should handle all optional properties', () => {
      const emptyOptions: IBookingIdValidationOptions = {};
      const partialOptions: IBookingIdValidationOptions = {
        allowStringFormat: false,
        minValue: 100
      };

      expect(emptyOptions.allowStringFormat).toBeUndefined();
      expect(emptyOptions.requirePositiveNumber).toBeUndefined();
      expect(emptyOptions.minValue).toBeUndefined();
      
      expect(partialOptions.allowStringFormat).toBe(false);
      expect(partialOptions.requirePositiveNumber).toBeUndefined();
      expect(partialOptions.minValue).toBe(100);
    });

    it('should support different validation configurations', () => {
      const strictOptions: IBookingIdValidationOptions = {
        allowStringFormat: false,
        requirePositiveNumber: true,
        minValue: 1
      };

      const flexibleOptions: IBookingIdValidationOptions = {
        allowStringFormat: true,
        requirePositiveNumber: false,
        minValue: 0
      };

      expect(strictOptions.allowStringFormat).toBe(false);
      expect(strictOptions.requirePositiveNumber).toBe(true);
      expect(strictOptions.minValue).toBe(1);

      expect(flexibleOptions.allowStringFormat).toBe(true);
      expect(flexibleOptions.requirePositiveNumber).toBe(false);
      expect(flexibleOptions.minValue).toBe(0);
    });
  });

  describe('IBookingIdValidation interface', () => {
    it('should define correct booking ID validation result structure', () => {
      const validResult: IBookingIdValidation = {
        isValid: true,
        errors: []
      };

      const invalidResult: IBookingIdValidation = {
        isValid: false,
        errors: ['Booking ID must be a positive number', 'Booking ID cannot be zero']
      };

      expect(validResult).toHaveProperty('isValid');
      expect(validResult).toHaveProperty('errors');
      expect(typeof validResult.isValid).toBe('boolean');
      expect(Array.isArray(validResult.errors)).toBe(true);

      expect(invalidResult).toHaveProperty('isValid');
      expect(invalidResult).toHaveProperty('errors');
      expect(typeof invalidResult.isValid).toBe('boolean');
      expect(Array.isArray(invalidResult.errors)).toBe(true);
      expect(invalidResult.errors.length).toBe(2);
    });

    it('should handle valid booking ID validation results', () => {
      const successResults: IBookingIdValidation[] = [
        { isValid: true, errors: [] },
        { isValid: true, errors: [] }
      ];

      successResults.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should handle invalid booking ID validation results with error messages', () => {
      const errorResults: IBookingIdValidation[] = [
        { isValid: false, errors: ['Booking ID is required'] },
        { isValid: false, errors: ['Booking ID must be numeric'] },
        { isValid: false, errors: ['Booking ID must be positive', 'Booking ID below minimum value'] }
      ];

      errorResults.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        result.errors.forEach(error => {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
        });
      });
    });

    it('should support multiple error scenarios', () => {
      const multipleErrors: IBookingIdValidation = {
        isValid: false,
        errors: [
          'Booking ID cannot be empty',
          'Booking ID must be numeric',
          'Booking ID must be positive',
          'Booking ID below minimum threshold'
        ]
      };

      expect(multipleErrors.isValid).toBe(false);
      expect(multipleErrors.errors.length).toBe(4);
      multipleErrors.errors.forEach(error => {
        expect(typeof error).toBe('string');
        expect(error.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('IInputValidator interface extension', () => {
    it('should support optional validateBookingId method', () => {
      class TestValidatorWithBookingId implements IInputValidator {
        validateDate(_dateString: string, _options?: IDateValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateTimeRange(_fromDate: string, _toDate: string, _options?: IDateValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateLocationId(_locationId: number, _options?: ILocationValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateBookingId(bookingId: string | number, options?: IBookingIdValidationOptions): IBookingIdValidation {
          const errors: string[] = [];

          // Check if booking ID is provided
          if (bookingId === null || bookingId === undefined || bookingId === '') {
            errors.push('Booking ID is required');
            return { isValid: false, errors };
          }

          // Convert string to number if needed
          let numericId: number;
          if (typeof bookingId === 'string') {
            if (!options?.allowStringFormat) {
              errors.push('Booking ID must be numeric, not string');
            }
            numericId = parseInt(bookingId, 10);
            if (isNaN(numericId)) {
              errors.push('Booking ID must be a valid number');
              return { isValid: false, errors };
            }
          } else {
            numericId = bookingId;
          }

          // Validate positive number
          if (options?.requirePositiveNumber !== false && numericId <= 0) {
            errors.push('Booking ID must be positive');
          }

          // Validate minimum value
          if (options?.minValue !== undefined && numericId < options.minValue) {
            errors.push(`Booking ID must be at least ${options.minValue}`);
          }

          // Validate integer
          if (!Number.isInteger(numericId)) {
            errors.push('Booking ID must be an integer');
          }

          return {
            isValid: errors.length === 0,
            errors
          };
        }

        validateEmailAddress(_email: string): IValidationResult {
          return { isValid: true, errors: [] };
        }

        sanitizeString(_input: string): string {
          return _input;
        }
      }

      const validator = new TestValidatorWithBookingId();
      expect(validator.validateBookingId).toBeDefined();
      expect(typeof validator.validateBookingId).toBe('function');

      // Test valid numeric booking ID
      const validNumeric = validator.validateBookingId(12345);
      expect(validNumeric.isValid).toBe(true);
      expect(validNumeric.errors).toEqual([]);

      // Test valid string booking ID with allowStringFormat
      const validString = validator.validateBookingId('12345', { allowStringFormat: true });
      expect(validString.isValid).toBe(true);
      expect(validString.errors).toEqual([]);

      // Test invalid string booking ID without allowStringFormat
      const invalidString = validator.validateBookingId('12345');
      expect(invalidString.isValid).toBe(false);
      expect(invalidString.errors).toContain('Booking ID must be numeric, not string');

      // Test negative booking ID
      const negative = validator.validateBookingId(-1);
      expect(negative.isValid).toBe(false);
      expect(negative.errors).toContain('Booking ID must be positive');

      // Test with minimum value
      const belowMin = validator.validateBookingId(5, { minValue: 10 });
      expect(belowMin.isValid).toBe(false);
      expect(belowMin.errors).toContain('Booking ID must be at least 10');

      // Test invalid string value
      const invalidValue = validator.validateBookingId('abc', { allowStringFormat: true });
      expect(invalidValue.isValid).toBe(false);
      expect(invalidValue.errors).toContain('Booking ID must be a valid number');

      // Test empty string
      const emptyString = validator.validateBookingId('');
      expect(emptyString.isValid).toBe(false);
      expect(emptyString.errors).toContain('Booking ID is required');
    });

    it('should require validateBookingId method in all validators', () => {
      class TestValidatorWithoutBookingId implements IInputValidator {
        validateDate(_dateString: string, _options?: IDateValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateTimeRange(_fromDate: string, _toDate: string, _options?: IDateValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateLocationId(_locationId: number, _options?: ILocationValidationOptions): IValidationResult {
          return { isValid: true, errors: [] };
        }

        validateBookingId(_bookingId: string | number, _options?: IBookingIdValidationOptions): IBookingIdValidation {
          return {
            isValid: true,
            errors: []
          };
        }

        validateEmailAddress(_email: string): IValidationResult {
          return { isValid: true, errors: [] };
        }

        sanitizeString(_input: string): string {
          return _input;
        }
      }

      const validator = new TestValidatorWithoutBookingId();
      expect(typeof validator.validateBookingId).toBe('function');
    });
  });
});