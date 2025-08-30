# Technical Guidelines

## Test-Driven Development (CRITICAL)
**ALWAYS run `pnpm test` before and after EVERY change:**
- Start each task with `pnpm test` to verify baseline
- Run after EVERY code modification to catch regressions
- Fix failing tests immediately - they were working at task start
- Use `pnpm test:coverage` for coverage verification
- Never complete tasks with failing tests

## Exact Dependencies (DO NOT CHANGE)
This project uses these EXACT versions:
- `@modelcontextprotocol/sdk`: ^1.0.5 (MCP framework)
- `dotenv`: ^17.0.0 (environment config)
- `vitest`: ^3.2.4 (testing - NOT Jest)
- `msw`: ^2.8.6 (API mocking)
- `tsx`: ^4.19.2 (TypeScript execution)
- `uuid`: ^11.1.0 (UUID generation)

## ES Module Imports (MANDATORY)
ALL imports must use `.js` extensions for local files:
```typescript
import { MatrixAPIClient } from '../api/matrix-api-client.js';
import { ConfigurationManager } from './config/index.js';
import { ICredentials } from '../types/authentication.types.js';
```

## Environment Variables (src/config/config-manager.ts)
Required .env variables with EXACT names:
- `MATRIX_USERNAME`: Matrix Booking username
- `MATRIX_PASSWORD`: Matrix Booking password
- `MATRIX_PREFERED_LOCATION`: Default location ID (note: PREFERED not PREFERRED)
- `MATRIX_API_TIMEOUT`: Request timeout (optional, defaults to 5000ms)
- `CACHE_ENABLED`: Cache toggle (optional, defaults to true)

## Dependency Injection Pattern
Constructor injection for all services following this exact pattern:
```typescript
export class ServiceClass implements IServiceInterface {
  constructor(
    private authManager: IAuthenticationManager,
    private configManager: IConfigurationManager,
    private errorHandler?: IErrorHandler
  ) {
    this.errorHandler = errorHandler || new ErrorHandler();
  }
}
```

## Matrix API Specifications
- Base URL: `https://app.matrixbooking.com/api/v1`
- Auth: HTTP Basic with Base64 credentials via `createAuthHeader()`
- Headers: `Content-Type: application/json;charset=UTF-8`
- Matrix headers: `x-matrix-source: WEB`, `x-time-zone: Europe/London`
- Booking endpoint: `POST /booking?notifyScope=ALL_ATTENDEES`
- Cancel endpoint: `DELETE /booking/{id}?notifyScope=ALL_ATTENDEES`
- Include parameters: Always append multiple `include` params for comprehensive data

## Error Handling Pattern (src/error/error-handler.ts)
Use ErrorHandler for consistent error responses:
```typescript
try {
  // API call
} catch (error) {
  const errorResponse = this.errorHandler.handleAPIError(response, data);
  const apiError = new Error(errorResponse.error.message) as Error & { errorResponse: typeof errorResponse };
  apiError.errorResponse = errorResponse;
  throw apiError;
}
```

## Testing Patterns (Vitest + MSW)
Follow these exact patterns from existing tests:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockedFunction } from 'vitest';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('ServiceName', () => {
  let service: ServiceClass;
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocks
  });
});
```

## File Structure Requirements
- Services in `src/services/` with corresponding `src/types/` interfaces
- All types define interfaces starting with `I` (e.g., `IBookingRequest`)
- Index files export all modules: `export * from './module.js';`
- Test files mirror source structure: `tests/unit/services/service-name.test.ts`

## Development Workflow (EXACT ORDER)
```bash
pnpm test           # ALWAYS first - verify baseline
pnpm lint           # ESLint validation
pnpm typecheck      # TypeScript compilation check
pnpm build          # Build to dist/
pnpm test           # ALWAYS last - verify changes
```