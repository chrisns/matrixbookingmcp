#!/usr/bin/env node

/**
 * Matrix Booking MCP Server
 * 
 * A TypeScript MCP server that interfaces with the Matrix Booking API
 * to provide availability checking and booking functionality.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigurationManager } from './config/index.js';
import { MatrixBookingMCPServer } from './mcp/index.js';

// Export modules for external use
export * from './config/index.js';
export * from './auth/index.js';
export * from './api/index.js';
export * from './error/index.js';
export * from './types/index.js';
export * from './mcp/index.js';

async function startServer(): Promise<void> {
  try {
    console.error("Matrix Booking MCP Server - Starting up...");
    
    // Validate configuration first
    const configManager = new ConfigurationManager();
    const config = configManager.getConfig();
    
    console.error("Configuration loaded successfully");
    console.error(`API Base URL: ${config.apiBaseUrl}`);
    console.error(`API Timeout: ${config.apiTimeout}ms`);
    console.error(`Preferred Location: ${config.matrixPreferredLocation}`);
    
    // Initialize MCP server
    const mcpServer = new MatrixBookingMCPServer();
    await mcpServer.start();
    
    // Set up stdio transport
    const transport = new StdioServerTransport();
    console.error("MCP Server transport initialized");
    
    // Connect the server to the transport
    await mcpServer.getServer().connect(transport);
    
    console.error("Matrix Booking MCP Server - Ready and connected!");
    
  } catch (error) {
    console.error("Failed to start Matrix Booking MCP Server:");
    
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown error occurred during startup");
    }
    
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error("Unhandled error during server startup:", error);
  process.exit(1);
});

export {};