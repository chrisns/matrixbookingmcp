import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../../src/validation/input-validator.js';
import { IDateValidationOptions, ILocationValidationOptions } from '../../../src/types/validation.types.js';

describe('InputValidator', () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('validateDate', () => {
    it('should validate a valid ISO 8601 date string', () => {
      const result = validator.validateDate('2024-01-15T10:30:00.000Z');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should validate a valid ISO 8601 date string without milliseconds', () => {
      const result = validator.validateDate('2024-01-15T10:30:00Z');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid date format', () => {
      const result = validator.validateDate('2024-01-15 10:30:00');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
    });

    it('should reject empty or null date string', () => {
      const result = validator.validateDate('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date string is required and must be a string');
    });

    it('should reject invalid date values', () => {
      const result = validator.validateDate('2024-13-45T10:30:00.000Z');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid date value');
    });

    it('should validate date against min/max range', () => {
      const options: IDateValidationOptions = {
        minDate: new Date('2024-01-01T00:00:00Z'),
        maxDate: new Date('2024-12-31T23:59:59Z')
      };

      // Valid date within range
      const validResult = validator.validateDate('2024-06-15T10:30:00.000Z', options);
      expect(validResult.isValid).toBe(true);

      // Date before min
      const tooEarlyResult = validator.validateDate('2023-12-31T23:59:59.000Z', options);
      expect(tooEarlyResult.isValid).toBe(false);
      expect(tooEarlyResult.errors).toContain('Date must be after 2024-01-01T00:00:00.000Z');

      // Date after max
      const tooLateResult = validator.validateDate('2025-01-01T00:00:00.000Z', options);
      expect(tooLateResult.isValid).toBe(false);
      expect(tooLateResult.errors).toContain('Date must be before 2024-12-31T23:59:59.000Z');
    });

    it('should validate timezone option', () => {
      const options: IDateValidationOptions = {
        timezone: 'America/New_York'
      };

      const result = validator.validateDate('2024-01-15T10:30:00.000Z', options);
      expect(result.isValid).toBe(true);

      // Invalid timezone
      const invalidTimezoneOptions: IDateValidationOptions = {
        timezone: 'Invalid/Timezone'
      };

      const invalidResult = validator.validateDate('2024-01-15T10:30:00.000Z', invalidTimezoneOptions);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Invalid timezone: Invalid/Timezone');
    });
  });

  describe('validateTimeRange', () => {
    it('should validate a valid time range', () => {
      const result = validator.validateTimeRange(
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T11:00:00.000Z'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toEqual({
        from: '2024-01-15T10:00:00.000Z',
        to: '2024-01-15T11:00:00.000Z'
      });
    });

    it('should reject when end time is before start time', () => {
      const result = validator.validateTimeRange(
        '2024-01-15T11:00:00.000Z',
        '2024-01-15T10:00:00.000Z'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End time must be after start time');
    });

    it('should reject when end time equals start time', () => {
      const result = validator.validateTimeRange(
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T10:00:00.000Z'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End time must be after start time');
    });

    it('should reject booking duration longer than 24 hours', () => {
      const result = validator.validateTimeRange(
        '2024-01-15T10:00:00.000Z',
        '2024-01-16T11:00:00.000Z'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Booking duration cannot exceed 24 hours');
    });

    it('should propagate individual date validation errors', () => {
      const result = validator.validateTimeRange(
        'invalid-date',
        '2024-01-15T11:00:00.000Z'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('From date invalid'))).toBe(true);
    });
  });

  describe('validateLocationId', () => {
    it('should validate a valid location ID', () => {
      const result = validator.validateLocationId(123);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toBe(123);
    });

    it('should reject non-integer location ID', () => {
      const result = validator.validateLocationId(123.45);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location ID must be a positive integer');
    });

    it('should reject zero or negative location ID', () => {
      const zeroResult = validator.validateLocationId(0);
      expect(zeroResult.isValid).toBe(false);
      expect(zeroResult.errors).toContain('Location ID must be a positive integer');

      const negativeResult = validator.validateLocationId(-1);
      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.errors).toContain('Location ID must be a positive integer');
    });

    it('should reject NaN location ID', () => {
      const result = validator.validateLocationId(NaN);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location ID must be a valid number');
    });

    it('should validate against allowed location IDs', () => {
      const options: ILocationValidationOptions = {
        allowedLocationIds: [1, 2, 3, 5]
      };

      // Valid ID in allowed list
      const validResult = validator.validateLocationId(2, options);
      expect(validResult.isValid).toBe(true);

      // Invalid ID not in allowed list
      const invalidResult = validator.validateLocationId(4, options);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Location ID 4 is not in the allowed list: 1, 2, 3, 5');
    });

    it('should allow any valid ID when no allowed list is specified', () => {
      const result = validator.validateLocationId(999);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateEmailAddress', () => {
    it('should validate a valid email address', () => {
      const result = validator.validateEmailAddress('user@example.com');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toBe('user@example.com');
    });

    it('should validate email with subdomain', () => {
      const result = validator.validateEmailAddress('user@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        ''
      ];

      invalidEmails.forEach(email => {
        const result = validator.validateEmailAddress(email);
        expect(result.isValid).toBe(false);
        // Different emails may have different error messages
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject empty email', () => {
      const result = validator.validateEmailAddress('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address cannot be empty');
    });

    it('should reject email longer than 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // 261 characters
      const result = validator.validateEmailAddress(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address is too long (max 254 characters)');
    });

    it('should trim and lowercase email', () => {
      const result = validator.validateEmailAddress('  User@Example.COM  ');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('user@example.com');
    });

    it('should handle non-string input', () => {
      const result = validator.validateEmailAddress(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address is required and must be a string');
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags and dangerous characters', () => {
      const input = '<script>alert("xss")</script>Hello & "World"';
      const result = validator.sanitizeString(input);
      // Script content is removed completely by the SCRIPT_REGEX
      expect(result).toBe('Hello &amp; &quot;World&quot;');
    });

    it('should trim whitespace', () => {
      const result = validator.sanitizeString('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should handle empty string', () => {
      const result = validator.sanitizeString('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = validator.sanitizeString(null as any);
      expect(result).toBe('');
    });

    it('should remove quotes to prevent injection', () => {
      const result = validator.sanitizeString(`It's a "test" string`);
      expect(result).toBe('It&#x27;s a &quot;test&quot; string'); // Escapes quotes instead of removing
    });
  });
});