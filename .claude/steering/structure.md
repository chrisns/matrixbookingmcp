# Project Structure

## Directory Organization
```
/
├── src/                    # TypeScript source code
│   ├── server.ts          # MCP server implementation
│   ├── matrix-api.ts      # Matrix Booking API client
│   └── utils/             # Utility functions
├── tests/                 # Test files
├── dist/                  # Compiled JavaScript output
├── .env                   # Environment configuration (not in repo)
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
├── pnpm-lock.yaml        # pnpm lock file
├── tsconfig.json         # TypeScript configuration
└── bookexample.js        # Reference booking implementation
```

## File Naming Patterns
- Use kebab-case for file names
- TypeScript files use .ts extension
- Test files use .test.ts or .spec.ts suffix
- Define TypeScript types inline within relevant files

## Key File Locations
- **API Reference**: `bookexample.js` - Contains working booking request example
- **Requirements**: `notes.md` - Project specifications and requirements
- **Main Server**: `src/server.ts` - MCP server entry point
- **API Client**: `src/matrix-api.ts` - Matrix Booking API wrapper
- **Configuration**: `.env` - Credentials and settings (gitignored)

## MCP Server Architecture
- Implement as stateless server responding to MCP protocol requests
- Separate API client logic from MCP server logic
- Define TypeScript interfaces inline within relevant files for API request/response types
- Handle errors gracefully with appropriate MCP response formats

## Git Workflow
- Make semantic commits between development steps
- Keep .env file out of version control
- Include .env.example with required variable names