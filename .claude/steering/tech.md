# Technical Guidelines

## Tech Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Protocol**: MCP (Model Context Protocol) server implementation
- **API**: Matrix Booking REST API v1
- **Configuration**: Environment variables via .env file

## Dependencies
Use standard TypeScript/Node.js packages for:
- HTTP client functionality (fetch or axios)
- Environment variable loading (dotenv)
- MCP server implementation
- Testing framework (Jest recommended)
- TypeScript compilation

## Environment Configuration
Required .env variables:
- `MATRIX_USERNAME`: Matrix Booking username
- `MATRIX_PASSWORD`: Matrix Booking password  
- `MATRIX_PREFERED_LOCATION`: Default location ID for bookings

## Authentication
- Use HTTP Basic Authentication with Base64 encoded credentials
- Include standard headers: Content-Type: application/json;charset=UTF-8
- Add Matrix-specific headers: x-matrix-source: WEB, x-time-zone: Europe/London

## API Patterns
- Base URL: https://app.matrixbooking.com/api/v1
- POST /booking for creating bookings with notifyScope=ALL_ATTENDEES
- Use ISO 8601 datetime format (YYYY-MM-DDTHH:mm:ss.sss)
- Include owner object with id, email, and name fields

## Common Commands
```bash
pnpm install         # Install dependencies
pnpm run build       # Compile TypeScript
pnpm test           # Run test suite
pnpm run dev        # Development mode
```

## Testing Requirements
- Mock Matrix Booking API responses for testing
- Test all booking scenarios (success, conflicts, errors)
- Validate input parameters and error handling
- Use comprehensive unit and integration tests