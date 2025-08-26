import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const timeoutRate = new Rate('timeout_rate');
const responseTime = new Trend('response_time_custom');
const requestFailures = new Counter('request_failures');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '30s', target: 10 },
    // Stay at 10 users for 1 minute
    { duration: '1m', target: 10 },
    // Ramp up to 25 users
    { duration: '30s', target: 25 },
    // Stay at 25 users for 2 minutes
    { duration: '2m', target: 25 },
    // Ramp up to 50 users (stress test)
    { duration: '30s', target: 50 },
    // Stay at 50 users for 1 minute
    { duration: '1m', target: 50 },
    // Ramp down
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // HTTP request duration should be below 5000ms (our timeout limit)
    http_req_duration: ['p(95)<5000'],
    // 99% of requests should complete successfully (not timeout)
    timeout_rate: ['rate<0.01'],
    // Error rate should be low
    http_req_failed: ['rate<0.05'],
    // Request failures should be minimal
    request_failures: ['count<100'],
  },
};

// Base URL for Matrix Booking API (mock server for testing)
const BASE_URL = __ENV.API_BASE_URL || 'https://httpbin.org'; // Using httpbin as mock for testing

// Test credentials (use environment variables in real scenarios)
const credentials = {
  username: __ENV.MATRIX_USERNAME || 'testuser',
  password: __ENV.MATRIX_PASSWORD || 'testpass'
};

// Create base64 encoded credentials for Basic Auth
const encodedCredentials = encoding.b64encode(`${credentials.username}:${credentials.password}`);

// Common headers for Matrix API
const headers = {
  'Authorization': `Basic ${encodedCredentials}`,
  'Content-Type': 'application/json;charset=UTF-8',
  'x-matrix-source': 'WEB',
  'x-time-zone': 'Europe/London'
};

// Test data generators
function generateAvailabilityRequest() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    dateFrom: now.toISOString().split('.')[0],
    dateTo: tomorrow.toISOString().split('.')[0],
    locationId: Math.floor(Math.random() * 10) + 1
  };
}

function generateBookingRequest() {
  const now = new Date();
  const endTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours later
  
  return {
    timeFrom: now.toISOString().split('.')[0],
    timeTo: endTime.toISOString().split('.')[0],
    locationId: Math.floor(Math.random() * 10) + 1,
    attendees: [],
    extraRequests: [],
    bookingGroup: { 
      repeatEndDate: now.toISOString().split('T')[0] 
    },
    owner: { 
      id: 1, 
      email: 'test@example.com', 
      name: 'Load Test User' 
    },
    ownerIsAttendee: true,
    source: 'WEB'
  };
}

export default function () {
  const testScenario = Math.random();
  let response;
  let requestType;
  
  if (testScenario < 0.4) {
    // 40% - Check Availability
    requestType = 'availability';
    const payload = generateAvailabilityRequest();
    
    response = http.post(
      `${BASE_URL}/post`, // Using httpbin /post endpoint as mock
      JSON.stringify(payload),
      {
        headers: headers,
        timeout: '5s' // Match our application timeout
      }
    );
  } else if (testScenario < 0.7) {
    // 30% - Create Booking
    requestType = 'booking';
    const payload = generateBookingRequest();
    
    response = http.post(
      `${BASE_URL}/post`, // Using httpbin /post endpoint as mock
      JSON.stringify(payload),
      {
        headers: headers,
        timeout: '5s'
      }
    );
  } else {
    // 30% - Get Location
    requestType = 'location';
    const locationId = Math.floor(Math.random() * 10) + 1;
    
    response = http.get(
      `${BASE_URL}/get?location=${locationId}`, // Using httpbin /get endpoint as mock
      {
        headers: headers,
        timeout: '5s'
      }
    );
  }
  
  // Record custom metrics
  responseTime.add(response.timings.duration);
  
  // Check for timeout (status code 0 typically indicates timeout)
  const isTimeout = response.status === 0 || response.timings.duration >= 5000;
  timeoutRate.add(isTimeout);
  
  if (!isTimeout) {
    // Validate successful responses
    const checksResult = check(response, {
      [`${requestType}: status is 200`]: (r) => r.status === 200,
      [`${requestType}: response time < 5000ms`]: (r) => r.timings.duration < 5000,
      [`${requestType}: has response body`]: (r) => r.body.length > 0,
      [`${requestType}: content-type is JSON`]: (r) => 
        r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
    });
    
    // Count failures
    if (!checksResult[`${requestType}: status is 200`]) {
      requestFailures.add(1);
    }
  } else {
    console.warn(`${requestType} request timed out after ${response.timings.duration}ms`);
    requestFailures.add(1);
  }
  
  // Add some random think time (0.5 to 2 seconds)
  sleep(Math.random() * 1.5 + 0.5);
}

// Setup function - runs once before the test starts
export function setup() {
  console.log('Starting Matrix Booking MCP Server Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test will simulate Matrix API calls with 5-second timeout enforcement`);
  
  // Test connectivity
  const connectivityTest = http.get(BASE_URL, { timeout: '10s' });
  if (connectivityTest.status !== 200) {
    throw new Error(`Cannot connect to test endpoint: ${BASE_URL}`);
  }
  
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test completes
export function teardown(data) {
  console.log(`Test completed. Started at: ${data.startTime}`);
  console.log('Load test results available in K6 summary');
}

// Handle different test scenarios
export function checkAvailabilityScenario() {
  const payload = generateAvailabilityRequest();
  
  const response = http.post(
    `${BASE_URL}/post`,
    JSON.stringify(payload),
    {
      headers: headers,
      timeout: '5s',
      tags: { scenario: 'availability' }
    }
  );
  
  check(response, {
    'availability: status is 200': (r) => r.status === 200,
    'availability: no timeout': (r) => r.timings.duration < 5000,
  });
  
  return response;
}

export function createBookingScenario() {
  const payload = generateBookingRequest();
  
  const response = http.post(
    `${BASE_URL}/post`,
    JSON.stringify(payload),
    {
      headers: headers,
      timeout: '5s',
      tags: { scenario: 'booking' }
    }
  );
  
  check(response, {
    'booking: status is 200': (r) => r.status === 200,
    'booking: no timeout': (r) => r.timings.duration < 5000,
  });
  
  return response;
}

export function getLocationScenario() {
  const locationId = Math.floor(Math.random() * 10) + 1;
  
  const response = http.get(
    `${BASE_URL}/get?location=${locationId}`,
    {
      headers: headers,
      timeout: '5s',
      tags: { scenario: 'location' }
    }
  );
  
  check(response, {
    'location: status is 200': (r) => r.status === 200,
    'location: no timeout': (r) => r.timings.duration < 5000,
  });
  
  return response;
}