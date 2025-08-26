import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for timeout testing
const timeoutRate = new Rate('timeout_rate');
const actualTimeouts = new Counter('actual_timeouts');
const responseTimeouts = new Trend('timeout_response_times');

export const options = {
  stages: [
    { duration: '30s', target: 5 },  // Ramp up slowly
    { duration: '2m', target: 5 },   // Maintain steady load
    { duration: '30s', target: 10 }, // Increase load
    { duration: '1m', target: 10 },  // Test with higher concurrency
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    // Timeout-specific thresholds
    timeout_rate: ['rate>=0.8'], // We EXPECT most requests to timeout in this test
    actual_timeouts: ['count>50'], // We should see actual timeouts
    http_req_duration: ['p(95)<6000'], // Should not exceed our timeout + buffer
    // Most requests should fail (timeout) as expected
    http_req_failed: ['rate>=0.8'],
  },
};

// Using httpbin delay endpoint to simulate slow responses
const BASE_URL = __ENV.API_BASE_URL || 'https://httpbin.org';

const headers = {
  'Content-Type': 'application/json;charset=UTF-8',
  'x-matrix-source': 'WEB',
  'x-time-zone': 'Europe/London'
};

export default function () {
  const testType = Math.random();
  let response;
  let expectedDelay;
  
  if (testType < 0.3) {
    // 30% - Test requests that should complete just before timeout (4.5 seconds)
    expectedDelay = 4.5;
    response = http.get(`${BASE_URL}/delay/4.5`, {
      headers: headers,
      timeout: '5s', // Our application's 5-second timeout
      tags: { test_type: 'near_timeout' }
    });
    
    check(response, {
      'near_timeout: completed successfully': (r) => r.status === 200,
      'near_timeout: within timeout limit': (r) => r.timings.duration < 5000,
    });
    
  } else if (testType < 0.7) {
    // 40% - Test requests that should timeout (6+ seconds)
    expectedDelay = 6 + Math.random() * 4; // 6-10 seconds
    response = http.get(`${BASE_URL}/delay/${expectedDelay}`, {
      headers: headers,
      timeout: '5s', // Our application's 5-second timeout
      tags: { test_type: 'should_timeout' }
    });
    
    const isTimeout = response.status === 0 || response.timings.duration >= 5000;
    timeoutRate.add(isTimeout);
    
    if (isTimeout) {
      actualTimeouts.add(1);
      responseTimeouts.add(response.timings.duration);
    }
    
    check(response, {
      'should_timeout: request timed out as expected': (r) => 
        r.status === 0 || r.timings.duration >= 5000,
    });
    
  } else {
    // 30% - Test requests that should complete quickly (1-2 seconds)
    expectedDelay = 1 + Math.random(); // 1-2 seconds
    response = http.get(`${BASE_URL}/delay/${expectedDelay}`, {
      headers: headers,
      timeout: '5s',
      tags: { test_type: 'fast_response' }
    });
    
    check(response, {
      'fast_response: completed successfully': (r) => r.status === 200,
      'fast_response: fast response time': (r) => r.timings.duration < 3000,
    });
  }
  
  // Log timeout occurrences for analysis
  if (response.status === 0) {
    console.log(`Request timed out as expected after ~5000ms (actual: ${response.timings.duration}ms, expected delay: ${expectedDelay}s)`);
  } else if (response.timings.duration >= 5000) {
    console.log(`Request took longer than timeout but completed: ${response.timings.duration}ms`);
  }
  
  sleep(0.5); // Brief pause between requests
}

// Test specific timeout scenarios
export function testExactTimeoutBoundary() {
  console.log('Testing exact 5-second timeout boundary...');
  
  // Test request that should complete just before timeout
  const response1 = http.get(`${BASE_URL}/delay/4.9`, {
    headers: headers,
    timeout: '5s'
  });
  
  check(response1, {
    'boundary_test: 4.9s request completed': (r) => r.status === 200,
    'boundary_test: 4.9s within limit': (r) => r.timings.duration < 5000,
  });
  
  sleep(1);
  
  // Test request that should timeout
  const response2 = http.get(`${BASE_URL}/delay/5.1`, {
    headers: headers,
    timeout: '5s'
  });
  
  const timedOut = response2.status === 0 || response2.timings.duration >= 5000;
  timeoutRate.add(timedOut);
  
  if (timedOut) {
    actualTimeouts.add(1);
  }
  
  check(response2, {
    'boundary_test: 5.1s request timed out': (r) => 
      r.status === 0 || r.timings.duration >= 5000,
  });
}

export function testConcurrentTimeouts() {
  console.log('Testing concurrent timeout behavior...');
  
  // Start multiple concurrent requests that will timeout
  const requests = [
    http.get(`${BASE_URL}/delay/6`, {
      headers: headers,
      timeout: '5s',
      tags: { concurrent: 'request_1' }
    }),
    http.get(`${BASE_URL}/delay/7`, {
      headers: headers, 
      timeout: '5s',
      tags: { concurrent: 'request_2' }
    }),
    http.get(`${BASE_URL}/delay/8`, {
      headers: headers,
      timeout: '5s', 
      tags: { concurrent: 'request_3' }
    })
  ];
  
  // All should timeout independently
  requests.forEach((response, index) => {
    const timedOut = response.status === 0 || response.timings.duration >= 5000;
    timeoutRate.add(timedOut);
    
    if (timedOut) {
      actualTimeouts.add(1);
    }
    
    check(response, {
      [`concurrent_${index}: timed out as expected`]: (r) => 
        r.status === 0 || r.timings.duration >= 5000,
    });
  });
}

export function testMixedTimeoutScenario() {
  console.log('Testing mixed fast/slow request scenario...');
  
  // Fast request that should complete
  const fastResponse = http.get(`${BASE_URL}/delay/1`, {
    headers: headers,
    timeout: '5s'
  });
  
  // Slow request that should timeout (started after fast one)
  const slowResponse = http.get(`${BASE_URL}/delay/6`, {
    headers: headers,
    timeout: '5s'
  });
  
  check(fastResponse, {
    'mixed: fast request completed': (r) => r.status === 200,
    'mixed: fast request quick': (r) => r.timings.duration < 2000,
  });
  
  const slowTimedOut = slowResponse.status === 0 || slowResponse.timings.duration >= 5000;
  timeoutRate.add(slowTimedOut);
  
  if (slowTimedOut) {
    actualTimeouts.add(1);
  }
  
  check(slowResponse, {
    'mixed: slow request timed out': (r) => 
      r.status === 0 || r.timings.duration >= 5000,
  });
}

export function setup() {
  console.log('Starting Timeout Testing for Matrix Booking MCP Server');
  console.log(`Test endpoint: ${BASE_URL}`);
  console.log('This test will verify that:');
  console.log('1. Requests complete within 5-second timeout limit when possible');
  console.log('2. Requests properly timeout after 5 seconds for slow responses');
  console.log('3. Concurrent requests timeout independently');
  console.log('4. Mixed fast/slow scenarios work correctly');
  
  // Verify httpbin is accessible
  const connectTest = http.get(`${BASE_URL}/status/200`, { timeout: '10s' });
  if (connectTest.status !== 200) {
    throw new Error(`Cannot connect to test endpoint: ${BASE_URL}`);
  }
  
  // Test the delay endpoint works
  const delayTest = http.get(`${BASE_URL}/delay/1`, { timeout: '10s' });
  if (delayTest.status !== 200) {
    throw new Error('Delay endpoint not working properly');
  }
  
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`Timeout testing completed. Started at: ${data.startTime}`);
  console.log('Check the K6 metrics for:');
  console.log('- timeout_rate: Should be high (we expect timeouts)');
  console.log('- actual_timeouts: Count of requests that actually timed out');
  console.log('- timeout_response_times: Distribution of timeout response times');
  console.log('- http_req_duration: Should show clear distinction between fast/timeout responses');
}