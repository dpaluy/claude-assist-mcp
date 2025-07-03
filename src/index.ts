#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const VERSION = packageJson.version;

import { getAllTools, getToolByName } from './tools/registry.js';
import { ToolHandler } from './handlers/tool-handler.js';
import { logger } from './utils/logger.js';

const server = new Server(
  {
    name: 'mcp-claude-desktop',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);


// Initialize tool handler
const toolHandler = new ToolHandler();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getAllTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;
  
  try {
    // Get tool definition and validate args
    const tool = getToolByName(name);
    const validatedArgs = tool.zodSchema.parse(args);
    
    // Handle the tool request and ensure it returns CallToolResult
    const result = await toolHandler.handle(name, validatedArgs);
    return result as CallToolResult;
  } catch (error) {
    logger.error(`Error handling tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
logger.info(`Claude Desktop MCP Server v${VERSION} running on stdio`);

// Handle graceful shutdown
const cleanup = async () => {
  logger.info('Shutting down MCP server...');
  try {
    await server.close();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  cleanup();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  cleanup();
});
