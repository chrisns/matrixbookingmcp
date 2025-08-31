# Matrix Booking MCP Server

[![Build Status](https://github.com/chrisns/matrixbookingmcp/actions/workflows/ci.yml/badge.svg)](https://github.com/chrisns/matrixbookingmcp/actions/workflows/ci.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-54%25-yellow)](https://github.com/chrisns/matrixbookingmcp)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/chrisns/matrixbookingmcp)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.7.3-blue)](https://www.typescriptlang.org/)

A TypeScript MCP (Model Context Protocol) server for Matrix Booking API integration, enabling AI assistants to automatically check room availability and create bookings through natural language interactions.

## 🚀 Features

### Core Booking Features
- **Room & Desk Availability**: Check availability for rooms, desks, and desk banks
- **Smart Booking Creation**: Create bookings with attendee management and notifications
- **Booking Search & Discovery**: Search bookings by user, date, location, or type
- **Colleague Calendar Discovery**: Find when colleagues are in the office (privacy-aware)
- **Booking Management**: Cancel and manage existing bookings with notification options
- **User Bookings**: View and track your own bookings and recurring schedules

### Advanced Search & Location
- **Natural Language Search**: Find locations using conversational queries
- **Facility-Based Discovery**: Search by requirements (screen, whiteboard, capacity)
- **Location Hierarchy**: Browse buildings, floors, zones, and desk banks
- **Smart Location Resolution**: Intelligent room/desk name and number matching
- **Cross-Organization Support**: Handle multiple organization contexts seamlessly

### Technical Excellence
- **Comprehensive Validation**: Input sanitization and XSS prevention
- **Smart Caching**: Performance optimization with configurable TTLs
- **Organization Context Resolution**: Intelligent organization ID mapping with fallback
- **Security-First**: Environment-based credential management
- **Error Recovery**: Graceful degradation and alternative suggestions
- **Comprehensive Testing**: Unit, integration, and performance test coverage

## 📋 Requirements

- **Node.js**: ≥22.0.0
- **Package Manager**: npm (supported)
- **Matrix Booking Account**: Valid credentials required

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/chrisns/matrixbookingmcp.git
cd matrixbookingmcp
```

### 2. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Using npm:
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure the required environment variables:

```env
# Matrix Booking Credentials
MATRIX_USERNAME=your-matrix-username
MATRIX_PASSWORD=your-matrix-password

# Default Location (optional but recommended)
MATRIX_PREFERED_LOCATION=your-preferred-location-id
```

### 4. Build the Project

```bash
pnpm build
```

## ⚙️ Configuration

### Environment Variables

#### Required Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MATRIX_USERNAME` | ✅ | Matrix Booking username | `john.doe@company.com` |
| `MATRIX_PASSWORD` | ✅ | Matrix Booking password | `your-secure-password` |
| `MATRIX_PREFERED_LOCATION` | ⚠️ | Default location ID for bookings | `12345` |

#### Advanced Configuration

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `MATRIX_API_TIMEOUT` | ❌ | `5000` | API request timeout in milliseconds | `10000` |
| `CACHE_ENABLED` | ❌ | `true` | Enable/disable caching for performance | `false` |
| `MATRIX_DEFAULT_DURATION_MINUTES` | ❌ | `15` | Default booking duration for point-in-time queries | `30` |
| `MATRIX_ORGANIZATION_RESOLUTION_STRATEGY` | ❌ | `user_preferred` | How to resolve organization conflicts | `location_preferred`, `strict` |
| `MATRIX_ENABLE_CROSS_ORG_ACCESS` | ❌ | `true` | Allow cross-organization bookings | `false` |
| `MATRIX_ORG_VALIDATION_CACHE_TTL_MS` | ❌ | `300000` | Organization validation cache TTL (5 min) | `600000` |

> **Security Note**: Never commit credentials to version control. The `.env` file is automatically excluded via `.gitignore`.

### Matrix API Configuration

The server automatically configures:
- **Base URL**: `https://app.matrixbooking.com/api/v1`
- **Authentication**: HTTP Basic Auth with Base64 encoding
- **Timeout**: 5 seconds for all API calls
- **Timezone**: Europe/London (configurable via `x-time-zone` header)
- **Headers**: Required Matrix-specific headers included automatically

## 🔌 MCP Integration

### Claude Desktop Setup

1. **Update Claude Desktop Configuration**

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "matrix-booking": {
      "command": "node",
      "args": ["/path/to/matrix-booking-mcp-server/dist/index.js"],
      "env": {
        "MATRIX_USERNAME": "your-username",
        "MATRIX_PASSWORD": "your-password",
        "MATRIX_PREFERED_LOCATION": "your-location-id"
      }
    }
  }
}
```

2. **Restart Claude Desktop**

The Matrix Booking tools will now be available in your Claude Desktop session.

### Other MCP Clients

For integration with other MCP clients, use:
- **Transport**: stdio
- **Command**: `node dist/index.js`
- **Environment**: Set the required environment variables

## 🛠️ Usage

### Development Mode

```bash
pnpm dev
```

### Production Mode

```bash
pnpm start
```

### Available Operations

#### 1. Check Room Availability

```typescript
// Check availability for today at preferred location
checkAvailability()

// Check availability for specific date and location  
checkAvailability({
  date: "2024-01-15",
  locationId: "12345",
  startTime: "09:00",
  endTime: "17:00"
})
```

#### 2. Book Appointments

```typescript
// Book a room with basic details
bookAppointment({
  title: "Team Meeting",
  date: "2024-01-15", 
  startTime: "14:00",
  endTime: "15:00",
  roomId: "67890"
})

// Book with attendees and notifications
bookAppointment({
  title: "Project Review",
  date: "2024-01-15",
  startTime: "10:00", 
  endTime: "11:00",
  roomId: "67890",
  attendees: ["john@company.com", "jane@company.com"],
  sendNotifications: true
})
```

### Smart Defaults

The server includes intelligent defaults:
- **Date**: Defaults to today when not specified
- **Location**: Uses `MATRIX_PREFERED_LOCATION` from environment
- **Time Range**: Full day (00:00-23:59) for availability checks
- **Timezone**: Automatically handled as Europe/London

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[AI Assistant/Client] --> B[MCP Server]
    B --> C[Matrix Booking API]
    
    B --> D[Configuration Manager]
    B --> E[Authentication Manager] 
    B --> F[Service Layer]
    B --> G[Input Validation]
    B --> H[Organization Context Resolver]
    
    F --> F1[Availability Service]
    F --> F2[Booking Service]
    F --> F3[Location Service]
    F --> F4[Organization Service]
    F --> F5[Search Service]
    
    H --> H1[Organization Validation]
    H --> H2[Context Resolution]
    H --> H3[Fallback Logic]
    H --> H4[Validation Cache]
    
    D --> I[Environment Variables]
    E --> J[Base64 Credentials]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style F fill:#e8f5e8
    style H fill:#ffe0e6
```

### Core Components

- **MCP Server**: TypeScript implementation using `@modelcontextprotocol/sdk`
- **Authentication Manager**: Secure credential handling with Base64 encoding
- **Service Layer**: Business logic for availability, booking, and location operations
- **Organization Context Resolver**: Handles organization ID mapping with fallback logic and caching
- **Configuration Manager**: Environment-based configuration with validation
- **Input Validation**: Comprehensive sanitization and validation system
- **Error Handling**: Pass-through error policy preserving Matrix API responses

## 🧪 Testing

### Run All Tests

```bash
pnpm test
```

### Test Coverage

```bash
pnpm test:coverage
```

### Test Categories

- **Unit Tests**: Component and service testing
- **Integration Tests**: End-to-end MCP protocol testing
- **Security Tests**: Credential handling and validation
- **Performance Tests**: Load testing with K6

### Performance Testing

```bash
# Quick performance test
pnpm test:k6:quick

# Full load test
pnpm test:k6

# Timeout testing
pnpm test:k6:timeout
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Symptom**: `401 Unauthorized` errors

**Solution**:
- Verify `MATRIX_USERNAME` and `MATRIX_PASSWORD` in `.env`
- Ensure credentials are valid for Matrix Booking
- Check for trailing spaces in environment variables

#### 2. Location Not Found

**Symptom**: `Location not found` errors

**Solution**:
- Verify `MATRIX_PREFERED_LOCATION` is a valid location ID
- Use the location service to fetch available locations
- Ensure location ID is numeric (not location name)

#### 3. Timeout Issues

**Symptom**: `Request timeout` errors

**Solution**:
- Check network connectivity to `app.matrixbooking.com`
- Verify Matrix API is accessible from your network
- Consider firewall or proxy configurations

#### 4. Date/Time Validation Errors

**Symptom**: Invalid date format errors

**Solution**:
- Use ISO date format: `YYYY-MM-DD`
- Use 24-hour time format: `HH:MM`
- Ensure dates are not in the past

#### 5. Organization ID Mapping Issues

**Symptom**: `NaN` organization ID errors or "Invalid organization context" errors

**Solution**:
- Verify your user account has proper organization access in Matrix Booking
- Check that `MATRIX_PREFERED_LOCATION` belongs to your organization
- Set `MATRIX_ORGANIZATION_RESOLUTION_STRATEGY=user_preferred` to prefer user's organization
- Enable cross-org access with `MATRIX_ENABLE_CROSS_ORG_ACCESS=true` if you need multi-org support

#### 6. Empty Location Hierarchy

**Symptom**: `get_locations` returns empty arrays or booking searches fail

**Solution**:
- Ensure your organization has locations configured in Matrix Booking
- Verify API authentication is working correctly
- Check that your user has permissions to view locations
- Try setting a different organization resolution strategy

#### 7. Date Range Validation Errors

**Symptom**: "Invalid date range: End time must be after start time" for identical times

**Solution**:
- The system now allows identical start/end times for point-in-time queries
- Uses `MATRIX_DEFAULT_DURATION_MINUTES` (default: 15) to extend identical times
- For explicit ranges, ensure end time is after start time

#### 8. MCP Connection Issues

**Symptom**: Tools not available in Claude Desktop

**Solution**:
- Verify `claude_desktop_config.json` syntax
- Check file path to the built server (`dist/index.js`)
- Ensure the project is built (`pnpm build`)
- Restart Claude Desktop after configuration changes

### Debug Mode

Enable detailed logging by setting:

```bash
export NODE_ENV=development
```

### Support

For additional support:
1. Check the [troubleshooting guide](docs/troubleshooting.md)
2. Review test examples in the `tests/` directory
3. Open an issue on GitHub with detailed error information

## 📚 API Reference

### Available MCP Tools

The server provides 11 comprehensive tools for Matrix Booking operations:

#### Booking Operations

1. **`check_availability`** - Check room/desk availability
2. **`book_appointment`** - Create new bookings with attendees
3. **`cancel_booking`** - Cancel existing bookings
4. **`get_user_bookings`** - View your bookings and schedules
5. **`search_bookings`** - Search all bookings (including colleagues)

#### Location Discovery

6. **`get_locations`** - Browse location hierarchy
7. **`find_location_by_name`** - Find locations by name/number
8. **`find_location_by_requirements`** - Search by facilities and capacity
9. **`find_location_by_id`** - Get specific location details

#### System Information

10. **`get_booking_types`** - List available booking categories
11. **`get_organization_info`** - View organization details

For detailed parameters and examples, see the [API Usage Guide](API_USAGE.md)

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork and Clone**
   ```bash
   git fork https://github.com/chrisns/matrixbookingmcp.git
   git clone https://github.com/your-username/matrixbookingmcp.git
   ```

2. **Setup Development Environment**
   ```bash
   cd matrixbookingmcp
   pnpm install
   cp .env.example .env
   # Configure your .env file
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Development**
   ```bash
   pnpm dev  # Start development server
   pnpm test # Run tests in watch mode
   ```

5. **Quality Checks**
   ```bash
   pnpm lint        # Check code style
   pnpm typecheck   # Verify TypeScript
   pnpm test        # Run all tests
   ```

6. **Submit Pull Request**
   - Ensure all tests pass
   - Include test coverage for new features
   - Follow conventional commit messages
   - Update documentation if needed

### Coding Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow configured rules
- **Testing**: Maintain test coverage above 50%
- **Commits**: Use conventional commit format
- **Documentation**: Update for API changes

### Pull Request Requirements

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Test coverage maintained (50%+)
- [ ] Documentation updated
- [ ] Security considerations addressed

### Testing Requirements

- Unit tests for all new functions
- Integration tests for API endpoints
- Security tests for credential handling
- Performance tests for critical paths

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Maintainers

- **Project Lead**: Matrix Booking MCP Server Team
- **Email**: [maintainers@example.com](mailto:maintainers@example.com)
- **GitHub**: [@chrisns/matrixbookingmcp](https://github.com/chrisns/matrixbookingmcp)

## 📈 Project Status

- ✅ **Core Features**: Complete
- ✅ **API Integration**: Stable
- ✅ **Test Coverage**: 54%
- ✅ **Documentation**: Complete
- ✅ **Security**: Audited
- 🔄 **Performance**: Continuously monitored

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [Matrix Booking](https://matrixbooking.com) for the API platform
- TypeScript and Node.js communities for excellent tooling

---

*For more detailed information, see the [technical documentation](.claude/steering/) and [specification documents](.claude/specs/).*