#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const VERSION = packageJson.version;

// Define the Claude Desktop tool
const CLAUDE_DESKTOP_TOOL = {
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
      timeout: {
        type: 'number',
        description: 'Response timeout in milliseconds (default: 30000, max: 300000)',
      },
      pollingInterval: {
        type: 'number',
        description: 'Polling interval in milliseconds (default: 1500, min: 500)',
      },
    },
    required: ['operation'],
  },
};

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

const PollingOptionsSchema = z.object({
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
  interval: z.number().default(1500).describe('Polling interval in milliseconds'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CLAUDE_DESKTOP_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'claude_desktop') {
      const { handleClaudeDesktop } = await import('./tools/claude-desktop.js');
      const validatedArgs = z.object({
        operation: z.enum(['ask', 'get_conversations']),
        prompt: z.string().optional(),
        conversationId: z.string().optional(),
        timeout: z.number().min(1000).max(300000).optional(),
        pollingInterval: z.number().min(500).max(10000).optional(),
        pollingOptions: PollingOptionsSchema.optional(),
      }).parse(args);

      // Build polling options from individual params or use defaults
      const pollingOptions = validatedArgs.pollingOptions || {
        timeout: validatedArgs.timeout || 30000,
        interval: validatedArgs.pollingInterval || 1500,
      };
      
      const argsWithDefaults = {
        ...validatedArgs,
        pollingOptions,
      };
      
      const result = await handleClaudeDesktop(argsWithDefaults);

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
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
console.error('Claude Desktop MCP Server running on stdio');
