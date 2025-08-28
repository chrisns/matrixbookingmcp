# Matrix Booking MCP Server - Configuration Guide

## Environment Variables

### Required Configuration

#### Authentication
```bash
# Matrix Booking API credentials (required)
MATRIX_USERNAME=your.username@company.com
MATRIX_PASSWORD=your_secure_password

# Matrix Booking API base URL (required)
MATRIX_API_BASE_URL=https://your-matrix-instance.com/api/v1
```

#### Optional Configuration

#### Debugging and Logging
```bash
# Enable detailed request/response logging (optional)
DEBUG=matrix-booking

# When DEBUG is set, the server will log:
# - Full HTTP request URLs and headers (excluding sensitive auth)
# - Complete API response payloads (sanitized)
# - Search query parsing and facility matching details
# - Cache hit/miss information
# - Performance timing data

# Log level for application logging (optional)
LOG_LEVEL=info  # debug | info | warn | error
```

#### Performance Tuning
```bash
# API request timeout in milliseconds (default: 30000)
MATRIX_API_TIMEOUT=30000

# Connection pool settings (optional)
MATRIX_API_MAX_CONNECTIONS=10
MATRIX_API_KEEP_ALIVE=true

# Cache TTL overrides in seconds (optional)
CACHE_TTL_ORGANIZATION=86400    # 24 hours (default)
CACHE_TTL_LOCATIONS=14400       # 4 hours (default)
CACHE_TTL_FACILITIES=3600       # 1 hour (default)
```

#### Feature Flags
```bash
# Enable/disable natural language processing (default: true)
ENABLE_NLP=true

# Enable/disable facility parsing and matching (default: true)
ENABLE_FACILITY_MATCHING=true

# Enable/disable availability checking in search results (default: true)
ENABLE_AVAILABILITY_CHECK=true

# Maximum search results per query (default: 50)
MAX_SEARCH_RESULTS=50
```

#### Organization Settings
```bash
# Default organization ID (optional - auto-detected from user)
DEFAULT_ORGANIZATION_ID=789

# Default preferred location ID (optional - auto-detected)
DEFAULT_LOCATION_ID=100

# Default timezone for date/time operations (optional)
DEFAULT_TIMEZONE=Europe/London
```

## Configuration Files

### `.env` File Example
Create a `.env` file in the project root:

```bash
# Authentication (required)
MATRIX_USERNAME=john.doe@company.com
MATRIX_PASSWORD=SecurePassword123!
MATRIX_API_BASE_URL=https://matrix.company.com/api/v1

# Debugging (recommended for development)
DEBUG=matrix-booking
LOG_LEVEL=debug

# Performance tuning (optional)
MATRIX_API_TIMEOUT=30000
CACHE_TTL_ORGANIZATION=86400
ENABLE_AVAILABILITY_CHECK=true

# Organization preferences (optional)
DEFAULT_TIMEZONE=Europe/London
MAX_SEARCH_RESULTS=25
```

### Configuration Validation

The server validates configuration on startup:

```typescript
// Required validations
✓ MATRIX_USERNAME is set and valid email format
✓ MATRIX_PASSWORD is set and non-empty
✓ MATRIX_API_BASE_URL is set and valid URL format

// Optional validations  
✓ Numeric environment variables are valid integers
✓ Boolean flags are valid true/false values
✓ Timezone strings are valid IANA timezone identifiers
✓ Cache TTL values are positive integers
```

## Docker Configuration

### Docker Compose Example
```yaml
version: '3.8'
services:
  matrix-booking-mcp:
    build: .
    environment:
      - MATRIX_USERNAME=${MATRIX_USERNAME}
      - MATRIX_PASSWORD=${MATRIX_PASSWORD}
      - MATRIX_API_BASE_URL=${MATRIX_API_BASE_URL}
      - DEBUG=matrix-booking
      - LOG_LEVEL=info
      - MATRIX_API_TIMEOUT=30000
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

### Dockerfile Environment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY dist/ ./dist/
COPY .env ./

# Set default environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV MATRIX_API_TIMEOUT=30000

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Claude Desktop Configuration

### MCP Settings

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "matrix-booking": {
      "command": "node",
      "args": ["/path/to/matrix-booking-mcp/dist/index.js"],
      "env": {
        "MATRIX_USERNAME": "your.username@company.com",
        "MATRIX_PASSWORD": "your_secure_password",
        "MATRIX_API_BASE_URL": "https://matrix.company.com/api/v1",
        "DEBUG": "matrix-booking"
      }
    }
  }
}
```

### Configuration Locations

#### macOS
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

#### Windows
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

#### Linux
```bash
~/.config/claude/claude_desktop_config.json
```

## Security Configuration

### Credential Management
```bash
# Use secure credential storage (recommended)
export MATRIX_USERNAME="$(security find-generic-password -s matrix-booking -w)"
export MATRIX_PASSWORD="$(security find-generic-password -s matrix-booking-pwd -w)"

# Or use encrypted environment files
# Install: npm install -g dotenv-vault
dotenv-vault encrypt .env
```

### Network Security
```bash
# Configure proxy settings if required
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1

# SSL/TLS configuration
NODE_TLS_REJECT_UNAUTHORIZED=1  # Enforce certificate validation
MATRIX_API_SSL_VERIFY=true      # Verify SSL certificates
```

### Access Control
```bash
# Restrict API access to specific user roles (optional)
ALLOWED_ROLES=USER,ADMIN,BOOKING_MANAGER

# Enable audit logging for compliance (optional)  
ENABLE_AUDIT_LOG=true
AUDIT_LOG_PATH=/var/log/matrix-booking-mcp/audit.log
```

## Production Configuration

### Recommended Production Settings
```bash
# Essential production settings
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=  # Disable debug logging in production

# Performance optimization
MATRIX_API_TIMEOUT=15000        # Shorter timeout for production
CACHE_TTL_ORGANIZATION=43200    # 12 hours (more frequent refresh)
CACHE_TTL_LOCATIONS=7200        # 2 hours
MAX_SEARCH_RESULTS=20           # Limit result size

# Security hardening
NODE_TLS_REJECT_UNAUTHORIZED=1
MATRIX_API_SSL_VERIFY=true
ENABLE_AUDIT_LOG=true
```

### Health Check Configuration
```bash
# Health check endpoint configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000       # 5 seconds
HEALTH_CHECK_DEEP=false         # Disable deep checks in production

# Monitoring integration
ENABLE_METRICS=true
METRICS_PORT=9090               # Prometheus metrics port
```

### Load Balancing
```bash
# Multiple instance configuration
INSTANCE_ID=matrix-mcp-01
CLUSTER_MODE=true
REDIS_URL=redis://redis.company.com:6379  # Shared cache
```

## Configuration Testing

### Validate Configuration
```bash
# Test configuration on startup
npm run config:validate

# Test Matrix API connectivity
npm run test:api

# Verify MCP tool registration
npm run test:mcp

# Run health check
npm run health:check
```

### Configuration Troubleshooting

#### Common Issues

1. **Authentication Failures**
   ```bash
   # Check credentials format
   echo $MATRIX_USERNAME | grep -E '^[^@]+@[^@]+\.[^@]+$'
   
   # Test API connectivity
   curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
        "$MATRIX_API_BASE_URL/user/current"
   ```

2. **Network Connectivity**
   ```bash
   # Test base URL accessibility
   curl -I "$MATRIX_API_BASE_URL"
   
   # Check proxy settings
   curl -I --proxy "$HTTP_PROXY" "$MATRIX_API_BASE_URL"
   ```

3. **Permission Issues**
   ```bash
   # Verify user permissions
   curl -u "$MATRIX_USERNAME:$MATRIX_PASSWORD" \
        "$MATRIX_API_BASE_URL/org" 
   ```

4. **Cache Issues**
   ```bash
   # Clear application cache
   npm run cache:clear
   
   # Verify cache TTL settings
   npm run config:cache
   ```

## Environment-Specific Examples

### Development
```bash
DEBUG=matrix-booking:*
LOG_LEVEL=debug
MATRIX_API_TIMEOUT=60000
CACHE_TTL_ORGANIZATION=300  # 5 minutes for faster development
ENABLE_AVAILABILITY_CHECK=false  # Speed up development
```

### Testing
```bash
NODE_ENV=test
MATRIX_API_BASE_URL=https://matrix-test.company.com/api/v1
MAX_SEARCH_RESULTS=5
CACHE_TTL_ORGANIZATION=60  # 1 minute for test isolation
```

### Staging
```bash
NODE_ENV=staging  
LOG_LEVEL=info
DEBUG=matrix-booking:error
MATRIX_API_TIMEOUT=20000
ENABLE_AUDIT_LOG=true
```