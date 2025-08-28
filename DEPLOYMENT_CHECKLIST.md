# Matrix Booking MCP Server - Deployment Validation Checklist

## Pre-Deployment Validation

### ✅ Code Quality and Testing

- [ ] **All tests pass**
  ```bash
  npm test
  # Expected: All tests passing (651+ tests)
  ```

- [ ] **Build succeeds without errors**
  ```bash  
  npm run build
  # Expected: Clean TypeScript compilation
  ```

- [ ] **Linting passes**
  ```bash
  npm run lint  # If available
  # Expected: No linting errors
  ```

- [ ] **Security vulnerabilities resolved**
  ```bash
  npm audit
  # Expected: No high/critical vulnerabilities
  ```

### ✅ Configuration Validation

- [ ] **Environment variables configured**
  ```bash
  # Required variables
  echo $MATRIX_USERNAME          # Should be valid email
  echo $MATRIX_API_BASE_URL      # Should include /api/v1
  echo $MATRIX_PASSWORD          # Should be non-empty (don't echo in production)
  ```

- [ ] **Configuration validation passes**
  ```bash
  node -e "
  const requiredVars = ['MATRIX_USERNAME', 'MATRIX_PASSWORD', 'MATRIX_API_BASE_URL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    console.error('Missing variables:', missing);
    process.exit(1);
  }
  console.log('✅ All required environment variables present');
  "
  ```

- [ ] **API URL format validation**
  ```bash
  node -e "
  const url = process.env.MATRIX_API_BASE_URL;
  if (!url || !url.match(/^https?:\/\/.+\/api\/v1$/)) {
    console.error('❌ Invalid API URL format:', url);
    process.exit(1);
  }
  console.log('✅ API URL format valid');
  "
  ```

### ✅ Network Connectivity

- [ ] **Matrix API accessible**
  ```bash
  curl -f --connect-timeout 10 --max-time 30 \
       -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
       "$MATRIX_API_BASE_URL/user/current"
  # Expected: 200 OK with user profile JSON
  ```

- [ ] **Organization API accessible**
  ```bash
  curl -f -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
       "$MATRIX_API_BASE_URL/org" | jq -e '.id'
  # Expected: Organization ID number
  ```

- [ ] **Location API accessible**
  ```bash
  curl -f -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
       "$MATRIX_API_BASE_URL/locations" | jq -e '. | length'
  # Expected: Number of locations > 0
  ```

- [ ] **SSL certificate validation**
  ```bash
  # Should succeed without -k flag
  curl -f "$MATRIX_API_BASE_URL/user/current" \
       -u "$MATRIX_USERNAME:$MATRIX_PASSWORD"
  ```

## Functional Testing

### ✅ MCP Server Startup

- [ ] **Server starts successfully**
  ```bash
  timeout 10 node dist/index.js &
  SERVER_PID=$!
  sleep 2
  if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server started successfully"
    kill $SERVER_PID
  else
    echo "❌ Server failed to start"
    exit 1
  fi
  ```

- [ ] **No startup errors in logs**
  ```bash
  node dist/index.js 2>&1 | timeout 5 grep -i error || echo "✅ No startup errors"
  ```

### ✅ Health Check Validation

- [ ] **Health check tool available**
  ```javascript
  // Test via MCP client or direct tool invocation
  {
    "name": "health_check",
    "arguments": {}
  }
  // Expected: All services "healthy" status
  ```

- [ ] **All services healthy**
  ```bash
  # Manual health check test
  node -e "
  const { MatrixBookingMCPServer } = require('./dist/mcp/mcp-server.js');
  const server = new MatrixBookingMCPServer();
  server.handleHealthCheck({verbose: true})
    .then(result => {
      const health = JSON.parse(result.content[0].text);
      if (health.status !== 'healthy') {
        console.error('❌ Health check failed:', health);
        process.exit(1);
      }
      console.log('✅ All services healthy');
    })
    .catch(err => {
      console.error('❌ Health check error:', err.message);
      process.exit(1);
    });
  "
  ```

### ✅ Core Tool Functionality

- [ ] **User service working**
  ```javascript
  {
    "name": "get_current_user",
    "arguments": {}
  }
  // Expected: User profile with organisationId
  ```

- [ ] **Organization service working**
  ```javascript
  {
    "name": "get_booking_categories", 
    "arguments": {}
  }
  // Expected: Array of booking categories
  ```

- [ ] **Location service working**
  ```javascript
  {
    "name": "get_locations",
    "arguments": {"includeChildren": true}
  }
  // Expected: Location hierarchy with children
  ```

- [ ] **Facility discovery working**
  ```javascript
  {
    "name": "discover_available_facilities",
    "arguments": {}
  }
  // Expected: Facilities grouped by category
  ```

### ✅ Advanced Search Functionality

- [ ] **Natural language search working**
  ```javascript
  {
    "name": "find_rooms_with_facilities",
    "arguments": {
      "query": "meeting room for 6 people",
      "maxResults": 5
    }
  }
  // Expected: Ranked search results with relevance scores
  ```

- [ ] **Facility matching working**
  ```javascript
  {
    "name": "find_rooms_with_facilities", 
    "arguments": {
      "query": "room with projector"
    }
  }
  // Expected: Results with projector facility matches
  ```

- [ ] **Capacity filtering working**
  ```javascript
  {
    "name": "find_rooms_with_facilities",
    "arguments": {
      "query": "room for 12 people"
    }
  }
  // Expected: Results with capacity >= 12
  ```

### ✅ Legacy Tool Compatibility

- [ ] **Availability checking working**
  ```javascript
  {
    "name": "matrix_booking_check_availability",
    "arguments": {
      "dateFrom": "2025-02-01T09:00:00.000Z",
      "dateTo": "2025-02-01T17:00:00.000Z"
    }
  }
  // Expected: Availability response with time slots
  ```

- [ ] **Location lookup working**
  ```javascript
  {
    "name": "matrix_booking_get_location",
    "arguments": {"locationId": 100001}
  }
  // Expected: Location details
  ```

## Performance Validation

### ✅ Response Time Testing

- [ ] **Basic tools respond within 5 seconds**
  ```bash
  # Test get_current_user response time
  time node -e "
  const { MatrixBookingMCPServer } = require('./dist/mcp/mcp-server.js');
  const server = new MatrixBookingMCPServer();
  server.handleGetCurrentUser({})
    .then(() => console.log('✅ User service responsive'))
    .catch(err => {
      console.error('❌ User service timeout:', err.message);
      process.exit(1);
    });
  "
  ```

- [ ] **Search tools respond within 10 seconds**
  ```bash
  # Test search response time
  time node -e "
  const { MatrixBookingMCPServer } = require('./dist/mcp/mcp-server.js');
  const server = new MatrixBookingMCPServer();
  server.handleFindRoomsWithFacilities({
    query: 'meeting room',
    maxResults: 10
  })
    .then(() => console.log('✅ Search service responsive'))
    .catch(err => {
      console.error('❌ Search service timeout:', err.message); 
      process.exit(1);
    });
  "
  ```

### ✅ Memory and Resource Usage

- [ ] **Memory usage within acceptable limits**
  ```bash
  # Monitor memory during typical usage
  node --expose-gc -e "
  const server = require('./dist/mcp/mcp-server.js');
  const mcpServer = new server.MatrixBookingMCPServer();
  
  const initialMem = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log('Initial memory:', initialMem.toFixed(2), 'MB');
  
  // Run multiple operations
  Promise.all([
    mcpServer.handleGetCurrentUser({}),
    mcpServer.handleGetBookingCategories({}),
    mcpServer.handleGetLocations({}),
    mcpServer.handleDiscoverAvailableFacilities({}),
    mcpServer.handleFindRoomsWithFacilities({query: 'test'})
  ]).then(() => {
    if (global.gc) global.gc();
    const finalMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const increase = finalMem - initialMem;
    console.log('Final memory:', finalMem.toFixed(2), 'MB');
    console.log('Memory increase:', increase.toFixed(2), 'MB');
    
    if (increase > 50) {
      console.error('❌ Memory usage too high');
      process.exit(1);
    }
    console.log('✅ Memory usage acceptable');
  });
  "
  ```

### ✅ Concurrent Request Handling

- [ ] **Handle multiple simultaneous requests**
  ```bash
  # Test concurrent request handling
  node -e "
  const { MatrixBookingMCPServer } = require('./dist/mcp/mcp-server.js');
  const server = new MatrixBookingMCPServer();
  
  const concurrentRequests = Array.from({length: 5}, (_, i) =>
    server.handleFindRoomsWithFacilities({
      query: \`test query \${i}\`,
      maxResults: 5
    })
  );
  
  console.time('Concurrent requests');
  Promise.all(concurrentRequests)
    .then(() => {
      console.timeEnd('Concurrent requests');
      console.log('✅ Concurrent requests handled successfully');
    })
    .catch(err => {
      console.error('❌ Concurrent request failure:', err.message);
      process.exit(1);
    });
  "
  ```

## Security Validation

### ✅ Credential Security

- [ ] **Credentials not logged in production**
  ```bash
  # Check for credential leaks in logs
  LOG_LEVEL=info node dist/index.js 2>&1 | timeout 5 \
    grep -E "(password|credential)" || echo "✅ No credential leaks"
  ```

- [ ] **Environment variables properly isolated**
  ```bash
  # Verify sensitive vars not exposed
  node -e "
  const sensitiveVars = ['MATRIX_PASSWORD'];
  const exposed = sensitiveVars.filter(v => 
    JSON.stringify(process.env).includes(process.env[v])
  );
  if (exposed.length) {
    console.error('❌ Sensitive variables exposed:', exposed);
    process.exit(1);
  }
  console.log('✅ Sensitive variables properly isolated');
  "
  ```

### ✅ SSL/TLS Validation

- [ ] **Certificate validation enabled in production**
  ```bash
  node -e "
  if (process.env.NODE_ENV === 'production' && 
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.error('❌ TLS validation disabled in production');
    process.exit(1);
  }
  console.log('✅ TLS validation properly configured');
  "
  ```

## Claude Desktop Integration

### ✅ MCP Configuration

- [ ] **MCP config file syntax valid**
  ```bash
  # Validate JSON syntax (adjust path as needed)
  CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
  if [[ -f "$CONFIG_PATH" ]]; then
    jq empty "$CONFIG_PATH" && echo "✅ MCP config JSON valid"
  fi
  ```

- [ ] **File paths in MCP config are absolute**
  ```bash
  # Check that paths are absolute in MCP config
  CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
  if [[ -f "$CONFIG_PATH" ]]; then
    if jq -r '.mcpServers."matrix-booking".args[]' "$CONFIG_PATH" | grep -E '^/'; then
      echo "✅ Absolute paths used in MCP config"
    else
      echo "❌ Relative paths detected in MCP config"
    fi
  fi
  ```

### ✅ Tool Registration

- [ ] **All expected tools registered**
  ```javascript
  // Verify tool count and names
  // Expected tools: 9 total
  // - get_current_user
  // - get_booking_categories  
  // - get_locations
  // - discover_available_facilities
  // - find_rooms_with_facilities
  // - matrix_booking_check_availability
  // - matrix_booking_create_booking
  // - matrix_booking_get_location
  // - health_check
  ```

## Production Readiness

### ✅ Monitoring Setup

- [ ] **Health check endpoint accessible**
  ```javascript
  {
    "name": "health_check",
    "arguments": {"verbose": false}
  }
  // Expected: Service status summary
  ```

- [ ] **Error logging configured**
  ```bash
  # Verify error logging without debug noise
  LOG_LEVEL=error node dist/index.js 2>&1 | timeout 5 \
    grep -E "(ERROR|WARN)" && echo "✅ Error logging active" || echo "✅ No errors during startup"
  ```

- [ ] **Performance metrics available**
  ```bash
  # Check for performance logging
  DEBUG=matrix-booking:perf node dist/index.js 2>&1 | timeout 5 \
    grep -E "timing|performance" && echo "✅ Performance metrics available"
  ```

### ✅ Deployment Configuration

- [ ] **Production environment variables set**
  ```bash
  # Verify production settings
  [[ "$NODE_ENV" == "production" ]] || echo "⚠️  NODE_ENV not set to production"
  [[ "$LOG_LEVEL" =~ ^(warn|error)$ ]] || echo "⚠️  LOG_LEVEL should be warn or error for production"
  [[ -z "$DEBUG" ]] || echo "⚠️  DEBUG should be empty for production"
  ```

- [ ] **Resource limits appropriate**
  ```bash
  # Check Node.js memory limit
  node -e "
  const maxHeap = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;
  console.log('Max heap size:', maxHeap.toFixed(0), 'MB');
  if (maxHeap < 512) {
    console.warn('⚠️  Consider increasing Node.js memory limit');
  }
  "
  ```

### ✅ Documentation Complete

- [ ] **API_USAGE.md updated with all tools**
- [ ] **CONFIGURATION.md includes all environment variables**  
- [ ] **TROUBLESHOOTING.md covers common issues**
- [ ] **This checklist reflects current tool set**

## Final Deployment Verification

### ✅ End-to-End Test

- [ ] **Complete user workflow works**
  ```javascript
  // Test complete search workflow
  [
    {"name": "health_check", "arguments": {}},
    {"name": "get_current_user", "arguments": {}},
    {"name": "get_booking_categories", "arguments": {}},
    {"name": "find_rooms_with_facilities", "arguments": {
      "query": "meeting room for 8 people with projector",
      "maxResults": 5
    }}
  ]
  // Expected: All tools execute successfully with valid responses
  ```

- [ ] **Error scenarios handled gracefully**
  ```javascript
  // Test invalid queries
  [
    {"name": "find_rooms_with_facilities", "arguments": {"query": ""}},
    {"name": "matrix_booking_get_location", "arguments": {"locationId": -1}},
    {"name": "get_locations", "arguments": {"parentId": 999999}}
  ]
  // Expected: Proper error responses, no crashes
  ```

### ✅ Rollback Readiness

- [ ] **Previous version available for rollback**
- [ ] **Database migrations are reversible** (if applicable)
- [ ] **Configuration changes documented**
- [ ] **Rollback procedure tested**

---

## Checklist Summary

**Total Items**: ~60 validation points
**Estimated Time**: 30-45 minutes for full checklist
**Prerequisites**: Production environment access, test Matrix Booking API credentials

**Sign-off**:
- [ ] Developer: All tests pass and functionality verified
- [ ] DevOps: Infrastructure and monitoring ready
- [ ] Security: Security validation complete
- [ ] Product: End-to-end user workflows validated

**Deployment Date**: ___________
**Deployed By**: ___________
**Rollback Plan Confirmed**: [ ] Yes [ ] No