# Performance and Timeout Testing

This directory contains comprehensive performance and timeout testing for the Matrix Booking MCP Server, implementing **Task 19: Performance and Timeout Testing** as specified in the project requirements.

## Overview

The performance test suite validates the following requirements:

- **5-second API timeout enforcement** (Requirement 8.3)
- **Memory usage stability during extended operation**
- **Load testing scenarios using K6**
- **Timeout error handling and graceful degradation**
- **Stateless architecture performance characteristics**

## Test Structure

### 1. Timeout Testing (`timeout-simple.test.ts`)

**Purpose**: Validates the 5-second timeout limit and proper timeout error handling.

**Key Features**:
- Tests AbortController-based timeout mechanism
- Validates timeout error response structure
- Tests custom timeout configurations
- Verifies concurrent timeout handling
- Tests timeout cleanup on successful requests

**Coverage**:
- ✅ 5-second timeout enforcement via AbortController
- ✅ Proper error codes (`REQUEST_TIMEOUT`) and messages
- ✅ Custom timeout configuration support
- ✅ Concurrent timeout scenario handling
- ✅ Timeout resource cleanup

### 2. Memory Usage Testing (`memory-usage.test.ts`)

**Purpose**: Monitors memory consumption during extended operation to prevent memory leaks.

**Key Features**:
- Tests memory stability during repeated requests (100+ requests)
- Validates memory usage during error scenarios
- Tests concurrent request memory consumption
- Validates resource cleanup (AbortController, timeouts)
- Provides memory profiling utilities

**Memory Limits**:
- Normal operations: < 10MB increase for 100 requests
- Error scenarios: < 5MB increase for 50 error responses
- Concurrent requests: < 8MB increase for 50 concurrent requests
- Mixed operations: < 12MB increase for 90 mixed requests

### 3. Graceful Degradation Testing (`graceful-degradation.test.ts`)

**Purpose**: Ensures proper error handling and service recovery after timeout/error conditions.

**Key Features**:
- Tests meaningful timeout error messages
- Validates concurrent timeout error handling
- Tests service availability after timeout events
- Verifies consistent error structure across operation types
- Tests mixed error/success scenarios

**Error Handling Validation**:
- Unique request IDs for all errors
- Consistent error response structure
- Proper error codes for different network conditions
- Matrix API error preservation during pass-through

### 4. Stateless Architecture Testing (`stateless-architecture.test.ts`)

**Purpose**: Validates stateless design principles and performance characteristics.

**Key Features**:
- Tests multiple independent client instances
- Validates concurrent requests across clients
- Tests no shared state between requests
- Verifies independent error handling per request
- Tests performance consistency regardless of request history

**Performance Characteristics**:
- Linear scaling with concurrent requests
- Consistent performance over time (< 50% variance)
- No state pollution between requests
- Independent timeout configurations per client

### 5. K6 Load Testing (`load-test.js`, `timeout-test.js`)

**Purpose**: HTTP transport testing and load validation using K6.

#### Load Test (`load-test.js`)
**Test Stages**:
1. Ramp up to 10 users (30s)
2. Maintain 10 users (1m)
3. Ramp up to 25 users (30s)
4. Maintain 25 users (2m)
5. Stress test at 50 users (1m)
6. Ramp down (30s)

**Thresholds**:
- 95th percentile response time < 5000ms
- Timeout rate < 1%
- Error rate < 5%
- Request failures < 100

#### Timeout Test (`timeout-test.js`)
**Scenarios**:
- 30% near-timeout requests (4.5s responses)
- 40% should-timeout requests (6-10s responses)  
- 30% fast requests (1-2s responses)

**Expected Results**:
- Most requests should timeout as designed (≥80%)
- Actual timeouts should occur (>50 timeouts)
- Response time within limits (<6000ms)

## Usage

### Running Performance Tests

```bash
# Run all performance tests
npm run test:performance

# Run specific test files
npm test tests/performance/timeout-simple.test.ts
npm test tests/performance/memory-usage.test.ts
npm test tests/performance/graceful-degradation.test.ts
npm test tests/performance/stateless-architecture.test.ts

# Run with coverage
npm run test:coverage tests/performance/
```

### Running K6 Load Tests

```bash
# General load testing
npm run test:k6

# Timeout-specific load testing  
npm run test:k6:timeout

# Custom K6 scenarios
k6 run --duration 30s --vus 10 tests/performance/load-test.js
k6 run --duration 60s --vus 5 tests/performance/timeout-test.js
```

### K6 Test Configuration

Set environment variables for K6 tests:

```bash
export API_BASE_URL="https://your-test-endpoint.com"
export MATRIX_USERNAME="your-username"
export MATRIX_PASSWORD="your-password"
```

**Note**: K6 tests use httpbin.org by default for demonstration. In production, point to your actual Matrix API test environment.

## Performance Metrics

### Timeout Enforcement
- **Requirement**: Requests must timeout after exactly 5 seconds
- **Implementation**: AbortController with setTimeout at 5000ms
- **Validation**: All timeout tests verify 5-second limit enforcement

### Memory Usage
- **Baseline**: Monitor heap usage during extended operation
- **Limits**: Reasonable memory increase thresholds based on operation type
- **Cleanup**: Verify proper resource cleanup after requests complete

### Error Handling
- **Response Time**: Error responses should be generated quickly
- **Consistency**: All errors follow the same response structure
- **Recovery**: Service should remain available after error conditions

### Stateless Performance
- **Independence**: Multiple clients operate independently
- **Scaling**: Linear performance scaling with concurrent requests
- **Consistency**: Performance remains stable over time

## Test Environment Setup

### Prerequisites
- Node.js ≥18.0.0
- K6 installed (via Homebrew or direct download)
- Vitest test framework
- MSW for request mocking

### Environment Variables
```bash
MATRIX_USERNAME=testuser
MATRIX_PASSWORD=testpass
MATRIX_PREFERED_LOCATION=London
MATRIX_API_TIMEOUT=5000
MATRIX_API_BASE_URL=https://app.matrixbooking.com/api/v1
```

### Mock Configuration
Tests use MSW (Mock Service Worker) to simulate Matrix API responses without requiring actual API connectivity.

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Some memory tests may take longer due to garbage collection
   - Solution: Increase test timeout with `vi.setConfig({ testTimeout: 10000 })`

2. **K6 Network Issues**: External endpoints may be unavailable
   - Solution: Update `API_BASE_URL` to point to accessible test endpoint

3. **Memory Test Variance**: Memory usage can vary between runs
   - Solution: Tests include reasonable variance thresholds

4. **Fake Timer Issues**: Complex timing tests may have race conditions
   - Solution: Use simple timeout tests with direct error simulation

### Performance Debugging

Enable detailed logging:
```bash
# Run tests with verbose output
npm test -- --reporter=verbose tests/performance/

# Generate coverage report
npm run test:coverage

# Profile memory usage
node --expose-gc ./node_modules/.bin/vitest tests/performance/memory-usage.test.ts
```

## Integration with CI/CD

### Recommended Pipeline Integration

```yaml
# Example GitHub Actions workflow
performance-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Install dependencies
      run: npm ci
    - name: Install K6
      run: |
        sudo gpg --keyserver keyserver.ubuntu.com --recv-keys 4DB4F2D2 
        curl -s https://dl.k6.io/key.gpg | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/k6.gpg
        sudo apt-get update
        sudo apt-get install k6
    - name: Run performance tests
      run: npm run test:performance
    - name: Run K6 load tests
      run: npm run test:k6
```

### Performance Regression Detection
- Monitor test execution times
- Track memory usage trends
- Alert on timeout threshold violations
- Validate error rate stays within limits

## Future Enhancements

1. **Real API Integration**: Replace httpbin with actual Matrix API endpoints for K6 tests
2. **Performance Benchmarking**: Establish baseline metrics for regression testing
3. **Stress Testing**: Add extreme load scenarios (100+ concurrent users)
4. **Memory Profiling**: Add detailed memory profiling with V8 heap snapshots
5. **Distributed Testing**: K6 distributed testing for higher load scenarios
6. **Monitoring Integration**: Connect to APM tools for production performance tracking

## Compliance

This implementation satisfies:
- ✅ **Requirement 8.3**: API operations timeout after 5 seconds with appropriate error responses
- ✅ **Performance Testing**: Memory usage validation during extended operation
- ✅ **Load Testing**: K6 HTTP transport testing scenarios
- ✅ **Error Handling**: Timeout error handling and graceful degradation
- ✅ **Architecture Validation**: Stateless architecture performance characteristics

All tests maintain the existing codebase patterns and follow the established error handling, authentication, and configuration management approaches.