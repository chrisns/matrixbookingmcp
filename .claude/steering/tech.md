# Technical Guidelines

## Continuous Testing (CRITICAL)
**ALWAYS run tests before and after making changes:**
- Run `pnpm test` at the start of EVERY task to verify current state
- Run `pnpm test` after EVERY code change to catch regressions immediately
- If tests fail during a task, fix them immediately - they were working at task start
- Use `pnpm test:coverage` to ensure new code is properly tested
- Never commit or complete a task with failing tests

## Project-Specific Dependencies
This project uses these EXACT packages - do not change without explicit instruction:
- `@modelcontextprotocol/sdk`: ^1.0.5 (MCP server implementation)
- `dotenv`: ^16.4.7 (environment configuration)
- `vitest`: ^3.2.4 (testing framework - NOT Jest)
- `msw`: ^2.8.6 (API mocking in tests)
- `tsx`: ^4.19.2 (TypeScript execution)

## TypeScript Configuration
Follow the strict TypeScript settings in tsconfig.json:
- Target: ES2022 with ESNext modules
- All strict checks enabled (noImplicitAny, noUnusedLocals, etc.)
- ES modules only (type: "module" in package.json)
- Import with .js extensions: `import { X } from './file.js'`

## Environment Configuration
Required .env variables (see src/config/config-manager.ts):
- `MATRIX_USERNAME`: Matrix Booking username
- `MATRIX_PASSWORD`: Matrix Booking password  
- `MATRIX_PREFERED_LOCATION`: Default location ID for bookings

## Code Patterns
Follow these specific patterns from the codebase:
- Configuration: Use ConfigurationManager class (src/config/index.ts)
- Error handling: Explicit try/catch with process.exit(1) for startup failures
- Imports: Use .js extensions for local imports: `from './config/index.js'`
- Console logging: Use structured console.log with descriptive prefixes
- Export pattern: `export {};` at end of executable files

## Matrix API Integration
- Base URL: https://app.matrixbooking.com/api/v1
- Authentication: HTTP Basic with Base64 encoded credentials
- Required headers: Content-Type: application/json;charset=UTF-8
- Matrix headers: x-matrix-source: WEB, x-time-zone: Europe/London
- POST /booking with notifyScope=ALL_ATTENDEES
- ISO 8601 datetime format (YYYY-MM-DDTHH:mm:ss.sss)

## Development Commands (Run in Order)
```bash
pnpm test           # ALWAYS run first - verify tests pass
pnpm lint           # Check code style
pnpm typecheck      # Verify TypeScript compilation
pnpm build          # Compile to dist/
pnpm test           # ALWAYS run after changes
```