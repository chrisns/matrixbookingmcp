/**
 * Performance Test Configuration
 * 
 * Centralized configuration for all performance testing scenarios
 */

export const PERFORMANCE_LIMITS = {
  // Memory usage limits (in MB)
  MEMORY_LIMITS: {
    REPEATED_REQUESTS: 10, // 100 repeated requests
    ERROR_SCENARIOS: 5,    // 50 error responses
    CONCURRENT_REQUESTS: 8, // 50 concurrent requests
    MIXED_OPERATIONS: 12,   // 90 mixed operations
    RESOURCE_CLEANUP: 5     // Resource cleanup validation
  },

  // Timeout configurations
  TIMEOUTS: {
    DEFAULT_API_TIMEOUT: 5000,     // 5 seconds
    CUSTOM_SHORT_TIMEOUT: 3000,    // 3 seconds
    CUSTOM_LONG_TIMEOUT: 7000,     // 7 seconds
    TEST_TIMEOUT: 10000,           // 10 seconds for test execution
    K6_TIMEOUT: 5000               // K6 request timeout
  },

  // Performance thresholds
  PERFORMANCE: {
    MAX_RESPONSE_TIME: 5000,       // Maximum response time (ms)
    MAX_VARIANCE_RATIO: 1.5,       // Performance consistency (50% variance)
    MAX_SCALING_RATIO: 2.0,        // Concurrent request scaling
    MIN_SUCCESS_RATE: 0.95,        // 95% success rate
    MAX_TIMEOUT_RATE: 0.01,        // 1% timeout rate
    MAX_ERROR_RATE: 0.05           // 5% error rate
  },

  // Load testing configurations
  LOAD_TESTING: {
    SCENARIOS: {
      LIGHT_LOAD: { vus: 5, duration: '30s' },
      MEDIUM_LOAD: { vus: 25, duration: '2m' },
      HEAVY_LOAD: { vus: 50, duration: '1m' }
    },
    
    STAGES: [
      { duration: '30s', target: 10 },  // Ramp up
      { duration: '1m', target: 10 },   // Steady state
      { duration: '30s', target: 25 },  // Increase load
      { duration: '2m', target: 25 },   // Maintain load
      { duration: '30s', target: 50 },  // Stress test
      { duration: '1m', target: 50 },   // Maintain stress
      { duration: '30s', target: 0 }    // Ramp down
    ]
  }
};

export const TEST_DATA = {
  // Mock credentials for testing
  CREDENTIALS: {
    username: 'testuser',
    password: 'testpass',
    get encodedCredentials() {
      return Buffer.from(`${this.username}:${this.password}`).toString('base64');
    }
  },

  // Common request payloads
  REQUESTS: {
    AVAILABILITY: {
      dateFrom: '2024-01-01T09:00:00.000',
      dateTo: '2024-01-01T17:00:00.000',
      locationId: 1
    },

    BOOKING: {
      timeFrom: '2024-01-01T09:00:00.000',
      timeTo: '2024-01-01T17:00:00.000',
      locationId: 1,
      attendees: [],
      extraRequests: [],
      bookingGroup: { repeatEndDate: '2024-01-01' },
      owner: { id: 1, email: 'test@example.com', name: 'Test User' },
      ownerIsAttendee: true,
      source: 'WEB'
    },

    LOCATION_ID: 1
  },

  // Common response payloads
  RESPONSES: {
    AVAILABILITY: {
      available: true,
      slots: [],
      location: { id: 1, name: 'Test Location' }
    },

    BOOKING: {
      id: 123,
      status: 'CONFIRMED',
      timeFrom: '2024-01-01T09:00:00.000',
      timeTo: '2024-01-01T17:00:00.000',
      organisation: { id: 2147924904, name: 'Test Organization' },
      locationId: 1,
      locationKind: 'DESK',
      owner: { id: 1, email: 'test@example.com', name: 'Test User' },
      bookedBy: { id: 1, email: 'test@example.com', name: 'Test User' },
      attendeeCount: 1,
      ownerIsAttendee: true,
      source: 'WEB',
      version: 1,
      hasExternalNotes: false,
      isPrivate: false,
      duration: { millis: 28800000 },
      possibleActions: {
        edit: true,
        cancel: true,
        approve: false,
        confirm: false,
        endEarly: false,
        changeOwner: false,
        start: false,
        viewHistory: true
      },
      checkInStatus: 'ALLOWED_LATER',
      checkInStartTime: '2024-01-01T08:45:00.000',
      checkInEndTime: '2024-01-01T09:15:00.000',
      hasStarted: false,
      hasEnded: false
    },

    LOCATION: {
      id: 1,
      name: 'Test Location',
      capacity: 10,
      features: ['WiFi', 'Projector']
    }
  }
};

export const ERROR_SCENARIOS = {
  // Different error types for testing
  TIMEOUT: {
    name: 'AbortError',
    message: 'The operation was aborted.'
  },

  NETWORK_ERRORS: [
    { error: new Error('ECONNREFUSED'), expectedCode: 'CONNECTION_REFUSED' },
    { error: new Error('ENOTFOUND'), expectedCode: 'DNS_ERROR' },
    { error: new Error('ETIMEDOUT'), expectedCode: 'CONNECTION_TIMEOUT' },
    { error: new Error('Some other network error'), expectedCode: 'NETWORK_ERROR' }
  ],

  API_ERRORS: [
    {
      status: 400,
      statusText: 'Bad Request',
      body: {
        message: 'Invalid date range provided',
        code: 'INVALID_DATE_RANGE',
        details: {
          dateFrom: '2024-01-01T09:00:00.000',
          dateTo: '2024-01-01T17:00:00.000',
          issue: 'Date range exceeds maximum allowed duration'
        }
      }
    },
    {
      status: 404,
      statusText: 'Not Found',
      body: {
        message: 'Location not found',
        code: 'LOCATION_NOT_FOUND'
      }
    },
    {
      status: 500,
      statusText: 'Internal Server Error',
      body: 'Internal Server Error'
    }
  ]
};

export const K6_CONFIG = {
  // K6-specific configurations
  BASE_URLS: {
    MOCK: 'https://httpbin.org',
    LOCAL: 'http://localhost:3000',
    STAGING: process.env['STAGING_API_URL'] || 'https://staging-api.example.com',
    PRODUCTION: process.env['PRODUCTION_API_URL'] || 'https://api.matrixbooking.com/api/v1'
  },

  HEADERS: {
    'Content-Type': 'application/json;charset=UTF-8',
    'x-matrix-source': 'WEB',
    'x-time-zone': 'Europe/London'
  },

  THRESHOLDS: {
    LOAD_TEST: {
      http_req_duration: ['p(95)<5000'],
      timeout_rate: ['rate<0.01'],
      http_req_failed: ['rate<0.05'],
      request_failures: ['count<100']
    },

    TIMEOUT_TEST: {
      timeout_rate: ['rate>=0.8'],
      actual_timeouts: ['count>50'],
      http_req_duration: ['p(95)<6000'],
      http_req_failed: ['rate>=0.8']
    }
  }
};

export const MONITORING = {
  // Memory monitoring utilities
  getMemoryReport: () => {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      externalMB: Math.round(usage.external / 1024 / 1024 * 100) / 100,
      rssUsedMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100
    };
  },

  // Performance timing utilities
  measurePerformance: async (operation: () => Promise<any>, label?: string) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await operation();
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      return {
        result,
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        label: label || 'operation'
      };
    } catch (error) {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      return {
        error,
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        label: label || 'operation'
      };
    }
  },

  // Garbage collection helper
  triggerGC: () => {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }
};