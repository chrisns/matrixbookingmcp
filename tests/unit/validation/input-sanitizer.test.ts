import { describe, it, expect } from 'vitest';
import { InputSanitizer } from '../../../src/validation/input-sanitizer.js';
import { ISanitizationOptions } from '../../../src/types/validation.types.js';

describe('InputSanitizer', () => {
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer();
  });

  describe('sanitizeString', () => {
    it('should remove script tags by default', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizer.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should remove HTML tags by default', () => {
      const input = '<div><p>Hello</p><span>World</span></div>';
      const result = sanitizer.sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should escape dangerous characters', () => {
      const input = 'Hello & "World" <tag> \'test\'';
      const result = sanitizer.sanitizeString(input);
      expect(result).toBe('Hello &amp; &quot;World&quot;  &#x27;test&#x27;');
    });

    it('should preserve HTML when stripHtml is false', () => {
      const options: ISanitizationOptions = { stripHtml: false };
      const input = '<p>Hello World</p>';
      const result = sanitizer.sanitizeString(input, options);
      expect(result).toBe('&lt;p&gt;Hello World&lt;/p&gt;');
    });

    it('should not trim whitespace when trimWhitespace is false', () => {
      const options: ISanitizationOptions = { trimWhitespace: false };
      const input = '  Hello World  ';
      const result = sanitizer.sanitizeString(input, options);
      expect(result).toBe('  Hello World  ');
    });

    it('should apply max length limit', () => {
      const options: ISanitizationOptions = { maxLength: 5 };
      const input = 'Hello World';
      const result = sanitizer.sanitizeString(input, options);
      expect(result).toBe('Hello');
    });

    it('should filter by allowed characters', () => {
      const options: ISanitizationOptions = { allowedCharacters: /[a-zA-Z\s]/ };
      const input = 'Hello123World!@#';
      const result = sanitizer.sanitizeString(input, options);
      expect(result).toBe('HelloWorld'); // No space because there wasn't one in original
    });

    it('should handle empty string', () => {
      const result = sanitizer.sanitizeString('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizer.sanitizeString(null as any);
      expect(result).toBe('');
    });

    it('should handle complex XSS attempts', () => {
      const xssAttempts = [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      xssAttempts.forEach(xss => {
        const result = sanitizer.sanitizeString(xss);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
      });

      // Test javascript: separately since it gets removed
      const jsResult = sanitizer.sanitizeString('javascript:alert(1)');
      expect(jsResult).toBe('alert(1)');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize a valid email', () => {
      const result = sanitizer.sanitizeEmail('User@Example.COM');
      expect(result).toBe('user@example.com');
    });

    it('should remove dangerous characters from email', () => {
      const result = sanitizer.sanitizeEmail('user<script>@example.com');
      expect(result).toBe('userscript@example.com');
    });

    it('should return empty string for invalid email format', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com'
      ];

      invalidEmails.forEach(email => {
        const result = sanitizer.sanitizeEmail(email);
        expect(result).toBe('');
      });
    });

    it('should return empty string for email longer than 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = sanitizer.sanitizeEmail(longEmail);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizer.sanitizeEmail(null as any);
      expect(result).toBe('');
    });

    it('should trim email', () => {
      const result = sanitizer.sanitizeEmail('  user@example.com  ');
      expect(result).toBe('user@example.com');
    });
  });

  describe('sanitizeNumericId', () => {
    it('should handle valid numeric input', () => {
      const result = sanitizer.sanitizeNumericId(123);
      expect(result).toBe(123);
    });

    it('should handle valid string numeric input', () => {
      const result = sanitizer.sanitizeNumericId('123');
      expect(result).toBe(123);
    });

    it('should remove non-numeric characters from string', () => {
      const result = sanitizer.sanitizeNumericId('abc123def456');
      expect(result).toBe(123456);
    });

    it('should return null for invalid numeric input', () => {
      const invalidInputs = [
        NaN,
        -123,
        0,
        123.45,
        '',
        'abc',
        null,
        undefined
      ];

      invalidInputs.forEach(input => {
        const result = sanitizer.sanitizeNumericId(input as any);
        expect(result).toBeNull();
      });
    });

    it('should handle string with only non-numeric characters', () => {
      const result = sanitizer.sanitizeNumericId('abc');
      expect(result).toBeNull();
    });

    it('should handle mixed string and extract numeric part', () => {
      const result = sanitizer.sanitizeNumericId('id-123-test');
      expect(result).toBe(123);
    });
  });

  describe('sanitizeApiParameter', () => {
    it('should sanitize string parameters', () => {
      const result = sanitizer.sanitizeApiParameter('<script>alert(1)</script>Hello', 'string');
      expect(result).toBe('Hello');
    });

    it('should sanitize number parameters', () => {
      const result = sanitizer.sanitizeApiParameter('123abc', 'number');
      expect(result).toBe(123);
    });

    it('should sanitize email parameters', () => {
      const result = sanitizer.sanitizeApiParameter('User@Example.COM', 'email');
      expect(result).toBe('user@example.com');
    });

    it('should sanitize date parameters', () => {
      const result = sanitizer.sanitizeApiParameter('2024-01-15T10:30:00.000Z', 'date');
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should reject invalid date format', () => {
      const result = sanitizer.sanitizeApiParameter('2024/01/15 10:30:00', 'date');
      expect(result).toBeNull();
    });

    it('should handle non-string input for string type', () => {
      const result = sanitizer.sanitizeApiParameter(123, 'string');
      expect(result).toBe('');
    });

    it('should handle non-string input for email type', () => {
      const result = sanitizer.sanitizeApiParameter(123, 'email');
      expect(result).toBe('');
    });

    it('should return null for unknown parameter type', () => {
      const result = sanitizer.sanitizeApiParameter('test', 'unknown' as any);
      expect(result).toBeNull();
    });

    it('should apply max length limit for string parameters', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizer.sanitizeApiParameter(longString, 'string');
      expect(result).toHaveLength(1000); // maxLength: 1000 in implementation
    });
  });

  describe('security tests', () => {
    it('should prevent script injection through various vectors', () => {
      const maliciousInputs = [
        '<script src="http://evil.com/script.js"></script>',
        '<img src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))">',
        '<svg/onload=alert(1)>',
        '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
        'javascript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//'
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizer.sanitizeString(input);
        // These should be removed or neutralized
        expect(result).not.toContain('<script');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror=');
        expect(result).not.toContain('onload=');
        expect(result).not.toContain('onclick=');
        
        // The word "script" might remain but not as HTML tag
        if (result.toLowerCase().includes('script')) {
          expect(result).not.toMatch(/<script[^>]*>/i);
        }
      });
    });

    it('should prevent SQL-like injection patterns', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR 1=1; --",
        "'; INSERT INTO users VALUES ('admin', 'password'); --"
      ];

      sqlInjectionAttempts.forEach(input => {
        const result = sanitizer.sanitizeString(input);
        expect(result).not.toContain("'");
        expect(result).not.toContain('"');
      });
    });

    it('should handle various encoding attempts', () => {
      const encodedInputs = [
        '%3Cscript%3Ealert(1)%3C/script%3E',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e'
      ];

      encodedInputs.forEach(input => {
        const result = sanitizer.sanitizeString(input);
        // Should not contain dangerous patterns after sanitization
        expect(result).not.toMatch(/<script/i);
      });
    });
  });
});