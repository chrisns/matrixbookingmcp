#!/usr/bin/env node

/**
 * Matrix Booking MCP Server
 * 
 * A TypeScript MCP server that interfaces with the Matrix Booking API
 * to provide availability checking and booking functionality.
 */

import { MatrixBookingMCPServer } from './mcp/mcp-server.js';

async function startServer(): Promise<void> {
  try {
    
    // Initialize and run MCP server
    const mcpServer = new MatrixBookingMCPServer();
    await mcpServer.run();
    
  } catch {
    // Error handling - exit with error code
    process.exit(1);
  }
}

startServer().catch(() => {
  process.exit(1);
});

export {};