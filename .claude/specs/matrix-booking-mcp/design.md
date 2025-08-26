# Matrix Booking MCP Server - Design Document

## Overview

The Matrix Booking MCP (Model Context Protocol) Server is a TypeScript-based server that provides seamless integration between AI assistants and the Matrix Booking system. The server enables users to check room availability, book appointments, and manage bookings through natural language interactions while maintaining security and reliability.

### Design Goals
- **Stateless Architecture**: No caching or persistent state management
- **Environment-based Configuration**: Secure credential management via .env files
- **Robust Error Handling**: Pass-through error handling with proper timeout management
- **Comprehensive Testing**: Full test coverage with API mocking
- **Smart Defaults**: Intuitive date and location defaults for user convenience
- **Type Safety**: Full TypeScript implementation with strict typing

### Scope
- Room availability checking
- Appointment booking functionality  
- Location management
- Authentication and authorization
- Error handling and timeout management
- Comprehensive testing infrastructure

## Architecture Design

### System Architecture Diagram

```mermaid
graph TB
    A[AI Assistant/Client] --> B[MCP Server]
    B --> C[Matrix Booking API]
    B --> D[Environment Config]
    B --> E[Authentication Manager]
    
    subgraph "MCP Server Components"
        F[Availability Service]
        G[Booking Service]  
        H[Location Service]
        I[Error Handler]
        J[Configuration Manager]
    end
    
    B --> F
    B --> G
    B --> H
    B --> I
    B --> J
    
    C --> K[Matrix Booking Backend]
    D --> L[.env File]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style K fill:#e8f5e8
```

### Data Flow Diagram

```mermaid
graph LR
    A[User Request] --> B[MCP Server]
    B --> C{Request Type}
    
    C -->|Check Availability| D[Availability Service]
    C -->|Book Appointment| E[Booking Service]
    C -->|Get Locations| F[Location Service]
    
    D --> G[Matrix API Call]
    E --> G
    F --> G
    
    G --> H{API Response}
    H -->|Success| I[Format Response]
    H -->|Error| J[Error Handler]
    H -->|Timeout| K[Timeout Handler]
    
    I --> L[Return to Client]
    J --> L
    K --> L
```

## Component Design

### MCP Server Core
- **Responsibilities**: Protocol handling, message routing, session management
- **Interfaces**: 
  - `IMCPServer`: Main server interface
  - `ITransport`: Communication transport abstraction
- **Dependencies**: @modelcontextprotocol/sdk, stdio transport

### Authentication Manager
- **Responsibilities**: HTTP Basic Authentication, credential management, token handling
- **Interfaces**:
  - `IAuthenticationManager`: Authentication operations
  - `ICredentials`: Credential structure
- **Dependencies**: Environment configuration, base64 encoding utilities

### Availability Service  
- **Responsibilities**: Check room/location availability for specified date/time ranges
- **Interfaces**:
  - `IAvailabilityService`: Availability checking operations
  - `IAvailabilityRequest`: Request parameters
  - `IAvailabilityResponse`: Response structure
- **Dependencies**: Matrix API client, configuration manager

### Booking Service
- **Responsibilities**: Create, modify, cancel bookings
- **Interfaces**:
  - `IBookingService`: Booking operations
  - `IBookingRequest`: Booking parameters
  - `IBookingResponse`: Booking confirmation
- **Dependencies**: Matrix API client, authentication manager

### Location Service
- **Responsibilities**: Retrieve location information, manage preferred locations
- **Interfaces**:
  - `ILocationService`: Location operations
  - `ILocation`: Location data structure
- **Dependencies**: Matrix API client, configuration

### Configuration Manager
- **Responsibilities**: Environment variable management, default value provision
- **Interfaces**:
  - `IConfigurationManager`: Configuration operations
  - `IServerConfig`: Server configuration structure
- **Dependencies**: dotenv, environment validation

### API Client
- **Responsibilities**: HTTP requests to Matrix Booking API, timeout handling, response parsing
- **Interfaces**:
  - `IMatrixAPIClient`: API communication interface
  - `IAPIRequest`: Request structure
  - `IAPIResponse`: Response structure
- **Dependencies**: fetch API, authentication manager

### Error Handler
- **Responsibilities**: Error classification, pass-through error handling, timeout management
- **Interfaces**:
  - `IErrorHandler`: Error handling operations
  - `IErrorResponse`: Standardized error structure
- **Dependencies**: None (pure error processing)

## Data Model

### Core Data Structure Definitions

```typescript
interface IServerConfig {
  matrixUsername: string;
  matrixPassword: string;
  matrixPreferredLocation: string;
  apiTimeout: number;
  apiBaseUrl: string;
}

interface ICredentials {
  username: string;
  password: string;
  encodedCredentials: string;
}

interface IAvailabilityRequest {
  dateFrom: string;  // ISO 8601 format
  dateTo: string;    // ISO 8601 format
  locationId?: number;
  duration?: number; // minutes
}

interface IAvailabilityResponse {
  available: boolean;
  slots: ITimeSlot[];
  location: ILocation;
}

interface ITimeSlot {
  from: string;      // ISO 8601 format
  to: string;        // ISO 8601 format
  available: boolean;
  locationId: number;
}

interface IBookingRequest {
  timeFrom: string;  // ISO 8601 format
  timeTo: string;    // ISO 8601 format
  locationId: number;
  attendees: IAttendee[];
  extraRequests: string[];
  owner: IOwner;
  ownerIsAttendee: boolean;
  source: string;
}

interface IBookingResponse {
  id: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  timeFrom: string;
  timeTo: string;
  location: ILocation;
  owner: IOwner;
  attendees: IAttendee[];
}

interface ILocation {
  id: number;
  name: string;
  capacity?: number;
  features?: string[];
}

interface IAttendee {
  id?: number;
  email: string;
  name: string;
}

interface IOwner {
  id: number;
  email: string;
  name: string;
}

interface IAPIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
```

### Data Model Diagram

```mermaid
erDiagram
    SERVER_CONFIG {
        string matrixUsername
        string matrixPassword  
        string matrixPreferredLocation
        number apiTimeout
        string apiBaseUrl
    }
    
    AVAILABILITY_REQUEST {
        string dateFrom
        string dateTo
        number locationId
        number duration
    }
    
    BOOKING_REQUEST {
        string timeFrom
        string timeTo
        number locationId
        array attendees
        array extraRequests
        object owner
        boolean ownerIsAttendee
        string source
    }
    
    LOCATION {
        number id
        string name
        number capacity
        array features
    }
    
    TIME_SLOT {
        string from
        string to
        boolean available
        number locationId
    }
    
    BOOKING_RESPONSE {
        number id
        string status
        string timeFrom
        string timeTo
        object location
        object owner
        array attendees
    }
    
    BOOKING_REQUEST ||--|| LOCATION : "books"
    AVAILABILITY_REQUEST ||--|| LOCATION : "checks"
    TIME_SLOT ||--|| LOCATION : "belongs_to"
    BOOKING_RESPONSE ||--|| LOCATION : "contains"
```

## Business Process

### Process 1: Check Availability

```mermaid
flowchart TD
    A[Client Request: Check Availability] --> B[MCPServer.handleRequest]
    B --> C[AvailabilityService.checkAvailability]
    C --> D[ConfigurationManager.getPreferredLocation]
    D --> E{Location Specified?}
    E -->|No| F[Use Preferred Location]
    E -->|Yes| G[Use Specified Location]
    F --> H[AuthenticationManager.getCredentials]
    G --> H
    H --> I[APIClient.checkAvailability]
    I --> J{API Response}
    J -->|Success| K[AvailabilityService.formatResponse]
    J -->|Timeout| L[ErrorHandler.handleTimeout]
    J -->|Error| M[ErrorHandler.handleAPIError]
    K --> N[Return Availability Data]
    L --> O[Return Timeout Error]
    M --> P[Return API Error]
```

### Process 2: Book Appointment

```mermaid
flowchart TD
    A[Client Request: Book Appointment] --> B[MCPServer.handleRequest]
    B --> C[BookingService.createBooking]
    C --> D[ConfigurationManager.getDefaults]
    D --> E{Validate Request}
    E -->|Invalid| F[Return Validation Error]
    E -->|Valid| G[AuthenticationManager.getCredentials]
    G --> H[APIClient.createBooking]
    H --> I{API Response}
    I -->|Success| J[BookingService.formatResponse]
    I -->|Timeout| K[ErrorHandler.handleTimeout]
    I -->|Error| L[ErrorHandler.handleAPIError]
    J --> M[Return Booking Confirmation]
    K --> N[Return Timeout Error]  
    L --> O[Return API Error]
```

### Process 3: Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant MCPServer
    participant AuthManager
    participant ConfigManager
    participant MatrixAPI
    
    Client->>MCPServer: API Request
    MCPServer->>AuthManager: getCredentials()
    AuthManager->>ConfigManager: getUsername()
    AuthManager->>ConfigManager: getPassword()
    ConfigManager-->>AuthManager: credentials
    AuthManager->>AuthManager: encodeCredentials()
    AuthManager-->>MCPServer: encodedCredentials
    MCPServer->>MatrixAPI: API Call with Auth Header
    MatrixAPI-->>MCPServer: Response
    MCPServer-->>Client: Formatted Response
```

### Process 4: Error Handling Flow

```mermaid
flowchart TD
    A[API Call] --> B{Response Type}
    B -->|Success 200| C[Return Data]
    B -->|Client Error 4xx| D[ErrorHandler.handleClientError]
    B -->|Server Error 5xx| E[ErrorHandler.handleServerError]
    B -->|Network Timeout| F[ErrorHandler.handleTimeout]
    B -->|Network Error| G[ErrorHandler.handleNetworkError]
    
    D --> H[Format Client Error]
    E --> I[Format Server Error]
    F --> J[Format Timeout Error]
    G --> K[Format Network Error]
    
    H --> L[Pass Through to Client]
    I --> L
    J --> L
    K --> L
```

## Error Handling Strategy

### Error Classification
- **Network Errors**: Connection failures, timeouts, DNS resolution issues
- **Authentication Errors**: Invalid credentials, expired tokens, authorization failures  
- **Validation Errors**: Invalid request parameters, missing required fields
- **API Errors**: Matrix Booking API-specific errors, rate limiting
- **System Errors**: Configuration issues, environment problems

### Timeout Management
- **API Call Timeout**: 5-second maximum for upstream API calls
- **Connection Timeout**: 3-second maximum for initial connection establishment
- **Graceful Degradation**: Return meaningful error messages on timeout

### Pass-through Error Policy
- **No Custom Error Formatting**: Preserve original Matrix API error messages
- **Error Code Preservation**: Maintain HTTP status codes from upstream API
- **Context Addition**: Add minimal context (timestamp, request ID) without altering core error

### Recovery Mechanisms
- **Retry Logic**: No automatic retries (stateless requirement)
- **Circuit Breaker**: Not implemented (stateless architecture)
- **Fallback Responses**: Provide helpful error messages with suggested actions

## Testing Strategy

### Unit Testing Framework
- **Primary Framework**: Vitest 3 (2025 best practices)
- **Type Safety**: Full TypeScript integration with strict typing
- **Coverage Target**: Minimum 90% code coverage

### Integration Testing
- **API Mocking**: Mock Service Worker (MSW) for network-level mocking
- **Transport Testing**: Test MCP protocol communication
- **End-to-End Scenarios**: Complete user journey testing

### Test Structure
```
tests/
├── unit/
│   ├── services/
│   │   ├── availability.service.test.ts
│   │   ├── booking.service.test.ts
│   │   └── location.service.test.ts
│   ├── managers/
│   │   ├── auth.manager.test.ts
│   │   └── config.manager.test.ts
│   └── utils/
│       ├── error.handler.test.ts
│       └── api.client.test.ts
├── integration/
│   ├── mcp-server.integration.test.ts
│   ├── matrix-api.integration.test.ts
│   └── end-to-end.test.ts
└── mocks/
    ├── matrix-api.mock.ts
    ├── mcp-transport.mock.ts
    └── test-data.ts
```

### Mock Strategy
- **Matrix API Mocking**: Complete API response mocking using MSW
- **Environment Mocking**: Test configuration with various .env scenarios  
- **Transport Mocking**: Mock MCP communication layer
- **Error Simulation**: Test all error conditions and edge cases

### Performance Testing
- **Load Testing**: K6 scripts for HTTP transport testing
- **Memory Profiling**: Monitor memory usage during extended operation
- **Timeout Testing**: Verify 5-second timeout enforcement

### Test Data Management
- **Realistic Test Data**: Use actual Matrix API response formats
- **Edge Case Coverage**: Test boundary conditions and invalid inputs
- **Security Testing**: Validate credential handling and sanitization

Does the design look good? If so, we can move on to the implementation plan.