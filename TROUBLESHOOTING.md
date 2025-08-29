# Matrix Booking MCP Server - Troubleshooting Guide

## Common Issues and Solutions

### Authentication Problems

#### Issue: "Invalid credentials" or "401 Unauthorized"

**Symptoms:**
- Tools return "Authentication failed" errors
- Health check shows userService as "degraded"
- API requests fail with 401 status

**Diagnosis:**
```bash
# Test credentials manually
curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
     "$MATRIX_API_BASE_URL/user/current"

# Check environment variables
echo "Username: $MATRIX_USERNAME"
echo "API URL: $MATRIX_API_BASE_URL"
# Don't echo password for security
```

**Solutions:**
1. **Verify credentials format:**
   ```bash
   # Username should be full email address
   MATRIX_USERNAME=john.doe@company.com  # ✓ Correct
   MATRIX_USERNAME=john.doe              # ✗ Incorrect
   ```

2. **Check for special characters in password:**
   ```bash
   # Escape special characters in .env file
   MATRIX_PASSWORD="Pass@word123!"       # ✓ Correct with quotes
   MATRIX_PASSWORD=Pass@word123!         # ✗ May cause shell interpretation issues
   ```

3. **Verify API base URL:**
   ```bash
   # URL should include /api/v1 suffix
   MATRIX_API_BASE_URL=https://matrix.company.com/api/v1  # ✓ Correct
   MATRIX_API_BASE_URL=https://matrix.company.com         # ✗ Missing API path
   ```

#### Issue: "Session expired" or intermittent auth failures

**Symptoms:**
- Authentication works initially but fails later
- Tools work in batches then fail
- Error messages about expired tokens

**Solutions:**
1. **Check session management:**
   ```bash
   # Enable debug logging to see auth details
   DEBUG=matrix-booking:auth npm start
   ```

2. **Verify password policy compliance:**
   - Password hasn't expired
   - Account not locked due to failed attempts
   - Multi-factor authentication not required

### Network Connectivity Issues

#### Issue: "Connection timeout" or "ECONNRESET"

**Symptoms:**
- Tools return "Network error" or timeout messages
- Health check shows multiple services as "degraded"
- Inconsistent response times

**Diagnosis:**
```bash
# Test direct connectivity
curl -w "@curl-format.txt" -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
     "$MATRIX_API_BASE_URL/user/current"

# Check DNS resolution
nslookup matrix.company.com

# Test with different timeout values
curl --connect-timeout 10 --max-time 30 \
     "$MATRIX_API_BASE_URL/user/current"
```

**Solutions:**
1. **Adjust timeout settings:**
   ```bash
   # Increase timeout for slow networks
   MATRIX_API_TIMEOUT=60000  # 60 seconds
   ```

2. **Configure proxy settings:**
   ```bash
   HTTP_PROXY=http://proxy.company.com:8080
   HTTPS_PROXY=http://proxy.company.com:8080
   NO_PROXY=localhost,127.0.0.1
   ```

3. **Check firewall rules:**
   - Ensure outbound HTTPS (443) access
   - Verify Matrix API endpoints are accessible
   - Test from same network environment

#### Issue: "SSL certificate verification failed"

**Symptoms:**
- CERT_UNTRUSTED or CERT_INVALID errors
- Works with curl -k but not with the server
- Certificate-related error messages

**Solutions:**
1. **For development/testing only:**
   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0  # ⚠️ Not for production
   ```

2. **For production (recommended):**
   ```bash
   # Add custom CA certificates
   export NODE_EXTRA_CA_CERTS=/path/to/company-ca-bundle.pem
   
   # Or update system certificate store
   sudo apt-get update && sudo apt-get install ca-certificates
   ```

### Search and Query Issues

#### Issue: "No results found" for valid queries

**Symptoms:**
- `find_rooms_with_facilities` returns empty results
- Facilities exist but aren't matched
- Location queries return no matches

**Diagnosis:**
```bash
# Enable debug logging for search operations
DEBUG=matrix-booking:search npm start

# Test basic location discovery
curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
     "$MATRIX_API_BASE_URL/locations"

# Check organization structure
curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
     "$MATRIX_API_BASE_URL/org"
```

**Solutions:**
1. **Verify organization access:**
   ```javascript
   // Test with health_check tool first
   {
     "name": "health_check",
     "arguments": {"verbose": true}
   }
   ```

2. **Check facility parsing:**
   ```javascript
   // Test facility discovery
   {
     "name": "discover_available_facilities", 
     "arguments": {}
   }
   ```

3. **Adjust search parameters:**
   ```javascript
   // Use broader search terms
   {
     "name": "find_rooms_with_facilities",
     "arguments": {
       "query": "room",              // Start simple
       "maxResults": 50             // Increase result limit
     }
   }
   ```

#### Issue: Poor search relevance or incorrect facility matching

**Symptoms:**
- Search returns irrelevant results
- Facility matching is inaccurate  
- Capacity filtering not working correctly

**Solutions:**
1. **Use more specific queries:**
   ```javascript
   // Instead of: "room"
   // Use: "conference room with projector for 8 people"
   {
     "query": "conference room with projector for 8 people",
     "buildingId": 100,  // Add location context
     "category": "Meeting Rooms"  // Specify category
   }
   ```

2. **Check facility data quality:**
   ```bash
   # Enable facility matching debug
   DEBUG=matrix-booking:facility npm start
   ```

### Performance Issues

#### Issue: Slow response times or timeouts

**Symptoms:**
- Tools take >30 seconds to respond
- Intermittent timeout errors
- High memory usage

**Diagnosis:**
```bash
# Monitor performance with debug timing
DEBUG=matrix-booking:perf npm start

# Check memory usage
node --inspect dist/index.js

# Monitor API response times
curl -w "Total time: %{time_total}s\n" \
     -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
     "$MATRIX_API_BASE_URL/locations"
```

**Solutions:**
1. **Optimize cache settings:**
   ```bash
   # Reduce cache refresh frequency
   CACHE_TTL_ORGANIZATION=43200  # 12 hours
   CACHE_TTL_LOCATIONS=7200      # 2 hours  
   CACHE_TTL_FACILITIES=1800     # 30 minutes
   ```

2. **Limit search scope:**
   ```javascript
   {
     "name": "find_rooms_with_facilities",
     "arguments": {
       "query": "meeting room",
       "buildingId": 100,        // Limit to specific building
       "maxResults": 10,         // Reduce result count
       "dateFrom": "2025-02-01T09:00:00.000Z"  // Add time constraints
     }
   }
   ```

3. **Tune API settings:**
   ```bash
   MATRIX_API_TIMEOUT=15000      # Shorter timeout
   MAX_SEARCH_RESULTS=20         # Limit results
   ENABLE_AVAILABILITY_CHECK=false  # Disable expensive checks
   ```

### MCP Integration Issues

#### Issue: Tools not appearing in Claude Desktop

**Symptoms:**
- MCP server starts but tools not visible
- "Tool not found" errors in Claude Desktop
- Server appears connected but inactive

**Solutions:**
1. **Check MCP configuration:**
   ```json
   {
     "mcpServers": {
       "matrix-booking": {
         "command": "node",
         "args": ["/absolute/path/to/dist/index.js"],
         "env": {
           "MATRIX_USERNAME": "your.username@company.com",
           "MATRIX_PASSWORD": "your_password",
           "MATRIX_API_BASE_URL": "https://matrix.company.com/api/v1"
         }
       }
     }
   }
   ```

2. **Verify file paths:**
   ```bash
   # Ensure absolute paths in configuration
   ls -la /path/to/matrix-booking-mcp/dist/index.js
   
   # Check permissions
   chmod +x /path/to/matrix-booking-mcp/dist/index.js
   ```

3. **Test MCP server directly:**
   ```bash
   # Test server startup
   cd /path/to/matrix-booking-mcp
   node dist/index.js
   
   # Should show: "Matrix Booking MCP Server: Starting MCP server..."
   ```

#### Issue: "Error calling tool" or MCP communication failures

**Symptoms:**
- Tools execute but return errors
- Partial responses or malformed JSON
- Claude Desktop shows tool execution errors

**Solutions:**
1. **Check stdout/stderr handling:**
   ```bash
   # MCP uses stdio for communication
   # Ensure no console.error in production code
   LOG_LEVEL=warn  # Minimize console output
   ```

2. **Validate tool responses:**
   ```bash
   # Enable MCP debug mode
   DEBUG=mcp:* npm start
   ```

3. **Test individual tools:**
   ```javascript
   // Test simplest tool first
   {
     "name": "health_check",
     "arguments": {}
   }
   ```

### Data and Caching Issues

#### Issue: Stale or incorrect data

**Symptoms:**
- Recently created rooms not appearing
- Outdated facility information
- Deleted resources still showing up

**Solutions:**
1. **Force cache refresh:**
   ```bash
   # Restart server to clear all caches
   # Or reduce cache TTL temporarily
   CACHE_TTL_ORGANIZATION=60     # 1 minute
   CACHE_TTL_LOCATIONS=60        # 1 minute
   ```

2. **Check data synchronization:**
   ```bash
   # Verify data directly from API
   curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
        "$MATRIX_API_BASE_URL/locations" | jq .
   ```

## Debugging Commands

### Enable Comprehensive Logging
```bash
# Enable all debug categories
DEBUG=matrix-booking:* npm start

# Enable specific categories only
DEBUG=matrix-booking:auth,matrix-booking:search npm start

# Production-safe error logging
DEBUG=matrix-booking:error LOG_LEVEL=warn npm start
```

### Health Check and Diagnostics
```bash
# Full system health check
node -e "
const server = require('./dist/mcp/mcp-server.js');
const mcpServer = new server.MatrixBookingMCPServer();
mcpServer.handleHealthCheck({verbose: true}).then(console.error);
"

# Test individual services
node -e "
const userService = require('./dist/services/user-service.js');
const service = new userService.UserService(/* auth manager */);
service.getCurrentUser().then(console.error).catch(console.error);
"
```

### Configuration Validation
```bash
# Check environment variables
printenv | grep MATRIX

# Validate configuration format
node -e "
const config = {
  username: process.env.MATRIX_USERNAME,
  password: process.env.MATRIX_PASSWORD, 
  apiUrl: process.env.MATRIX_API_BASE_URL
};
console.error('Config validation:', {
  hasUsername: !!config.username,
  isValidEmail: /@/.test(config.username || ''),
  hasPassword: !!config.password,
  hasApiUrl: !!config.apiUrl,
  isValidUrl: /^https?:\/\//.test(config.apiUrl || '')
});
"
```

## Getting Help

### Log File Analysis

#### Enable comprehensive logging:
```bash
DEBUG=matrix-booking:* LOG_LEVEL=debug npm start 2>&1 | tee debug.log
```

#### Key log patterns to look for:
- `Authentication:` - Credential and session issues
- `API Request:` - Network and HTTP issues  
- `Search:` - Query parsing and facility matching
- `Cache:` - Data freshness and performance issues
- `MCP:` - Tool registration and communication problems

### Support Information

When reporting issues, please include:

1. **Environment details:**
   ```bash
   node --version
   npm --version
   echo $NODE_ENV
   echo $MATRIX_API_BASE_URL
   ```

2. **Configuration (sanitized):**
   ```bash
   # Remove sensitive information before sharing
   printenv | grep MATRIX | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/'
   ```

3. **Error logs with debug enabled:**
   ```bash
   DEBUG=matrix-booking:* npm start 2>&1 | head -100
   ```

4. **Health check output:**
   ```javascript
   {
     "name": "health_check", 
     "arguments": {"verbose": true}
   }
   ```

5. **Test results:**
   ```bash
   npm test 2>&1 | tail -20
   npm run build 2>&1 | tail -10
   ```

### Community Resources

- **Documentation**: Check API_USAGE.md and CONFIGURATION.md
- **Examples**: Review test files in `/tests/` directory
- **Source code**: Examine service implementations in `/src/services/`
- **Issue tracking**: Create detailed issue reports with logs and reproduction steps