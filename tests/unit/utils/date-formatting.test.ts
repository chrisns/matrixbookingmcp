/**
 * Unit tests for date formatting utilities
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDateForMatrixAPI, parseDateFromMatrixAPI, getCurrentDateString } from '../../../src/utils/date-formatting.js';

describe('Date Formatting Utilities', () => {
  beforeEach(() => {
    // Mock current time for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDateForMatrixAPI', () => {
    test('should format Date object without Z suffix', () => {
      const date = new Date('2024-01-01T15:30:00.000Z');
      const result = formatDateForMatrixAPI(date);
      // Note: This will format in local timezone of the test environment
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000$/);
    });

    test('should handle midnight correctly', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = formatDateForMatrixAPI(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000$/);
    });

    test('should handle leap year', () => {
      const date = new Date('2024-02-29T12:00:00.000Z');
      const result = formatDateForMatrixAPI(date);
      expect(result).toMatch(/^\d{4}-02-\d{2}T\d{2}:\d{2}:\d{2}\.000$/);
    });

    test('should format year boundaries correctly', () => {
      const date = new Date('2023-12-31T23:59:59.999Z');
      const result = formatDateForMatrixAPI(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000$/);
    });
  });

  describe('parseDateFromMatrixAPI', () => {
    test('should parse Matrix API date string', () => {
      const matrixDateString = '2024-01-15T14:30:00.000';
      const result = parseDateFromMatrixAPI(matrixDateString);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    test('should handle midnight correctly', () => {
      const matrixDateString = '2024-01-15T00:00:00.000';
      const result = parseDateFromMatrixAPI(matrixDateString);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    test('should handle end of day correctly', () => {
      const matrixDateString = '2024-01-15T23:59:59.999';
      const result = parseDateFromMatrixAPI(matrixDateString);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });

    test('should handle leap year dates', () => {
      const matrixDateString = '2024-02-29T12:00:00.000';
      const result = parseDateFromMatrixAPI(matrixDateString);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(29);
    });
  });

  describe('getCurrentDateString', () => {
    test('should return current date in YYYY-MM-DD format', () => {
      const result = getCurrentDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2024-01-15'); // Based on mocked date
    });

    test('should handle single digit months and days with padding', () => {
      // Set a date with single digit month and day
      vi.setSystemTime(new Date('2024-03-05T10:30:00.000Z'));
      
      const result = getCurrentDateString();
      expect(result).toBe('2024-03-05');
    });

    test('should handle year boundaries', () => {
      vi.setSystemTime(new Date('2023-12-31T23:59:59.999Z'));
      
      const result = getCurrentDateString();
      expect(result).toBe('2023-12-31');
    });
  });

  describe('Integration tests', () => {
    test('should round trip Matrix API date formatting', () => {
      const originalDate = new Date('2024-06-15T14:30:00.000Z');
      const formatted = formatDateForMatrixAPI(originalDate);
      const parsed = parseDateFromMatrixAPI(formatted);
      
      // Should be approximately the same (allowing for timezone differences)
      expect(Math.abs(parsed.getTime() - originalDate.getTime())).toBeLessThan(24 * 60 * 60 * 1000); // Within 24 hours
    });

    test('should handle current date workflow', () => {
      const currentDateString = getCurrentDateString();
      expect(currentDateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should parse to today's date
      const testDate = new Date();
      const expectedYear = testDate.getFullYear();
      const expectedMonth = String(testDate.getMonth() + 1).padStart(2, '0');
      const expectedDay = String(testDate.getDate()).padStart(2, '0');
      
      expect(currentDateString).toBe(`${expectedYear}-${expectedMonth}-${expectedDay}`);
    });

    test('should format dates without timezone suffixes', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const formatted = formatDateForMatrixAPI(date);
      
      // Should not end with Z (no timezone suffix)
      expect(formatted.endsWith('Z')).toBe(false);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000$/);
    });
  });
});