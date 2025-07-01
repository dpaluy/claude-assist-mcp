#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from './utils/logger.js';
import { z } from 'zod';

const server = new Server(
  {
    name: 'mcp-claude-desktop',
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

// Define the Claude Desktop tool in JSON Schema format
const CLAUDE_DESKTOP_TOOL: Tool = {
  name: 'claude_desktop',
  description: 'Interact with Claude Desktop app on macOS',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['ask', 'get_conversations'],
      },
      prompt: {
        type: 'string',
        description: 'The prompt to send to Claude Desktop (required for ask operation)',
      },
      conversationId: {
        type: 'string',
        description: 'Optional conversation ID to continue a specific conversation',
      },
      pollingOptions: {
        type: 'object',
        description: 'Polling configuration options',
        properties: {
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
            default: 30000,
          },
          interval: {
            type: 'number',
            description: 'Polling interval in milliseconds',
            default: 2000,
          },
        },
      },
    },
    required: ['operation'],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [CLAUDE_DESKTOP_TOOL],
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
  logger.info('Starting MCP Claude Desktop Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('MCP Claude Desktop Server started successfully');
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});