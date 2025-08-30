# Project Structure

## Critical Directory Patterns
1. **src/**: Main source code with layered architecture
   - `mcp/` - MCP server implementation (entry point: `mcp-server.ts`)
   - `api/` - Matrix API client (`matrix-api-client.ts`)
   - `services/` - Business logic services (7 services: availability, booking, location, organization, user, search, facility)
   - `auth/` - Authentication management (`authentication-manager.ts`)
   - `config/` - Configuration management (`config-manager.ts`)
   - `types/` - TypeScript type definitions (13 type modules)
   - `validation/` - Input validation (`input-validator.ts`, `input-sanitizer.ts`)
   - `error/` - Error handling (`error-handler.ts`)
   - `utils/` - Utility functions (`date-formatting.ts`)

2. **tests/**: Comprehensive test coverage
   - `unit/` - Unit tests mirroring src structure
   - `integration/` - End-to-end tests
   - `performance/` - Load and timeout tests
   - `mocks/` - MSW handlers and test data

## Essential File Naming Rules
1. **Use kebab-case for all filenames**: `matrix-api-client.ts`, `booking-service.ts`
2. **Service files end with `-service.ts`**: `availability-service.ts`, `location-service.ts`
3. **Type files end with `.types.ts`**: `booking.types.ts`, `api.types.ts`
4. **Test files match source structure**: `src/mcp/mcp-server.ts` → `tests/unit/mcp/mcp-server.test.ts`
5. **Index files export modules**: Each directory has `index.ts` that re-exports module contents

## Type System Architecture
1. **Centralized type definitions**: All types in `src/types/` with specific `.types.ts` files
2. **Index-based exports**: `src/types/index.ts` exports all type modules
3. **Interface naming**: Prefix with `I` (e.g., `IAvailabilityRequest`, `IBookingResponse`)
4. **No inline types**: Define types in dedicated `.types.ts` files, not within implementation files

## Service Layer Pattern
1. **Service classes**: Each domain has dedicated service class (`BookingService`, `AvailabilityService`)
2. **Constructor injection**: Services receive dependencies via constructor
3. **API client abstraction**: All Matrix API calls go through `MatrixAPIClient`
4. **Service exports**: Each service directory has `index.ts` exporting the service class

## MCP Server Structure
1. **Single server class**: `MatrixBookingMCPServer` in `src/mcp/mcp-server.ts`
2. **Tool definitions**: Tools defined as private methods returning `Tool` objects
3. **Handler separation**: Tool handlers are separate private methods
4. **Error handling**: Consistent error response format with context and suggestions

## Test Organization Rules
1. **Mirror source structure**: Every `src/` file has corresponding test in `tests/unit/`
2. **Test naming**: Use `.test.ts` suffix (not `.spec.ts`)
3. **Integration tests**: End-to-end scenarios in `tests/integration/`
4. **Mock strategy**: MSW handlers in `tests/mocks/matrix-api.handlers.ts`
5. **Test data**: Centralized in `tests/mocks/test-data.ts`

## Build and Configuration
1. **ES Modules**: Project uses `"type": "module"` in package.json
2. **Import extensions**: Always use `.js` extensions in imports (TypeScript compilation target)
3. **Entry point**: `src/index.ts` is main entry point, exports all modules
4. **Build target**: Compiles to `dist/` directory
5. **Test framework**: Vitest (not Jest) with coverage via v8

## Environment and Scripts
1. **Required scripts**: `build`, `test`, `lint`, `typecheck` must be maintained
2. **Performance testing**: Separate Vitest and k6 test suites
3. **Configuration**: Use `ConfigurationManager` class, not direct env access
4. **Dependencies**: MCP SDK, dotenv, uuid as core dependencies

## Critical Files to Never Modify Structure
- `src/index.ts` - Main entry point with module exports
- `src/types/index.ts` - Central type exports
- `package.json` scripts section - Build and test commands
- Directory-level `index.ts` files - Module export patterns