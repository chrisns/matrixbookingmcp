#!/usr/bin/env node

/**
 * Matrix Booking MCP Server
 * 
 * A TypeScript MCP server that interfaces with the Matrix Booking API
 * to provide availability checking and booking functionality.
 */

import { ConfigurationManager } from './config/index.js';

// Export modules for external use
export * from './config/index.js';
export * from './auth/index.js';
export * from './api/index.js';
export * from './error/index.js';
export * from './types/index.js';

async function startServer(): Promise<void> {
  try {
    console.log("Matrix Booking MCP Server - Starting up...");
    
    const configManager = new ConfigurationManager();
    const config = configManager.getConfig();
    
    console.log("Configuration loaded successfully");
    console.log(`API Base URL: ${config.apiBaseUrl}`);
    console.log(`API Timeout: ${config.apiTimeout}ms`);
    console.log(`Preferred Location: ${config.matrixPreferredLocation}`);
    
    console.log("Matrix Booking MCP Server - Ready!");
    
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