#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from './utils/logger.js';
import { z } from 'zod';

const server = new Server(
  {
    name: 'claude-assist-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const PollingOptionsSchema = z.object({
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
  interval: z.number().default(2000).describe('Polling interval in milliseconds'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'claude_desktop',
        description: 'Interact with Claude Desktop app on macOS',
        inputSchema: z.object({
          operation: z.enum(['ask', 'get_conversations']).describe('Operation to perform'),
          prompt: z.string().optional().describe('The prompt to send to Claude Desktop (required for ask operation)'),
          conversationId: z.string().optional().describe('Optional conversation ID to continue a specific conversation'),
          pollingOptions: PollingOptionsSchema.optional(),
        }),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'claude_desktop': {
        const { handleClaudeDesktop } = await import('./tools/claude-desktop.js');
        const validatedArgs = z.object({
          operation: z.enum(['ask', 'get_conversations']),
          prompt: z.string().optional(),
          conversationId: z.string().optional(),
          pollingOptions: PollingOptionsSchema.optional(),
        }).parse(args);

        const result = await handleClaudeDesktop(validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error('Tool execution failed:', error);
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

async function main() {
  logger.info('Starting Claude Assist MCP Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('Claude Assist MCP Server started successfully');
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});