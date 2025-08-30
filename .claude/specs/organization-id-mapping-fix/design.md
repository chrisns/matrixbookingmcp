# Organization ID Mapping Fix - Design Document

## Architecture Overview

The fix will implement a robust organization context resolution system that ensures consistent organization ID usage across all Matrix Booking MCP services.

## Core Components

### 1. Organization Context Resolver
**Location**: `src/services/organization-context-resolver.ts`

A new service that manages organization context resolution with fallback logic:

```typescript
class OrganizationContextResolver {
  async resolveOrganizationContext(user: User, preferredLocation?: Location): Promise<OrganizationContext>
  async validateOrganizationId(orgId: number): Promise<boolean>
  async getEffectiveOrganizationId(user: User, locationOrgId?: number): Promise<number>
}
```

**Responsibilities**:
- Determine the correct organization ID for operations
- Handle cross-organization access scenarios
- Provide fallback logic when organization IDs conflict
- Cache organization validation results

### 2. Enhanced Organization Service
**Location**: `src/services/organization-service.ts` (modified)

**Current Issues**:
- Line 24: Throws error on `NaN` organization ID
- Missing validation before API calls
- No fallback mechanism for invalid IDs

**Proposed Changes**:
```typescript
// Before API calls, validate and resolve organization ID
const resolvedOrgId = await this.contextResolver.getEffectiveOrganizationId(user, orgId);
```

### 3. Updated Availability Service  
**Location**: `src/services/availability-service.ts` (modified)

**Current Issues**:
- Line 87: Date range validation rejects identical start/end times
- No handling for point-in-time availability queries

**Proposed Changes**:
```typescript
private validateDateRange(dateFrom: string, dateTo: string): void {
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  
  // Allow identical times for point-in-time queries
  if (start > end) {
    throw new Error('End time must be after or equal to start time');
  }
  
  // For identical times, add minimal duration for API compatibility
  if (start.getTime() === end.getTime()) {
    return this.addMinimalDuration(dateFrom, dateTo);
  }
}
```

### 4. Location Service Improvements
**Location**: `src/services/location-service.ts` (modified)

**Current Issues**:
- Location hierarchy returns empty arrays
- No organization context validation
- Preferred location may belong to different organization

**Proposed Changes**:
```typescript
async getLocationHierarchy(params: LocationParams, orgContext: OrganizationContext): Promise<Location[]> {
  // Validate organization context before API call
  const validatedOrgId = await this.contextResolver.validateOrganizationId(orgContext.organizationId);
  if (!validatedOrgId) {
    throw new Error(`Invalid organization context: ${orgContext.organizationId}`);
  }
  
  // Proceed with API call using validated organization context
}
```

## Data Flow

### 1. Request Initialization
```
User Request → MCP Server → Extract User Context → Resolve Organization Context
```

### 2. Organization Context Resolution
```
User Org ID + Preferred Location Org ID → Context Resolver → Effective Org ID
```

### 3. Service Operations
```
Effective Org ID → Service Calls → Validated API Requests → Success Response
```

## Error Handling Strategy

### 1. Organization ID Validation
- **Input Validation**: Check for `NaN`, `null`, `undefined` before processing
- **API Validation**: Verify organization exists and user has access
- **Fallback Logic**: Use user's primary organization if location organization is inaccessible

### 2. Date Range Handling
- **Point-in-time Queries**: Allow identical start/end times
- **Duration Addition**: Add 15-minute default duration for API compatibility
- **Validation Messages**: Provide clear error messages for invalid ranges

### 3. Location Service Failures
- **Empty Results**: Log warning and suggest troubleshooting steps
- **Authentication Issues**: Refresh tokens and retry once
- **Network Failures**: Implement exponential backoff

## Configuration Changes

### Environment Variables
```
MATRIX_DEFAULT_DURATION_MINUTES=15
MATRIX_ORGANIZATION_RESOLUTION_STRATEGY=user_preferred|location_preferred|strict
MATRIX_ENABLE_CROSS_ORG_ACCESS=true|false
```

### Service Configuration
```typescript
interface OrganizationContextConfig {
  defaultDurationMinutes: number;
  resolutionStrategy: 'user_preferred' | 'location_preferred' | 'strict';
  enableCrossOrgAccess: boolean;
  cacheValidationResults: boolean;
  validationCacheTTL: number;
}
```

## API Integration Points

### 1. Matrix API Organization Validation
- **Endpoint**: `/api/v1/organizations/{orgId}/validate`
- **Purpose**: Verify organization exists and user has access
- **Response**: Boolean + access level details

### 2. Matrix API Cross-Organization Access
- **Endpoint**: `/api/v1/users/{userId}/organizations`  
- **Purpose**: Get list of organizations user can access
- **Response**: Array of organization IDs with access levels

## Testing Strategy

### 1. Unit Tests
- Organization context resolution with various scenarios
- Date range validation with edge cases
- Error handling for invalid organization IDs

### 2. Integration Tests
- End-to-end booking flows for desk and room bookings
- Cross-organization access scenarios
- Location hierarchy retrieval with different org contexts

### 3. Error Scenario Tests
- `NaN` organization ID handling
- Network failures during organization validation
- Mismatched user/location organization IDs

## Monitoring and Logging

### 1. Metrics
- Organization context resolution success/failure rates
- API call success rates by organization ID
- Average resolution time for organization context

### 2. Logging
- Organization ID resolution decisions
- Fallback logic usage
- API validation failures with context

### 3. Health Checks
- Organization service connectivity
- Context resolver performance
- Cache hit/miss rates

## Migration Plan

### Phase 1: Organization Context Resolver
1. Implement `OrganizationContextResolver` service
2. Add unit tests for context resolution logic
3. Integrate with existing services (read-only)

### Phase 2: Service Integration
1. Update `OrganizationService` to use context resolver
2. Fix `AvailabilityService` date validation
3. Enhance `LocationService` with organization context

### Phase 3: MCP Server Integration
1. Update MCP method handlers to use organization context
2. Add error handling and logging
3. Update health check to include context resolver

### Phase 4: Testing and Deployment
1. Run comprehensive integration tests
2. Deploy to staging environment
3. Verify all booking scenarios work correctly
4. Deploy to production

## Rollback Strategy

- **Service Isolation**: New organization context resolver can be disabled via feature flag
- **Fallback Logic**: Existing organization ID extraction logic preserved as fallback
- **Configuration Rollback**: Environment variables allow reverting to original behavior
- **Database Changes**: No schema changes required - only service logic updates